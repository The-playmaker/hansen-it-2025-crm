-- Project Phoenix core data model
-- Creates CRM core tables without changing Casdoor tables.
-- Existing tables intentionally reused: requests, services, employees and quote_*.

create extension if not exists pgcrypto;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  organization_number text,
  customer_type text,
  status text not null default 'lead' check (status in ('lead', 'active', 'inactive')),
  phone text,
  email text,
  website text,
  address text,
  postal_code text,
  city text,
  country text default 'Norge',
  notes text,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  name text not null,
  role text,
  email text,
  phone text,
  is_primary boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  request_id uuid references public.requests(id) on delete set null,
  service_id uuid references public.services(id) on delete set null,
  owner_employee_id bigint references public.employees(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'planned' check (status in ('planned', 'active', 'waiting', 'completed', 'cancelled')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  start_date date,
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  name text not null,
  address text,
  postal_code text,
  city text,
  country text default 'Norge',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  name text not null,
  asset_type text,
  vendor text,
  model text,
  serial_number text,
  status text not null default 'active' check (status in ('active', 'inactive', 'retired', 'unknown')),
  purchase_date date,
  warranty_expires_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  project_id uuid references public.projects(id) on delete cascade,
  request_id uuid references public.requests(id) on delete set null,
  assigned_employee_id bigint references public.employees(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'new' check (status in ('new', 'in_progress', 'waiting_customer', 'done', 'cancelled')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  request_id uuid references public.requests(id) on delete set null,
  employee_id bigint references public.employees(id) on delete set null,
  activity_type text not null,
  title text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.requests
  add column if not exists customer_id uuid references public.customers(id) on delete set null;

alter table public.requests
  add column if not exists converted_at timestamptz;

alter table public.requests
  add column if not exists converted_to_customer boolean not null default false;

create index if not exists idx_customer_contacts_customer_id
  on public.customer_contacts(customer_id);

create index if not exists idx_projects_customer_id
  on public.projects(customer_id);

create index if not exists idx_tasks_customer_id
  on public.tasks(customer_id);

create index if not exists idx_tasks_project_id
  on public.tasks(project_id);

create index if not exists idx_requests_customer_id
  on public.requests(customer_id);

create index if not exists idx_assets_customer_id
  on public.assets(customer_id);

create index if not exists idx_locations_customer_id
  on public.locations(customer_id);
