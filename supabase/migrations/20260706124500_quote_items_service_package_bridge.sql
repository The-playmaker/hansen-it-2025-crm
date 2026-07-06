-- Project Phoenix: bridge service packages into the current quote flow.
-- Existing admin quotes are request-based, while newer CRM quotes use public.quotes.
-- This migration lets quote_items support both without deleting old data.

create table if not exists public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid,
  request_id uuid,
  service_package_id uuid,
  item_type text not null default 'custom',
  title text,
  description text,
  quantity numeric(12,2) not null default 1,
  unit text not null default 'stk',
  unit_price numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  vat_rate numeric(5,2) not null default 25,
  line_total_ex_vat numeric(12,2) not null default 0,
  line_total numeric(12,2) not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.quote_items add column if not exists request_id uuid;
alter table public.quote_items add column if not exists service_package_id uuid;
alter table public.quote_items add column if not exists item_type text not null default 'custom';
alter table public.quote_items add column if not exists title text;
alter table public.quote_items add column if not exists unit text not null default 'stk';
alter table public.quote_items add column if not exists line_total numeric(12,2) not null default 0;
alter table public.quote_items add column if not exists sort_order integer not null default 0;
alter table public.quote_items add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'requests') then
    alter table public.quote_items
      add constraint quote_items_request_id_fkey
      foreign key (request_id) references public.requests(id) on delete cascade;
  end if;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'service_packages') then
    alter table public.quote_items
      add constraint quote_items_service_package_id_fkey
      foreign key (service_package_id) references public.service_packages(id) on delete set null;
  end if;
exception
  when duplicate_object then null;
end $$;

update public.quote_items
set
  title = coalesce(title, nullif(split_part(description, ':', 1), ''), description, 'Tilbudslinje'),
  line_total = case
    when line_total > 0 then line_total
    when line_total_ex_vat > 0 then round(line_total_ex_vat * (1 + coalesce(vat_rate, 25) / 100), 2)
    else round((coalesce(quantity, 1) * coalesce(unit_price, 0)) * (1 + coalesce(vat_rate, 25) / 100), 2)
  end,
  item_type = coalesce(nullif(item_type, ''), case when service_package_id is not null then 'package' else 'custom' end),
  updated_at = now();

create index if not exists idx_quote_items_request_id on public.quote_items(request_id);
create index if not exists idx_quote_items_service_package_id on public.quote_items(service_package_id);
create index if not exists idx_quote_items_item_type on public.quote_items(item_type);
