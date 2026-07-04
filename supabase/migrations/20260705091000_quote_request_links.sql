-- Allow quote/request rows to point back to the original inbound request.
-- Existing rows are preserved.

alter table public.requests
  add column if not exists source_request_id uuid references public.requests(id) on delete set null;

create index if not exists idx_requests_source_request_id on public.requests(source_request_id);
