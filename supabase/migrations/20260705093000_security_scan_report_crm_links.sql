-- Connect Phoenix security reports to the CRM flow.
-- Safe to run multiple times. Does not delete or rewrite existing scan data.

create extension if not exists pgcrypto;

create table if not exists public.security_scan_reports (
  id uuid primary key default gen_random_uuid(),
  domain text not null,
  score integer,
  grade text,
  report jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now()
);

alter table public.security_scan_reports add column if not exists customer_id uuid;
alter table public.security_scan_reports add column if not exists request_id uuid;
alter table public.security_scan_reports add column if not exists lead_id uuid;
alter table public.security_scan_reports add column if not exists domain text;
alter table public.security_scan_reports add column if not exists score integer;
alter table public.security_scan_reports add column if not exists grade text;
alter table public.security_scan_reports add column if not exists report jsonb not null default '{}'::jsonb;
alter table public.security_scan_reports add column if not exists created_by text;
alter table public.security_scan_reports add column if not exists created_at timestamptz not null default now();

do $$
begin
  if to_regclass('public.customers') is not null and not exists (
    select 1 from pg_constraint where conname = 'security_scan_reports_customer_id_fkey'
  ) then
    alter table public.security_scan_reports
      add constraint security_scan_reports_customer_id_fkey
      foreign key (customer_id) references public.customers(id) on delete set null;
  end if;

  if to_regclass('public.requests') is not null and not exists (
    select 1 from pg_constraint where conname = 'security_scan_reports_request_id_fkey'
  ) then
    alter table public.security_scan_reports
      add constraint security_scan_reports_request_id_fkey
      foreign key (request_id) references public.requests(id) on delete set null;
  end if;

  if to_regclass('public.leads') is not null and not exists (
    select 1 from pg_constraint where conname = 'security_scan_reports_lead_id_fkey'
  ) then
    alter table public.security_scan_reports
      add constraint security_scan_reports_lead_id_fkey
      foreign key (lead_id) references public.leads(id) on delete set null;
  end if;
end $$;

do $$
begin
  if to_regclass('public.tasks') is not null then
    alter table public.tasks add column if not exists security_report_id uuid;
    alter table public.tasks add column if not exists security_finding_id text;
  end if;

  if to_regclass('public.security_scan_reports') is not null and not exists (
    select 1 from pg_constraint where conname = 'tasks_security_report_id_fkey'
  ) and to_regclass('public.tasks') is not null then
    alter table public.tasks
      add constraint tasks_security_report_id_fkey
      foreign key (security_report_id) references public.security_scan_reports(id) on delete set null;
  end if;
end $$;

do $$
begin
  if to_regclass('public.quotes') is not null then
    alter table public.quotes add column if not exists security_report_id uuid;
    alter table public.quotes add column if not exists security_finding_id text;
  end if;

  if to_regclass('public.security_scan_reports') is not null and not exists (
    select 1 from pg_constraint where conname = 'quotes_security_report_id_fkey'
  ) and to_regclass('public.quotes') is not null then
    alter table public.quotes
      add constraint quotes_security_report_id_fkey
      foreign key (security_report_id) references public.security_scan_reports(id) on delete set null;
  end if;
end $$;

create index if not exists idx_security_scan_reports_customer_id on public.security_scan_reports(customer_id);
create index if not exists idx_security_scan_reports_request_id on public.security_scan_reports(request_id);
create index if not exists idx_security_scan_reports_lead_id on public.security_scan_reports(lead_id);
create index if not exists idx_security_scan_reports_score on public.security_scan_reports(score);

do $$
begin
  if to_regclass('public.tasks') is not null then
    create index if not exists idx_tasks_security_report_id on public.tasks(security_report_id);
  end if;

  if to_regclass('public.quotes') is not null then
    create index if not exists idx_quotes_security_report_id on public.quotes(security_report_id);
  end if;
end $$;
