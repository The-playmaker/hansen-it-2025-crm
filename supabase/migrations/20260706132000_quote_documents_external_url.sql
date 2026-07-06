-- Quote portal document links.
-- Some deployments already have this column from later migrations; keep this safe.

alter table public.quote_documents
  add column if not exists external_url text;
