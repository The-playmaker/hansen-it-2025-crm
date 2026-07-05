-- Portal document visibility alias and combined scan report support.

create extension if not exists pgcrypto;

create table if not exists public.quote_documents (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid references public.requests(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  request_id uuid references public.requests(id) on delete set null,
  type text not null default 'quote_pdf',
  filename text not null,
  mime_type text not null default 'application/pdf',
  storage_path text not null,
  visible_in_portal boolean not null default true,
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

alter table public.quote_documents
  add column if not exists is_portal_visible boolean not null default true;

update public.quote_documents
set is_portal_visible = visible_in_portal
where visible_in_portal is not null;

alter table public.scan_reports
  add column if not exists report_type text not null default 'domain';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'scan_reports_report_type_check'
  ) then
    alter table public.scan_reports
      add constraint scan_reports_report_type_check
      check (report_type in ('domain', 'combined'));
  end if;
end $$;

create index if not exists idx_scan_reports_report_type on public.scan_reports(report_type);
create index if not exists idx_scan_reports_authorization_type on public.scan_reports(authorization_id, report_type);
create index if not exists idx_quote_documents_quote_id on public.quote_documents(quote_id);
create index if not exists idx_quote_documents_customer_id on public.quote_documents(customer_id);
create index if not exists idx_quote_documents_request_id on public.quote_documents(request_id);
