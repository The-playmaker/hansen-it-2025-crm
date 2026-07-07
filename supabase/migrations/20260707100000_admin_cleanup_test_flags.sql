-- Safe cleanup support. These flags are used by admin-only cleanup tools.
-- Use dynamic SQL so environments missing optional modules do not fail the migration.

do $$
declare
  table_name text;
  tables text[] := array[
    'requests',
    'leads',
    'quotes',
    'quote_items',
    'quote_documents',
    'quote_messages',
    'security_scan_reports',
    'scan_jobs',
    'quote_portal_tokens',
    'invoices',
    'invoice_items'
  ];
begin
  foreach table_name in array tables loop
    if to_regclass('public.' || table_name) is not null then
      execute format(
        'alter table public.%I add column if not exists is_test boolean not null default false',
        table_name
      );
    end if;
  end loop;
end $$;
