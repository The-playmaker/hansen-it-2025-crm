-- =============================================================================
-- DIAGNOSE-skjema.sql
-- Kjør i Supabase SQL Editor. Viser hvilke migrasjoner som SER UT til å være kjørt
-- basert på fingerprint (tabell/kolonne). Seed-/backfill-filer kan være tvetydige.
--
-- Bruk resultatet til å bygge supabase/backfill_schema_migrations.sql
-- (kun rader med status = '✅').
-- =============================================================================

with checks (version, fil, ok) as (
  values
    (
      '00000000000000',
      '00000000000000_migration_tracking.sql',
      to_regclass('public.schema_migrations') is not null
    ),
    (
      '20260701130000',
      '20260701130000_project_phoenix_core.sql',
      to_regclass('public.customers') is not null
      and to_regclass('public.activity_log') is not null
    ),
    (
      '20260704193000',
      '20260704193000_security_scan_reports.sql',
      to_regclass('public.security_scan_reports') is not null
    ),
    (
      '20260704210000',
      '20260704210000_crm_flow_cleanup.sql',
      to_regclass('public.contacts') is not null
      and to_regclass('public.leads') is not null
      and to_regclass('public.quotes') is not null
    ),
    (
      '20260704223000',
      '20260704223000_scan_authorization_flow.sql',
      to_regclass('public.scan_authorizations') is not null
      and to_regclass('public.scan_jobs') is not null
    ),
    (
      '20260704224500',
      '20260704224500_crm_flow_repair_missing_columns.sql',
      exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'quotes' and column_name = 'customer_inc_vat'
      )
    ),
    (
      '20260704225000',
      '20260704225000_seed_empty_site_content.sql',
      to_regclass('public.phoenix_site_content') is not null
    ),
    (
      '20260704230000',
      '20260704230000_seed_site_services.sql',
      to_regclass('public.phoenix_site_content') is not null
      and exists (
        select 1 from public.phoenix_site_content
        where key = 'homepage'
          and jsonb_typeof(coalesce(content->'services', 'null'::jsonb)) = 'array'
      )
    ),
    (
      '20260704231500',
      '20260704231500_security_scan_report_sharing.sql',
      to_regclass('public.security_scan_report_shares') is not null
    ),
    (
      '20260705090000',
      '20260705090000_phoenix_ideas_priority_status.sql',
      exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'phoenix_ideas' and column_name = 'priority'
      )
    ),
    (
      '20260705091000',
      '20260705091000_quote_request_links.sql',
      exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'quotes' and column_name = 'source_request_id'
      )
    ),
    (
      '20260705093000',
      '20260705093000_security_scan_report_crm_links.sql',
      exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'security_scan_reports' and column_name = 'customer_id'
      )
    ),
    (
      '20260705110000',
      '20260705110000_scanner_runner_v1.sql',
      exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'scan_jobs' and column_name = 'error_message'
      )
    ),
    (
      '20260705113000',
      '20260705113000_customer_portal_documents_invoices.sql',
      to_regclass('public.invoices') is not null
      and to_regclass('public.invoice_items') is not null
    ),
    (
      '20260706120000',
      '20260706120000_service_packages.sql',
      to_regclass('public.service_packages') is not null
    ),
    (
      '20260706123000',
      '20260706123000_portal_documents_combined_reports.sql',
      to_regclass('public.quote_documents') is not null
    ),
    (
      '20260706124500',
      '20260706124500_quote_items_service_package_bridge.sql',
      exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'quote_items' and column_name = 'service_package_id'
      )
    ),
    (
      '20260706125000',
      '20260706125000_service_package_seed_refresh.sql',
      to_regclass('public.service_packages') is not null
      and exists (select 1 from public.service_packages limit 1)
    ),
    (
      '20260706130000',
      '20260706130000_quote_documents_portal_source.sql',
      exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'quote_documents' and column_name = 'is_portal_visible'
      )
    ),
    (
      '20260706130500',
      '20260706130500_quote_items_package_backfill.sql',
      -- data-migrasjon: marker som kjørt hvis bridge-kolonnen finnes (samme spor som 061245)
      exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'quote_items' and column_name = 'service_package_id'
      )
    ),
    (
      '20260706131500',
      '20260706131500_ristesund_quote_documents_backfill.sql',
      -- data-migrasjon uten unik fingerprint — vurder manuelt
      to_regclass('public.quote_documents') is not null
    ),
    (
      '20260706132000',
      '20260706132000_quote_documents_external_url.sql',
      exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'quote_documents' and column_name = 'external_url'
      )
    ),
    (
      '20260706133000',
      '20260706133000_quote_portal_tokens_quotes_fk.sql',
      to_regclass('public.quote_portal_tokens') is not null
    ),
    (
      '20260707100000',
      '20260707100000_admin_cleanup_test_flags.sql',
      exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'leads' and column_name = 'is_test'
      )
      or exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'quotes' and column_name = 'is_test'
      )
    ),
    (
      '20260707123000',
      '20260707123000_scan_crm_flow_links.sql',
      exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'scan_authorizations' and column_name = 'customer_id'
      )
      and exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'scan_jobs' and column_name = 'customer_id'
      )
    ),
    (
      '20260707133000',
      '20260707133000_admin_profiles_auth.sql',
      to_regclass('public.admin_profiles') is not null
    ),
    (
      '20260708100000',
      '20260708100000_admin_cleanup_documents_settings.sql',
      exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'leads' and column_name = 'archived_at'
      )
    ),
    (
      '20260716010000',
      '20260716010000_scan_jobs_invalid_domain.sql',
      exists (
        select 1
        from pg_constraint c
        join pg_class t on t.oid = c.conrelid
        join pg_namespace n on n.oid = t.relnamespace
        where n.nspname = 'public'
          and t.relname = 'scan_jobs'
          and c.conname = 'scan_jobs_status_check'
          and pg_get_constraintdef(c.oid) ilike '%invalid_domain%'
      )
    )
)
select
  version,
  fil,
  case when ok then '✅' else '❌' end as status,
  ok
from checks
order by version;

-- Hjelp: generer INSERT-kandidater for rader med ✅ (kopier manuelt til backfill-filen).
-- select
--   '  (''' || version || '''),' as insert_line
-- from checks
-- where ok
-- order by version;
