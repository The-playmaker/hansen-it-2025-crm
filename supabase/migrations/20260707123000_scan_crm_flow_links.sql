-- Phoenix CRM flow links for scan authorization -> report -> quote -> portal.
-- Safe to run multiple times. Does not delete data.

alter table public.scan_authorizations
  add column if not exists customer_id uuid references public.customers(id) on delete set null;

alter table public.scan_authorizations
  add column if not exists contact_id uuid references public.contacts(id) on delete set null;

alter table public.scan_authorizations
  add column if not exists request_id uuid references public.requests(id) on delete set null;

alter table public.scan_authorizations
  add column if not exists quote_id uuid references public.quotes(id) on delete set null;

alter table public.scan_authorizations
  add column if not exists lead_id uuid references public.leads(id) on delete set null;

alter table public.scan_jobs
  add column if not exists customer_id uuid references public.customers(id) on delete set null;

alter table public.scan_jobs
  add column if not exists contact_id uuid references public.contacts(id) on delete set null;

alter table public.scan_jobs
  add column if not exists request_id uuid references public.requests(id) on delete set null;

alter table public.scan_jobs
  add column if not exists quote_id uuid references public.quotes(id) on delete set null;

alter table public.scan_jobs
  add column if not exists lead_id uuid references public.leads(id) on delete set null;

alter table public.scan_reports
  add column if not exists customer_id uuid references public.customers(id) on delete set null;

alter table public.scan_reports
  add column if not exists contact_id uuid references public.contacts(id) on delete set null;

alter table public.scan_reports
  add column if not exists request_id uuid references public.requests(id) on delete set null;

alter table public.scan_reports
  add column if not exists quote_id uuid references public.quotes(id) on delete set null;

alter table public.scan_reports
  add column if not exists lead_id uuid references public.leads(id) on delete set null;

alter table public.scan_results
  add column if not exists customer_id uuid references public.customers(id) on delete set null;

alter table public.scan_results
  add column if not exists request_id uuid references public.requests(id) on delete set null;

alter table public.quotes
  add column if not exists scan_report_id uuid references public.scan_reports(id) on delete set null;

alter table public.quote_documents
  add column if not exists scan_report_id uuid;

create index if not exists idx_scan_authorizations_customer_id on public.scan_authorizations(customer_id);
create index if not exists idx_scan_authorizations_contact_id on public.scan_authorizations(contact_id);
create index if not exists idx_scan_authorizations_request_id on public.scan_authorizations(request_id);
create index if not exists idx_scan_authorizations_quote_id on public.scan_authorizations(quote_id);
create index if not exists idx_scan_authorizations_lead_id on public.scan_authorizations(lead_id);

create index if not exists idx_scan_jobs_customer_id on public.scan_jobs(customer_id);
create index if not exists idx_scan_jobs_request_id on public.scan_jobs(request_id);
create index if not exists idx_scan_jobs_quote_id on public.scan_jobs(quote_id);

create index if not exists idx_scan_results_customer_id on public.scan_results(customer_id);
create index if not exists idx_scan_results_request_id on public.scan_results(request_id);

create index if not exists idx_scan_reports_customer_id on public.scan_reports(customer_id);
create index if not exists idx_scan_reports_request_id on public.scan_reports(request_id);
create index if not exists idx_scan_reports_quote_id on public.scan_reports(quote_id);
create index if not exists idx_scan_reports_lead_id on public.scan_reports(lead_id);

create index if not exists idx_quotes_scan_report_id on public.quotes(scan_report_id);
