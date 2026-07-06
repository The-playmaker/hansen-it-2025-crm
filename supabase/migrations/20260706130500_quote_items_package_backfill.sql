-- Repair legacy quote_items package lines.
-- line_total_ex_vat is standardized as ex. VAT.
-- line_total is standardized as incl. VAT.

alter table public.quote_items
  add column if not exists service_package_id uuid;

alter table public.quote_items
  add column if not exists metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if to_regclass('public.service_packages') is not null then
    alter table public.quote_items
      add constraint quote_items_service_package_id_fkey
      foreign key (service_package_id) references public.service_packages(id) on delete set null;
  end if;
exception when duplicate_object then null;
end $$;

alter table public.quote_items
  add column if not exists line_total numeric(12,2) not null default 0;

update public.quote_items qi
set
  service_package_id = sp.id,
  item_type = coalesce(nullif(qi.item_type, ''), 'package'),
  title = coalesce(qi.title, sp.name),
  description = coalesce(nullif(qi.description, ''), sp.short_description),
  metadata = coalesce(qi.metadata, '{}'::jsonb)
    || jsonb_build_object(
      'package_name', sp.name,
      'package_short_description', sp.short_description,
      'package_slug', sp.slug,
      'source', coalesce(qi.metadata->>'source', 'backfill')
    ),
  updated_at = now()
from public.service_packages sp
where qi.service_package_id is null
  and (
    lower(coalesce(qi.description, '')) like lower(sp.name || ':%')
    or lower(coalesce(qi.title, '')) = lower(sp.name)
    or lower(coalesce(qi.description, '')) like '%' || lower(sp.name) || '%'
  );

update public.quote_items qi
set metadata = coalesce(qi.metadata, '{}'::jsonb)
  || jsonb_build_object(
    'included_items',
    coalesce((
      select jsonb_agg(jsonb_build_object('title', spi.title, 'description', spi.description) order by spi.sort_order)
      from public.service_package_items spi
      where spi.package_id = qi.service_package_id
    ), '[]'::jsonb)
  ),
  updated_at = now()
where qi.service_package_id is not null;

update public.quote_items qi
set
  title = coalesce(nullif(qi.title, ''), sp.name),
  description = coalesce(nullif(qi.description, ''), sp.short_description),
  item_type = 'package',
  updated_at = now()
from public.service_packages sp
where qi.service_package_id = sp.id;

update public.quote_items
set
  quantity = case when coalesce(quantity, 0) <= 0 then 1 else quantity end,
  line_total_ex_vat = case
    when coalesce(line_total_ex_vat, 0) <= 0 and coalesce(unit_price, 0) > 0
      then round((case when coalesce(quantity, 0) <= 0 then 1 else quantity end) * unit_price, 2)
    else line_total_ex_vat
  end,
  line_total = case
    when coalesce(unit_price, 0) > 0
      then round(
        ((case when coalesce(quantity, 0) <= 0 then 1 else quantity end) * unit_price)
        * (1 + coalesce(vat_rate, 25) / 100),
        2
      )
    else coalesce(line_total, line_total_ex_vat, 0)
  end,
  updated_at = now()
where coalesce(unit_price, 0) > 0
  and (coalesce(line_total, 0) <= 0 or coalesce(line_total_ex_vat, 0) <= 0);

create index if not exists idx_quote_items_service_package_id on public.quote_items(service_package_id);
