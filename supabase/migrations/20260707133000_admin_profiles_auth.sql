create table if not exists public.admin_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  role text not null default 'viewer',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_profiles
  add column if not exists email text,
  add column if not exists name text,
  add column if not exists role text not null default 'viewer',
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'admin_profiles_role_check'
      and conrelid = 'public.admin_profiles'::regclass
  ) then
    alter table public.admin_profiles drop constraint admin_profiles_role_check;
  end if;

  alter table public.admin_profiles
    add constraint admin_profiles_role_check
    check (role in ('owner', 'admin', 'employee', 'viewer'));
end $$;

create index if not exists idx_admin_profiles_email on public.admin_profiles (lower(email));
create index if not exists idx_admin_profiles_role on public.admin_profiles (role);

insert into public.admin_profiles (id, email, name, role, is_active)
select
  id,
  email,
  coalesce(raw_user_meta_data->>'name', 'Flemming Hansen'),
  'owner',
  true
from auth.users
where lower(email) = lower('flemming@hansen-it.com')
on conflict (id) do update
set
  email = excluded.email,
  name = coalesce(public.admin_profiles.name, excluded.name),
  role = 'owner',
  is_active = true,
  updated_at = now();
