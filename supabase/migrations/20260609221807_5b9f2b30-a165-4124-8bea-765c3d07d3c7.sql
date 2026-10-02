
-- ORG TABLES
create type public.org_role as enum ('exec','hr','manager','lnd','learner');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  industry text,
  size_band text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.organizations to authenticated;
grant all on public.organizations to service_role;
alter table public.organizations enable row level security;

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid,
  full_name text,
  email text,
  team text,
  title text,
  role public.org_role not null default 'learner',
  created_at timestamptz not null default now()
);
create unique index org_members_user_uniq on public.organization_members(org_id, user_id) where user_id is not null;
grant select, insert, update, delete on public.organization_members to authenticated;
grant all on public.organization_members to service_role;
alter table public.organization_members enable row level security;

create or replace function public.is_org_member(_org uuid, _user uuid, _roles public.org_role[] default null)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where org_id = _org and user_id = _user
      and (_roles is null or role = any(_roles))
  )
$$;

create policy "Members view their orgs" on public.organizations
  for select using (public.is_org_member(id, auth.uid()));
create policy "Anyone can create org" on public.organizations
  for insert with check (auth.uid() = created_by);
create policy "Execs/HR update org" on public.organizations
  for update using (public.is_org_member(id, auth.uid(), array['exec','hr']::public.org_role[]));

create policy "Members view org members" on public.organization_members
  for select using (public.is_org_member(org_id, auth.uid()));
create policy "Execs/HR manage members" on public.organization_members
  for all using (public.is_org_member(org_id, auth.uid(), array['exec','hr']::public.org_role[]))
  with check (public.is_org_member(org_id, auth.uid(), array['exec','hr']::public.org_role[]));
create policy "User can self-join" on public.organization_members
  for insert with check (user_id = auth.uid());

-- WORKFORCE CERTIFICATIONS (separate from user_certifications to allow demo/non-auth members)
create table public.workforce_certifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  member_id uuid not null references public.organization_members(id) on delete cascade,
  certification_slug text not null,
  status text not null default 'studying' check (status in ('planned','studying','passed','failed','expired')),
  obtained_on date,
  expires_at date,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.workforce_certifications to authenticated;
grant all on public.workforce_certifications to service_role;
alter table public.workforce_certifications enable row level security;
create policy "Org leaders view workforce certs" on public.workforce_certifications
  for select using (public.is_org_member(org_id, auth.uid(), array['exec','hr','manager','lnd']::public.org_role[]));
create policy "Org leaders manage workforce certs" on public.workforce_certifications
  for all using (public.is_org_member(org_id, auth.uid(), array['exec','hr','lnd']::public.org_role[]))
  with check (public.is_org_member(org_id, auth.uid(), array['exec','hr','lnd']::public.org_role[]));

-- REMINDERS
create table public.milestone_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  milestone_id uuid references public.study_milestones(id) on delete cascade,
  user_certification_id uuid references public.user_certifications(id) on delete cascade,
  title text not null,
  body text,
  channel text not null default 'in_app' check (channel in ('in_app','email')),
  remind_at timestamptz not null,
  sent_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.milestone_reminders to authenticated;
grant all on public.milestone_reminders to service_role;
alter table public.milestone_reminders enable row level security;
create policy "Users manage own reminders" on public.milestone_reminders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index reminders_due_idx on public.milestone_reminders (user_id, remind_at) where dismissed_at is null;

create or replace function public.auto_milestone_reminder()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.due_date is not null and (tg_op = 'INSERT' or old.due_date is distinct from new.due_date) then
    delete from public.milestone_reminders where milestone_id = new.id and sent_at is null;
    insert into public.milestone_reminders (user_id, milestone_id, user_certification_id, title, body, remind_at, channel)
    values (
      new.user_id, new.id, new.user_certification_id,
      'Upcoming: ' || new.title,
      'Due ' || new.due_date::text,
      (new.due_date - interval '3 days')::timestamptz,
      'in_app'
    );
  end if;
  return new;
end $$;
create trigger trg_auto_milestone_reminder
  after insert or update of due_date on public.study_milestones
  for each row execute function public.auto_milestone_reminder();

-- MOCK EXAM RESULTS
create table public.mock_exam_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  user_certification_id uuid references public.user_certifications(id) on delete cascade,
  certification_slug text not null,
  score numeric not null check (score >= 0 and score <= 100),
  passing_score numeric not null default 70,
  taken_at timestamptz not null default now(),
  duration_minutes integer,
  provider text,
  notes text,
  domain_scores jsonb,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.mock_exam_results to authenticated;
grant all on public.mock_exam_results to service_role;
alter table public.mock_exam_results enable row level security;
create policy "Users manage own mocks" on public.mock_exam_results
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index mocks_recent_idx on public.mock_exam_results (user_id, taken_at desc);

-- AI FEEDBACK
create table public.ai_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  feature text not null check (feature in ('career_advisor','pass_predictor','milestone','next_cert')),
  target_id text,
  target_payload jsonb,
  rating smallint not null check (rating in (-1, 1, 2, 3, 4, 5)),
  comment text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.ai_feedback to authenticated;
grant all on public.ai_feedback to service_role;
alter table public.ai_feedback enable row level security;
create policy "Users manage own feedback" on public.ai_feedback
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index feedback_recent_idx on public.ai_feedback (user_id, feature, created_at desc);

create trigger trg_orgs_updated before update on public.organizations
  for each row execute function public.touch_updated_at();

-- SEED DEMO ORG
insert into public.organizations (id, name, slug, industry, size_band)
values ('00000000-0000-0000-0000-00000000d000', 'Skylark Industries', 'skylark-demo', 'Cloud Software', '500-1000');

with seeded_members as (
  insert into public.organization_members (org_id, full_name, email, team, title, role)
  select '00000000-0000-0000-0000-00000000d000', full_name, email, team, title, role::public.org_role
  from (values
    ('Aiko Tanaka','aiko@skylark.test','Platform','Staff Engineer','manager'),
    ('Diego Ramos','diego@skylark.test','Platform','Senior SRE','learner'),
    ('Priya Shah','priya@skylark.test','Platform','Cloud Engineer','learner'),
    ('Noah Becker','noah@skylark.test','Platform','DevOps Engineer','learner'),
    ('Lena Park','lena@skylark.test','Data','Data Engineer','learner'),
    ('Marcus Hill','marcus@skylark.test','Data','ML Engineer','learner'),
    ('Sofia Romano','sofia@skylark.test','Data','Analytics Lead','manager'),
    ('Yusuf Adel','yusuf@skylark.test','Security','Security Analyst','learner'),
    ('Hana Kim','hana@skylark.test','Security','CISO','exec'),
    ('Jonas Vidal','jonas@skylark.test','Security','AppSec Engineer','learner'),
    ('Eve Martin','eve@skylark.test','Product','PM','learner'),
    ('Owen Wright','owen@skylark.test','Product','Designer','learner'),
    ('Sara Cohen','sara@skylark.test','HR','People Ops','hr'),
    ('Theo Laurent','theo@skylark.test','HR','L&D Lead','lnd'),
    ('Mira Singh','mira@skylark.test','Engineering','VP Eng','exec'),
    ('Jordan Reed','jordan@skylark.test','Engineering','Engineer','learner'),
    ('Kenji Watanabe','kenji@skylark.test','Engineering','Engineer','learner'),
    ('Luca Bianchi','luca@skylark.test','Engineering','Architect','manager'),
    ('Ava Brooks','ava@skylark.test','Engineering','Engineer','learner'),
    ('Henrik Olsen','henrik@skylark.test','Sales','Solutions Engineer','learner'),
    ('Maya Patel','maya@skylark.test','Sales','SE','learner'),
    ('Tomas Vega','tomas@skylark.test','Support','Support Eng','learner'),
    ('Zoe Fischer','zoe@skylark.test','Support','TAM','learner'),
    ('Ravi Iyer','ravi@skylark.test','Platform','Engineer','learner'),
    ('Nora West','nora@skylark.test','Platform','Engineer','learner')
  ) as t(full_name,email,team,title,role)
  returning id, org_id
)
insert into public.workforce_certifications (org_id, member_id, certification_slug, status, obtained_on, expires_at)
select org_id, id, slug, status, obtained, expires
from seeded_members
cross join lateral (
  select * from (values
    ('aws-solutions-architect-associate','passed', (now() - interval '120 days')::date, (now() + (random()*400 - 30) * interval '1 day')::date),
    ('azure-administrator-az-104','studying', null::date, null::date),
    ('cissp','passed', (now() - interval '300 days')::date, (now() + (random()*200 - 60) * interval '1 day')::date),
    ('pmp','studying', null::date, null::date),
    ('gcp-professional-cloud-architect','passed', (now() - interval '60 days')::date, (now() + (random()*500 - 30) * interval '1 day')::date)
  ) as v(slug,status,obtained,expires)
  where random() < 0.45
) seed;
