-- Project Phoenix quote portal documents.
-- quote_documents is the source of truth for customer-visible quote portal files.

create table if not exists public.quote_documents (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid,
  customer_id uuid,
  request_id uuid,
  scan_report_id uuid,
  scan_job_id uuid,
  authorization_id uuid,
  type text not null default 'attachment',
  title text not null default 'Dokument',
  filename text not null,
  mime_type text not null default 'application/pdf',
  storage_path text,
  external_url text,
  visible_in_portal boolean not null default false,
  is_portal_visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public)
values ('phoenix-documents', 'phoenix-documents', false)
on conflict (id) do update set public = false;

alter table public.quote_documents add column if not exists quote_id uuid;
alter table public.quote_documents add column if not exists customer_id uuid;
alter table public.quote_documents add column if not exists request_id uuid;
alter table public.quote_documents add column if not exists scan_report_id uuid;
alter table public.quote_documents add column if not exists scan_job_id uuid;
alter table public.quote_documents add column if not exists authorization_id uuid;
alter table public.quote_documents add column if not exists type text not null default 'attachment';
alter table public.quote_documents add column if not exists title text not null default 'Dokument';
alter table public.quote_documents add column if not exists filename text not null default 'dokument.pdf';
alter table public.quote_documents add column if not exists mime_type text not null default 'application/pdf';
alter table public.quote_documents add column if not exists storage_path text;
alter table public.quote_documents add column if not exists external_url text;
alter table public.quote_documents add column if not exists visible_in_portal boolean not null default false;
alter table public.quote_documents add column if not exists is_portal_visible boolean not null default false;
alter table public.quote_documents add column if not exists created_at timestamptz not null default now();
alter table public.quote_documents add column if not exists updated_at timestamptz not null default now();

update public.quote_documents
set
  is_portal_visible = coalesce(is_portal_visible, visible_in_portal, false),
  visible_in_portal = coalesce(visible_in_portal, is_portal_visible, false),
  title = case
    when nullif(title, '') is not null then title
    when type = 'quote_pdf' then 'Tilbud fra Hansen IT'
    when type in ('security_report_pdf', 'scan_combined_pdf') then 'Samlet sikkerhetsrapport'
    when type = 'scan_domain_pdf' then 'Teknisk rapport'
    else coalesce(filename, 'Dokument')
  end,
  updated_at = now();

alter table public.quote_documents drop constraint if exists quote_documents_quote_id_fkey;
alter table public.quote_documents drop constraint if exists quote_documents_quote_id_requests_fkey;

do $$
begin
  if to_regclass('public.customers') is not null then
    alter table public.quote_documents
      add constraint quote_documents_customer_id_fkey
      foreign key (customer_id) references public.customers(id) on delete set null;
  end if;
exception when duplicate_object then null;
end $$;

do $$
begin
  if to_regclass('public.scan_reports') is not null then
    alter table public.quote_documents
      add constraint quote_documents_scan_report_id_fkey
      foreign key (scan_report_id) references public.scan_reports(id) on delete set null;
  end if;
exception when duplicate_object then null;
end $$;

create index if not exists idx_quote_documents_quote_id on public.quote_documents(quote_id);
create index if not exists idx_quote_documents_customer_id on public.quote_documents(customer_id);
create index if not exists idx_quote_documents_request_id on public.quote_documents(request_id);
create index if not exists idx_quote_documents_scan_report_id on public.quote_documents(scan_report_id);
create index if not exists idx_quote_documents_scan_job_id on public.quote_documents(scan_job_id);
create index if not exists idx_quote_documents_authorization_id on public.quote_documents(authorization_id);
create index if not exists idx_quote_documents_portal_visible on public.quote_documents(is_portal_visible);
create index if not exists idx_quote_documents_type on public.quote_documents(type);
