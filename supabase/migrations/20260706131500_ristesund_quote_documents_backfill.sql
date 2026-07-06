-- Ristesund AS: bridge legacy request attachments into quote_documents.
-- Old files were uploaded against the request id, while the portal quote uses
-- the quote id with package quote_items.

do $$
declare
  ristesund_request_id uuid := '7de38205-7f93-4c23-a5c1-7d12ede2058e';
  ristesund_quote_id uuid := 'b05134fc-b5a8-45ff-bf31-dc2fb5cc0f16';
  ristesund_customer_id uuid;
begin
  select customer_id into ristesund_customer_id
  from public.requests
  where id = ristesund_request_id
  limit 1;

  insert into public.quote_documents (
    quote_id,
    request_id,
    customer_id,
    type,
    title,
    filename,
    mime_type,
    storage_path,
    visible_in_portal,
    is_portal_visible,
    created_at,
    updated_at
  )
  select
    ristesund_quote_id,
    ristesund_request_id,
    ristesund_customer_id,
    case
      when lower(qa.file_name) like '%security-report%' or lower(qa.file_name) like '%scan%' then 'scan_combined_pdf'
      when lower(qa.file_name) like '%offer%' or lower(qa.file_name) like '%quote%' or lower(qa.file_name) like '%tilbud%' then 'quote_pdf'
      else 'attachment'
    end,
    case
      when lower(qa.file_name) like '%security-report%' or lower(qa.file_name) like '%scan%' then 'Samlet sikkerhetsrapport'
      when lower(qa.file_name) like '%offer%' or lower(qa.file_name) like '%quote%' or lower(qa.file_name) like '%tilbud%' then 'Tilbud fra Hansen IT'
      else qa.file_name
    end,
    qa.file_name,
    'application/pdf',
    qa.file_path,
    true,
    true,
    coalesce(qa.created_at, now()),
    now()
  from public.quote_attachments qa
  where qa.quote_id = ristesund_request_id
    and (
      lower(qa.file_name) like '%offer_quote_7de38205%'
      or lower(qa.file_name) like '%phoenix-security-report-ristesundas.no%'
      or lower(qa.file_name) like '%ristesund%'
    )
    and not exists (
      select 1
      from public.quote_documents qd
      where qd.quote_id = ristesund_quote_id
        and qd.storage_path = qa.file_path
    );
end $$;
