-- Allow scan_jobs to finish as invalid_domain when A/AAAA/MX/NS are all empty
-- (typo / unused domain) instead of completing a meaningless 0/100 report.

alter table public.scan_jobs drop constraint if exists scan_jobs_status_check;

alter table public.scan_jobs
  add constraint scan_jobs_status_check
  check (status in ('queued', 'running', 'completed', 'failed', 'cancelled', 'invalid_domain'));
