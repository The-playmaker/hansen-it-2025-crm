-- Customer Portal v2 documents and invoice foundation.

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

create index if not exists idx_quote_documents_quote_id on public.quote_documents(quote_id);
create index if not exists idx_quote_documents_customer_id on public.quote_documents(customer_id);
create index if not exists idx_quote_documents_request_id on public.quote_documents(request_id);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  quote_id uuid references public.requests(id) on delete set null,
  request_id uuid references public.requests(id) on delete set null,
  invoice_number text,
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  subtotal numeric(12,2) not null default 0,
  vat_rate numeric(5,2) not null default 25,
  vat_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  quantity numeric(12,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  vat_rate numeric(5,2) not null default 25,
  line_total numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_invoices_customer_id on public.invoices(customer_id);
create index if not exists idx_invoices_quote_id on public.invoices(quote_id);
create index if not exists idx_invoice_items_invoice_id on public.invoice_items(invoice_id);

alter table public.requests add column if not exists approved_at timestamptz;
alter table public.requests add column if not exists changes_requested_at timestamptz;
