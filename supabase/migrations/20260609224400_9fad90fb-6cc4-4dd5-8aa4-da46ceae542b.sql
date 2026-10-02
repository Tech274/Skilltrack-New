
-- 2) Tighten EXECUTE on SECURITY DEFINER functions exposed via API
REVOKE EXECUTE ON FUNCTION public.create_organization(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_organization(text, text, text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.join_demo_organization() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_demo_organization() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid, org_role[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid, org_role[]) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_milestone_reminder() FROM PUBLIC, anon, authenticated;

-- 3) Security findings table
CREATE TABLE public.security_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scanner_name text NOT NULL,
  external_id text NOT NULL,
  title text NOT NULL,
  description text,
  level text NOT NULL DEFAULT 'warn',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','triaged','fixed','ignored','reopened')),
  link text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scanner_name, external_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.security_findings TO authenticated;
GRANT ALL ON public.security_findings TO service_role;

ALTER TABLE public.security_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view findings" ON public.security_findings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert findings" ON public.security_findings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update findings" ON public.security_findings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete findings" ON public.security_findings FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_security_findings_updated_at
  BEFORE UPDATE ON public.security_findings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4) Finding events (audit trail)
CREATE TABLE public.security_finding_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id uuid NOT NULL REFERENCES public.security_findings(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  from_status text,
  to_status text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.security_finding_events TO authenticated;
GRANT ALL ON public.security_finding_events TO service_role;

ALTER TABLE public.security_finding_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view finding events" ON public.security_finding_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert finding events" ON public.security_finding_events FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND (actor_id IS NULL OR actor_id = auth.uid()));

-- 5) Auto-log status changes
CREATE OR REPLACE FUNCTION public.log_security_finding_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.security_finding_events (finding_id, actor_id, from_status, to_status, note)
    VALUES (NEW.id, auth.uid(), NULL, NEW.status, 'created');
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.security_finding_events (finding_id, actor_id, from_status, to_status, note)
    VALUES (NEW.id, auth.uid(), OLD.status, NEW.status, NEW.notes);
    IF NEW.status IN ('fixed','ignored') AND NEW.resolved_at IS NULL THEN
      NEW.resolved_at := now();
    ELSIF NEW.status NOT IN ('fixed','ignored') THEN
      NEW.resolved_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.log_security_finding_status() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_security_finding_insert_event
  AFTER INSERT ON public.security_findings
  FOR EACH ROW EXECUTE FUNCTION public.log_security_finding_status();

CREATE TRIGGER trg_security_finding_update_event
  BEFORE UPDATE OF status ON public.security_findings
  FOR EACH ROW EXECUTE FUNCTION public.log_security_finding_status();

-- 6) Helper RPC: upsert a finding from a scan payload
CREATE OR REPLACE FUNCTION public.upsert_security_finding(
  _scanner text, _external_id text, _title text, _description text,
  _level text, _link text, _metadata jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE fid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  INSERT INTO public.security_findings (scanner_name, external_id, title, description, level, link, metadata)
  VALUES (_scanner, _external_id, _title, _description, COALESCE(_level,'warn'), _link, COALESCE(_metadata,'{}'::jsonb))
  ON CONFLICT (scanner_name, external_id) DO UPDATE
    SET last_seen_at = now(),
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        level = EXCLUDED.level,
        link = EXCLUDED.link,
        metadata = EXCLUDED.metadata,
        status = CASE WHEN public.security_findings.status IN ('fixed','ignored')
                      THEN 'reopened' ELSE public.security_findings.status END
  RETURNING id INTO fid;
  RETURN fid;
END $$;

REVOKE EXECUTE ON FUNCTION public.upsert_security_finding(text,text,text,text,text,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_security_finding(text,text,text,text,text,text,jsonb) TO authenticated;
