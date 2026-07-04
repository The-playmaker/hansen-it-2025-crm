-- Phoenix Scan authorization flow
-- Requires signed customer authorization before queued scan jobs are created.

create extension if not exists pgcrypto;

create table if not exists public.scan_authorizations (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  customer_id uuid references public.customers(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  customer_name text not null,
  signer_name text,
  signer_email text not null,
  signer_role text,
  status text not null default 'pending' check (status in ('draft', 'pending', 'signed', 'revoked', 'expired')),
  terms_version text not null default 'phoenix-scan-v1',
  terms_text text not null,
  signed_at timestamptz,
  signed_ip text,
  signature_data jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz
);

create table if not exists public.scan_scopes (
  id uuid primary key default gen_random_uuid(),
  authorization_id uuid not null references public.scan_authorizations(id) on delete cascade,
  scan_type text not null default 'passive' check (scan_type in ('passive', 'standard', 'extended')),
  domains text[] not null default '{}',
  ip_addresses text[] not null default '{}',
  allowed_checks jsonb not null default '[]'::jsonb,
  exclusions text,
  notes text,
  confirmed_by_customer boolean not null default false,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scan_jobs (
  id uuid primary key default gen_random_uuid(),
  authorization_id uuid not null references public.scan_authorizations(id) on delete restrict,
  scope_id uuid references public.scan_scopes(id) on delete set null,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  scan_type text not null,
  domains text[] not null default '{}',
  ip_addresses text[] not null default '{}',
  requested_by_name text,
  requested_by_email text,
  requested_by_role text,
  requested_ip text,
  queued_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  error text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.scan_results (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.scan_jobs(id) on delete cascade,
  authorization_id uuid references public.scan_authorizations(id) on delete set null,
  status text not null default 'created',
  summary text,
  raw_result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.scan_findings (
  id uuid primary key default gen_random_uuid(),
  result_id uuid references public.scan_results(id) on delete cascade,
  job_id uuid references public.scan_jobs(id) on delete cascade,
  authorization_id uuid references public.scan_authorizations(id) on delete set null,
  title text not null,
  description text,
  severity text not null default 'medium' check (severity in ('critical', 'high', 'medium', 'low', 'info')),
  category text,
  recommendation text,
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'accepted_risk', 'fixed', 'false_positive')),
  created_at timestamptz not null default now()
);

create table if not exists public.scan_reports (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.scan_jobs(id) on delete set null,
  authorization_id uuid references public.scan_authorizations(id) on delete set null,
  title text not null,
  report jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create index if not exists idx_scan_authorizations_token on public.scan_authorizations(token);
create index if not exists idx_scan_authorizations_status on public.scan_authorizations(status);
create index if not exists idx_scan_scopes_authorization_id on public.scan_scopes(authorization_id);
create index if not exists idx_scan_jobs_authorization_id on public.scan_jobs(authorization_id);
create index if not exists idx_scan_jobs_status on public.scan_jobs(status);
create index if not exists idx_scan_results_job_id on public.scan_results(job_id);
create index if not exists idx_scan_findings_job_id on public.scan_findings(job_id);
create index if not exists idx_scan_reports_authorization_id on public.scan_reports(authorization_id);
