
-- Roles enum
create type public.app_role as enum ('learner', 'manager', 'admin');

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  headline text,
  country text,
  target_role text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.profiles to anon;
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "Profiles are viewable by everyone" on public.profiles for select using (true);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- User roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "Users can view own roles" on public.user_roles for select using (auth.uid() = user_id);
create policy "Admins can view all roles" on public.user_roles for select using (public.has_role(auth.uid(), 'admin'));

-- Auto-create profile + default learner role on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  insert into public.user_roles (user_id, role) values (new.id, 'learner');
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- updated_at trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

-- User certifications (preparation tracker)
create type public.cert_status as enum ('planned', 'studying', 'scheduled', 'passed', 'failed');

create table public.user_certifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  certification_slug text not null,
  status public.cert_status not null default 'planned',
  target_date date,
  study_hours numeric not null default 0,
  mock_score numeric,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, certification_slug)
);
grant select, insert, update, delete on public.user_certifications to authenticated;
grant all on public.user_certifications to service_role;
alter table public.user_certifications enable row level security;
create policy "Users manage own certs" on public.user_certifications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create trigger user_certifications_touch before update on public.user_certifications for each row execute function public.touch_updated_at();

-- Bookmarks
create table public.user_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  certification_slug text not null,
  created_at timestamptz not null default now(),
  unique (user_id, certification_slug)
);
grant select, insert, delete on public.user_bookmarks to authenticated;
grant all on public.user_bookmarks to service_role;
alter table public.user_bookmarks enable row level security;
create policy "Users manage own bookmarks" on public.user_bookmarks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
