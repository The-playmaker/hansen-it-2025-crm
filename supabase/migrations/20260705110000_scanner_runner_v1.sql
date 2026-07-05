-- Phoenix Scanner Runner v1
-- Adds runner-friendly scan job metadata and scan_type values.

alter table public.scan_jobs add column if not exists error_message text;

do $$
begin
  alter table public.scan_scopes drop constraint if exists scan_scopes_scan_type_check;
  alter table public.scan_scopes
    add constraint scan_scopes_scan_type_check
    check (scan_type in ('passive', 'external_active', 'internal_agent', 'standard', 'extended'));

  alter table public.scan_jobs drop constraint if exists scan_jobs_scan_type_check;
  alter table public.scan_jobs
    add constraint scan_jobs_scan_type_check
    check (scan_type in ('passive', 'external_active', 'internal_agent', 'standard', 'extended'));
end $$;

create index if not exists idx_scan_jobs_status_queued_at on public.scan_jobs(status, queued_at);
create index if not exists idx_scan_reports_job_id on public.scan_reports(job_id);
