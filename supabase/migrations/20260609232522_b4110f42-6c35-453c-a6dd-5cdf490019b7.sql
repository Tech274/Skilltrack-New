
-- Extend app_role enum with admin sub-roles
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'content_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'finance_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'support_admin';
