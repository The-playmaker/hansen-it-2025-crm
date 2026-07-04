-- Phoenix Scan report sharing and delivery log.

create extension if not exists pgcrypto;

create table if not exists public.security_scan_report_shares (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.security_scan_reports(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  last_accessed_at timestamptz
);

create table if not exists public.security_scan_report_deliveries (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.security_scan_reports(id) on delete cascade,
  share_id uuid references public.security_scan_report_shares(id) on delete set null,
  recipient_email text not null,
  subject text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_security_scan_report_shares_report_id
  on public.security_scan_report_shares(report_id);

create index if not exists idx_security_scan_report_shares_token
  on public.security_scan_report_shares(token);

create index if not exists idx_security_scan_report_deliveries_report_id
  on public.security_scan_report_deliveries(report_id);
