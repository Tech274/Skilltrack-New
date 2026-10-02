-- Batch 2: Admin Modules — access_rules + question_bank

-- ============ access_rules ============
CREATE TABLE public.access_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type text NOT NULL CHECK (asset_type IN ('certification','resource','mock_exam')),
  asset_id uuid,
  certification_slug text,
  required_plan text,
  required_role text,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (asset_id IS NOT NULL OR certification_slug IS NOT NULL)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.access_rules TO authenticated;
GRANT ALL ON public.access_rules TO service_role;

ALTER TABLE public.access_rules ENABLE ROW LEVEL SECURITY;

-- Read: any admin-tier role + super admin
CREATE POLICY "access_rules_read_admins" ON public.access_rules FOR SELECT TO authenticated
USING (
  public.is_admin_role(auth.uid(), ARRAY['admin','content_admin','finance_admin','support_admin']::app_role[])
  OR public.is_super_admin(auth.uid())
);
-- Read: also allow any authenticated user to read ACTIVE rules so checkAssetAccess works under RLS
CREATE POLICY "access_rules_read_active_public" ON public.access_rules FOR SELECT TO authenticated
USING (active = true);

-- Write: admin + super admin only
CREATE POLICY "access_rules_insert_admin" ON public.access_rules FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.is_super_admin(auth.uid()));
CREATE POLICY "access_rules_update_admin" ON public.access_rules FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.is_super_admin(auth.uid()))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.is_super_admin(auth.uid()));
CREATE POLICY "access_rules_delete_admin" ON public.access_rules FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.is_super_admin(auth.uid()));

CREATE INDEX idx_access_rules_asset ON public.access_rules(asset_type, asset_id) WHERE asset_id IS NOT NULL;
CREATE INDEX idx_access_rules_cert ON public.access_rules(certification_slug) WHERE certification_slug IS NOT NULL;
CREATE INDEX idx_access_rules_active ON public.access_rules(active) WHERE active = true;

CREATE TRIGGER trg_access_rules_touch BEFORE UPDATE ON public.access_rules
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ question_bank ============
CREATE TABLE public.question_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  certification_slug text,
  topic text,
  difficulty text CHECK (difficulty IS NULL OR difficulty IN ('easy','medium','hard')),
  question_type text NOT NULL DEFAULT 'single' CHECK (question_type IN ('single','multi','true_false')),
  question_text text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  explanation text,
  reference_url text,
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_bank TO authenticated;
GRANT ALL ON public.question_bank TO service_role;

ALTER TABLE public.question_bank ENABLE ROW LEVEL SECURITY;

-- Read: admins (any tier) + super admin; org members can read their org rows; nobody else
CREATE POLICY "question_bank_read_admins" ON public.question_bank FOR SELECT TO authenticated
USING (
  public.is_admin_role(auth.uid(), ARRAY['admin','content_admin','finance_admin','support_admin']::app_role[])
  OR public.is_super_admin(auth.uid())
  OR (org_id IS NOT NULL AND public.is_org_member(org_id, auth.uid(), NULL))
);

-- Write: platform admin/super admin for global rows; org exec/manager for own-org rows; content_admin anywhere
CREATE POLICY "question_bank_insert" ON public.question_bank FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'content_admin')
  OR public.is_super_admin(auth.uid())
  OR (org_id IS NOT NULL AND public.is_org_member(org_id, auth.uid(), ARRAY['exec','manager']::org_role[]))
);
CREATE POLICY "question_bank_update" ON public.question_bank FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'content_admin')
  OR public.is_super_admin(auth.uid())
  OR (org_id IS NOT NULL AND public.is_org_member(org_id, auth.uid(), ARRAY['exec','manager']::org_role[]))
)
WITH CHECK (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'content_admin')
  OR public.is_super_admin(auth.uid())
  OR (org_id IS NOT NULL AND public.is_org_member(org_id, auth.uid(), ARRAY['exec','manager']::org_role[]))
);
CREATE POLICY "question_bank_delete" ON public.question_bank FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'content_admin')
  OR public.is_super_admin(auth.uid())
  OR (org_id IS NOT NULL AND public.is_org_member(org_id, auth.uid(), ARRAY['exec']::org_role[]))
);

CREATE INDEX idx_question_bank_cert ON public.question_bank(certification_slug);
CREATE INDEX idx_question_bank_org ON public.question_bank(org_id);
CREATE INDEX idx_question_bank_topic ON public.question_bank(topic);
CREATE INDEX idx_question_bank_active ON public.question_bank(active) WHERE active = true;

CREATE TRIGGER trg_question_bank_touch BEFORE UPDATE ON public.question_bank
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
