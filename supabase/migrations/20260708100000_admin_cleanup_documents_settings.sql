alter table if exists public.leads
  add column if not exists display_name text,
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists archived_by uuid,
  add column if not exists deleted_by uuid;

alter table if exists public.requests
  add column if not exists display_name text,
  add column if not exists notes text,
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists archived_by uuid,
  add column if not exists deleted_by uuid;

alter table if exists public.quotes
  add column if not exists display_name text,
  add column if not exists customer_note text,
  add column if not exists internal_notes text,
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists archived_by uuid,
  add column if not exists deleted_by uuid;

alter table if exists public.scan_reports
  add column if not exists display_name text,
  add column if not exists customer_summary text,
  add column if not exists internal_notes text,
  add column if not exists updated_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists archived_by uuid,
  add column if not exists deleted_by uuid;

alter table if exists public.security_scan_reports
  add column if not exists display_name text,
  add column if not exists customer_summary text,
  add column if not exists internal_notes text,
  add column if not exists updated_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists archived_by uuid,
  add column if not exists deleted_by uuid;

alter table if exists public.scan_authorizations
  add column if not exists display_name text,
  add column if not exists internal_notes text,
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists archived_by uuid,
  add column if not exists deleted_by uuid;

alter table if exists public.quote_documents
  add column if not exists display_name text,
  add column if not exists updated_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists archived_by uuid,
  add column if not exists deleted_by uuid;

alter table if exists public.service_packages
  add column if not exists display_name text,
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists archived_by uuid,
  add column if not exists deleted_by uuid;

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  actor_email text,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_audit_log_created_at on public.admin_audit_log (created_at desc);
create index if not exists idx_admin_audit_log_entity on public.admin_audit_log (entity_type, entity_id);
create index if not exists idx_admin_audit_log_actor on public.admin_audit_log (actor_user_id);
