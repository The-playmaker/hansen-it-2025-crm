-- Portal document visibility alias and combined scan report support.

alter table public.quote_documents
  add column if not exists is_portal_visible boolean not null default true;

update public.quote_documents
set is_portal_visible = visible_in_portal
where visible_in_portal is not null;

alter table public.scan_reports
  add column if not exists report_type text not null default 'domain';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'scan_reports_report_type_check'
  ) then
    alter table public.scan_reports
      add constraint scan_reports_report_type_check
      check (report_type in ('domain', 'combined'));
  end if;
end $$;

create index if not exists idx_scan_reports_report_type on public.scan_reports(report_type);
create index if not exists idx_scan_reports_authorization_type on public.scan_reports(authorization_id, report_type);
