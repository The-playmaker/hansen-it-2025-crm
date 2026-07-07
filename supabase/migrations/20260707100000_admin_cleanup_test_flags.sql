-- Safe cleanup support. These flags are used by admin-only cleanup tools.

alter table public.requests add column if not exists is_test boolean not null default false;
alter table public.leads add column if not exists is_test boolean not null default false;
alter table public.quotes add column if not exists is_test boolean not null default false;
alter table public.quote_items add column if not exists is_test boolean not null default false;
alter table public.quote_documents add column if not exists is_test boolean not null default false;
alter table public.quote_messages add column if not exists is_test boolean not null default false;
alter table public.security_scan_reports add column if not exists is_test boolean not null default false;
alter table public.scan_jobs add column if not exists is_test boolean not null default false;
alter table public.quote_portal_tokens add column if not exists is_test boolean not null default false;
alter table public.invoices add column if not exists is_test boolean not null default false;
alter table public.invoice_items add column if not exists is_test boolean not null default false;
