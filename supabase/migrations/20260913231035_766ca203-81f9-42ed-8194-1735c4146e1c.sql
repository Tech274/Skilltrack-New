CREATE TABLE public.marketplace_oems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  short_name text NOT NULL,
  logo_path text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_oems_key_chk CHECK (key ~ '^[a-z0-9-]+$')
);

CREATE TABLE public.marketplace_certs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oem_id uuid NOT NULL REFERENCES public.marketplace_oems(id) ON DELETE RESTRICT,
  key text NOT NULL UNIQUE,
  catalog_slug text,
  catalog_id uuid REFERENCES public.certifications_catalog(id) ON DELETE SET NULL,
  code text,
  name text NOT NULL,
  short_name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_certs_key_chk CHECK (key ~ '^[a-z0-9-]+$')
);

CREATE TABLE public.marketplace_skus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cert_id uuid NOT NULL REFERENCES public.marketplace_certs(id) ON DELETE RESTRICT,
  sku_type text NOT NULL CHECK (sku_type IN ('mock','practice','notes','labs')),
  title text NOT NULL,
  blurb text NOT NULL DEFAULT '',
  includes text[] NOT NULL DEFAULT '{}',
  features text[] NOT NULL DEFAULT '{}',
  price_inr numeric(10,2) NOT NULL DEFAULT 999,
  active boolean NOT NULL DEFAULT true,
  mock_exam_id uuid REFERENCES public.mock_exams(id) ON DELETE SET NULL,
  study_resource_id uuid REFERENCES public.study_resources(id) ON DELETE SET NULL,
  question_bank_id uuid REFERENCES public.question_bank(id) ON DELETE SET NULL,
  fulfilled_on_label text,
  fulfilled_on_href text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cert_id, sku_type)
);

CREATE INDEX marketplace_certs_oem_idx ON public.marketplace_certs(oem_id);
CREATE INDEX marketplace_certs_active_idx ON public.marketplace_certs(active);
CREATE INDEX marketplace_skus_cert_idx ON public.marketplace_skus(cert_id);
CREATE INDEX marketplace_skus_active_idx ON public.marketplace_skus(active);
CREATE INDEX marketplace_oems_active_idx ON public.marketplace_oems(active);

GRANT SELECT ON public.marketplace_oems TO anon, authenticated;
GRANT SELECT ON public.marketplace_certs TO anon, authenticated;
GRANT SELECT ON public.marketplace_skus TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_oems TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_certs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_skus TO authenticated;
GRANT ALL ON public.marketplace_oems TO service_role;
GRANT ALL ON public.marketplace_certs TO service_role;
GRANT ALL ON public.marketplace_skus TO service_role;

ALTER TABLE public.marketplace_oems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_certs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_skus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public reads active marketplace oems"
  ON public.marketplace_oems FOR SELECT TO anon, authenticated
  USING (
    active = true
    OR public.is_super_admin(auth.uid())
    OR public.is_admin_role(auth.uid(), ARRAY['admin'::app_role,'content_admin'::app_role,'support_admin'::app_role])
  );

CREATE POLICY "content writes marketplace oems"
  ON public.marketplace_oems FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_admin_role(auth.uid(), ARRAY['admin'::app_role,'content_admin'::app_role]))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_admin_role(auth.uid(), ARRAY['admin'::app_role,'content_admin'::app_role]));

CREATE POLICY "public reads active marketplace certs"
  ON public.marketplace_certs FOR SELECT TO anon, authenticated
  USING (
    active = true
    OR public.is_super_admin(auth.uid())
    OR public.is_admin_role(auth.uid(), ARRAY['admin'::app_role,'content_admin'::app_role,'support_admin'::app_role])
  );

CREATE POLICY "content writes marketplace certs"
  ON public.marketplace_certs FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_admin_role(auth.uid(), ARRAY['admin'::app_role,'content_admin'::app_role]))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_admin_role(auth.uid(), ARRAY['admin'::app_role,'content_admin'::app_role]));

CREATE POLICY "public reads active marketplace skus"
  ON public.marketplace_skus FOR SELECT TO anon, authenticated
  USING (
    active = true
    OR public.is_super_admin(auth.uid())
    OR public.is_admin_role(auth.uid(), ARRAY['admin'::app_role,'content_admin'::app_role,'support_admin'::app_role])
  );

CREATE POLICY "content writes marketplace skus"
  ON public.marketplace_skus FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_admin_role(auth.uid(), ARRAY['admin'::app_role,'content_admin'::app_role]))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_admin_role(auth.uid(), ARRAY['admin'::app_role,'content_admin'::app_role]));

CREATE TRIGGER trg_mkt_oems_touch BEFORE UPDATE ON public.marketplace_oems
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_mkt_certs_touch BEFORE UPDATE ON public.marketplace_certs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_mkt_skus_touch BEFORE UPDATE ON public.marketplace_skus
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.marketplace_oems (key, name, short_name, logo_path, sort_order, active) VALUES
  ('aws', 'Amazon Web Services', 'AWS', '/logos/oem/aws.svg', 10, true),
  ('azure', 'Microsoft Azure', 'Azure', '/logos/oem/microsoft-azure.svg', 20, true),
  ('gcp', 'Google Cloud', 'GCP', '/logos/oem/google-cloud.svg', 30, true),
  ('salesforce', 'Salesforce', 'Salesforce', '/logos/oem/salesforce.svg', 40, true)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.marketplace_certs (oem_id, key, catalog_slug, catalog_id, code, name, short_name, sort_order, active)
SELECT o.id, v.key, v.catalog_slug, c.id, v.code, v.name, v.short_name, v.sort_order, true
FROM (
  VALUES
    ('aws', 'aws-saa', 'aws-solutions-architect-associate', 'SAA-C03', 'AWS Solutions Architect — Associate', 'AWS SAA', 10),
    ('azure', 'az-104', 'azure-administrator-az-104', 'AZ-104', 'Microsoft Azure Administrator', 'AZ-104', 20),
    ('gcp', 'gcp-ace', 'gcp-associate-cloud-engineer', 'ACE', 'Google Associate Cloud Engineer', 'GCP ACE', 30),
    ('salesforce', 'salesforce-admin', 'salesforce-administrator', 'ADM-201', 'Salesforce Certified Administrator', 'SF Admin', 40)
) AS v(oem_key, key, catalog_slug, code, name, short_name, sort_order)
JOIN public.marketplace_oems o ON o.key = v.oem_key
LEFT JOIN public.certifications_catalog c ON c.slug = v.catalog_slug
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.marketplace_skus (cert_id, sku_type, title, blurb, includes, features, price_inr, active, fulfilled_on_label, fulfilled_on_href)
SELECT c.id, v.sku_type, v.title, v.blurb, v.includes, v.features, 999, true, v.fulfilled_label, v.fulfilled_href
FROM (
  VALUES
    ('aws-saa', 'mock', 'Mocks', 'Full-length timed mock exams mapped to SAA-C03 domains.', ARRAY['2 full-length timed mocks', 'Domain-weighted scoring', 'Explanations for every item', 'Weak-area report after each attempt']::text[], ARRAY['SAA-C03 domain coverage', 'Exam-day timer mode', 'Review mode with rationales', 'Progress saved to your account (coming soon)']::text[], NULL, NULL),
    ('aws-saa', 'practice', 'Practice question bank', 'Drill by domain with a curated SAA practice bank.', ARRAY['500+ practice items (stub catalog)', 'Filter by domain and difficulty', 'Instant feedback + explanations', 'Spaced review queue']::text[], ARRAY['Domain filters (secure / resilient / high-performing / cost)', 'Bookmark tough items', 'Daily drill streaks', 'Export weak topics to your study plan']::text[], NULL, NULL),
    ('aws-saa', 'notes', 'Notes / blueprint', 'Condensed notes and exam blueprint for AWS SAA.', ARRAY['Domain-by-domain study notes', 'Official-style blueprint map', 'Cheatsheets for VPC, IAM, storage', 'Last-week revision checklist']::text[], ARRAY['Printable PDF stubs', 'Architecture pattern callouts', 'Common trap questions called out', 'Links into practice by topic']::text[], NULL, NULL),
    ('aws-saa', 'labs', 'Labs', 'Guided hands-on labs aligned to SAA architectures.', ARRAY['6 guided lab scenarios (stub)', 'Step-by-step walkthroughs', 'Architecture diagrams', 'Cleanup checklists']::text[], ARRAY['VPC + multi-AZ patterns', 'S3 / CloudFront / WAF basics', 'IAM least-privilege drills', 'Cost-aware design labs']::text[], 'Fulfilled on SkillHub', 'https://skillhub365.co.in'),
    ('az-104', 'mock', 'Mocks', 'Full-length timed mock exams mapped to AZ-104 domains.', ARRAY['2 full-length timed mocks', 'Domain-weighted scoring', 'Explanations for every item', 'Weak-area report after each attempt']::text[], ARRAY['AZ-104 domain coverage', 'Exam-day timer mode', 'Review mode with rationales', 'Progress saved to your account (coming soon)']::text[], NULL, NULL),
    ('az-104', 'practice', 'Practice question bank', 'Drill by domain with a curated Azure Administrator practice bank.', ARRAY['500+ practice items (stub catalog)', 'Filter by domain and difficulty', 'Instant feedback + explanations', 'Spaced review queue']::text[], ARRAY['Domain filters (identity / storage / compute / networking / monitor)', 'Bookmark tough items', 'Daily drill streaks', 'Export weak topics to your study plan']::text[], NULL, NULL),
    ('az-104', 'notes', 'Notes / blueprint', 'Condensed notes and exam blueprint for AZ-104.', ARRAY['Domain-by-domain study notes', 'Official-style blueprint map', 'Cheatsheets for Entra ID, VNets, storage', 'Last-week revision checklist']::text[], ARRAY['Printable PDF stubs', 'Portal + CLI/PowerShell callouts', 'Common trap questions called out', 'Links into practice by topic']::text[], NULL, NULL),
    ('az-104', 'labs', 'Labs', 'Guided hands-on labs aligned to Azure admin workloads.', ARRAY['6 guided lab scenarios (stub)', 'Step-by-step walkthroughs', 'Architecture diagrams', 'Cleanup checklists']::text[], ARRAY['Identity & RBAC drills', 'Storage + backup patterns', 'VM / App Service compute labs', 'VNet + NSG networking labs']::text[], 'Fulfilled on SkillHub', 'https://skillhub365.co.in'),
    ('salesforce-admin', 'mock', 'Mocks', 'Full-length timed mock exams mapped to ADM-201 domains.', ARRAY['2 full-length timed mocks', 'Domain-weighted scoring', 'Explanations for every item', 'Weak-area report after each attempt']::text[], ARRAY['ADM-201 domain coverage', 'Exam-day timer mode', 'Review mode with rationales', 'Progress saved to your account (coming soon)']::text[], NULL, NULL),
    ('salesforce-admin', 'practice', 'Practice question bank', 'Drill by domain with a curated Salesforce Admin practice bank.', ARRAY['500+ practice items (stub catalog)', 'Filter by domain and difficulty', 'Instant feedback + explanations', 'Spaced review queue']::text[], ARRAY['Domain filters (setup / objects / sales / service / automation)', 'Bookmark tough items', 'Daily drill streaks', 'Export weak topics to your study plan']::text[], NULL, NULL),
    ('salesforce-admin', 'notes', 'Notes / blueprint', 'Condensed notes and exam blueprint for Salesforce Administrator.', ARRAY['Domain-by-domain study notes', 'Official-style blueprint map', 'Cheatsheets for Flows, sharing, reports', 'Last-week revision checklist']::text[], ARRAY['Printable PDF stubs', 'Lightning UI callouts', 'Common trap questions called out', 'Links into practice by topic']::text[], NULL, NULL),
    ('salesforce-admin', 'labs', 'Labs', 'Guided hands-on labs in a Salesforce org (sandbox-style stubs).', ARRAY['6 guided lab scenarios (stub)', 'Step-by-step walkthroughs', 'Org configuration diagrams', 'Cleanup checklists']::text[], ARRAY['Object & field setup drills', 'Flow automation labs', 'Sharing & permission sets', 'Reports & dashboards labs']::text[], 'Fulfilled on SkillHub', 'https://skillhub365.co.in'),
    ('gcp-ace', 'mock', 'Mocks', 'Full-length timed mock exams mapped to Associate Cloud Engineer domains.', ARRAY['2 full-length timed mocks', 'Domain-weighted scoring', 'Explanations for every item', 'Weak-area report after each attempt']::text[], ARRAY['ACE domain coverage', 'Exam-day timer mode', 'Review mode with rationales', 'Progress saved to your account (coming soon)']::text[], NULL, NULL),
    ('gcp-ace', 'practice', 'Practice question bank', 'Drill by domain with a curated GCP ACE practice bank.', ARRAY['500+ practice items (stub catalog)', 'Filter by domain and difficulty', 'Instant feedback + explanations', 'Spaced review queue']::text[], ARRAY['Domain filters (setup / planning / deploy / ops / security)', 'Bookmark tough items', 'Daily drill streaks', 'Export weak topics to your study plan']::text[], NULL, NULL),
    ('gcp-ace', 'notes', 'Notes / blueprint', 'Condensed notes and exam blueprint for GCP Associate Cloud Engineer.', ARRAY['Domain-by-domain study notes', 'Official-style blueprint map', 'Cheatsheets for IAM, GCE, GKE basics, networking', 'Last-week revision checklist']::text[], ARRAY['Printable PDF stubs', 'gcloud CLI callouts', 'Common trap questions called out', 'Links into practice by topic']::text[], NULL, NULL),
    ('gcp-ace', 'labs', 'Labs', 'Guided hands-on labs aligned to ACE operational tasks.', ARRAY['6 guided lab scenarios (stub)', 'Step-by-step walkthroughs', 'Architecture diagrams', 'Cleanup checklists']::text[], ARRAY['Project & IAM setup drills', 'Compute Engine deploy labs', 'VPC + firewall basics', 'Monitoring & ops labs']::text[], 'Fulfilled on SkillHub', 'https://skillhub365.co.in')
) AS v(cert_key, sku_type, title, blurb, includes, features, fulfilled_label, fulfilled_href)
JOIN public.marketplace_certs c ON c.key = v.cert_key
ON CONFLICT (cert_id, sku_type) DO NOTHING;