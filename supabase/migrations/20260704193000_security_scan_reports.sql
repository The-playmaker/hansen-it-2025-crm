-- Project Phoenix Security Scan module
-- Stores passive domain security reports inside the CRM Supabase database.

create table if not exists public.security_scan_reports (
  id uuid primary key default gen_random_uuid(),
  domain text not null,
  score integer not null,
  grade text not null,
  report jsonb not null,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists idx_security_scan_reports_domain
  on public.security_scan_reports(domain);

create index if not exists idx_security_scan_reports_created_at
  on public.security_scan_reports(created_at desc);
