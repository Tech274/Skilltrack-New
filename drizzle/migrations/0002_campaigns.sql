CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  campaign_type text NOT NULL DEFAULT 'platform' CHECK (campaign_type IN ('platform','certification','offer','career','lab','enterprise','assessment','new-launch','announcement')),
  title text NOT NULL,
  eyebrow text,
  headline text NOT NULL,
  description text,
  desktop_image_url text,
  mobile_image_url text,
  image_alt text,
  primary_cta_label text NOT NULL,
  primary_cta_url text NOT NULL,
  secondary_cta_label text,
  secondary_cta_url text,
  audience text NOT NULL DEFAULT 'all' CHECK (audience IN ('all','learner','professional','enterprise','lnd','administrator')),
  priority integer NOT NULL DEFAULT 100,
  start_date timestamptz,
  end_date timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  theme text NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark','light')),
  text_alignment text NOT NULL DEFAULT 'left' CHECK (text_alignment IN ('left','center')),
  image_position text NOT NULL DEFAULT 'right' CHECK (image_position IN ('right','left','background')),
  badge text,
  analytics_id text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.campaigns TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads live campaigns" ON public.campaigns FOR SELECT TO anon, authenticated
  USING (is_active AND (start_date IS NULL OR start_date <= now()) AND (end_date IS NULL OR end_date >= now()));
CREATE POLICY "Content admins read all campaigns" ON public.campaigns FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'content_admin'));
CREATE POLICY "Content admins write campaigns" ON public.campaigns FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'content_admin'))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'content_admin'));
CREATE TRIGGER campaigns_touch BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "Campaign images admin read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'campaign-images' AND (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'content_admin')));
CREATE POLICY "Campaign images admin write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'campaign-images' AND (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'content_admin')));
CREATE POLICY "Campaign images admin delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'campaign-images' AND (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'content_admin')));