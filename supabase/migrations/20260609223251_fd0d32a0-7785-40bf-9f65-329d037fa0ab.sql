
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'UTC';

CREATE OR REPLACE FUNCTION public.auto_milestone_reminder()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  tz text;
  remind_local timestamp;
begin
  if new.due_date is not null and (tg_op = 'INSERT' or old.due_date is distinct from new.due_date) then
    select coalesce(timezone, 'UTC') into tz from public.profiles where id = new.user_id;
    if tz is null or tz = '' then tz := 'UTC'; end if;
    -- 9:00 local time, 3 days before the due date
    remind_local := ((new.due_date - interval '3 days')::date)::timestamp + interval '9 hours';
    delete from public.milestone_reminders where milestone_id = new.id and sent_at is null;
    insert into public.milestone_reminders (user_id, milestone_id, user_certification_id, title, body, remind_at, channel)
    values (
      new.user_id, new.id, new.user_certification_id,
      'Upcoming: ' || new.title,
      'Due ' || new.due_date::text,
      (remind_local AT TIME ZONE tz),
      'in_app'
    );
  end if;
  return new;
end $$;

CREATE OR REPLACE FUNCTION public.create_organization(_name text, _slug text, _industry text DEFAULT NULL, _size_band text DEFAULT NULL)
RETURNS TABLE(id uuid, slug text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  new_id uuid;
  new_slug text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  insert into public.organizations (name, slug, industry, size_band, created_by)
  values (_name, _slug, _industry, _size_band, auth.uid())
  returning organizations.id, organizations.slug into new_id, new_slug;
  insert into public.organization_members (org_id, user_id, role)
  values (new_id, auth.uid(), 'exec');
  return query select new_id, new_slug;
end $$;

CREATE OR REPLACE FUNCTION public.join_demo_organization()
RETURNS TABLE(slug text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  d_id uuid;
  d_slug text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select organizations.id, organizations.slug into d_id, d_slug
    from public.organizations where organizations.slug = 'skylark-demo';
  if d_id is null then raise exception 'Demo workspace is being prepared. Please try again shortly.'; end if;
  insert into public.organization_members (org_id, user_id, role)
  values (d_id, auth.uid(), 'exec')
  on conflict (org_id, user_id) do nothing;
  return query select d_slug;
end $$;

GRANT EXECUTE ON FUNCTION public.create_organization(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_demo_organization() TO authenticated;
