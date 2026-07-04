-- Seed an empty editable homepage row for Phoenix CMS.
-- This avoids production fallback/mock content while allowing admins to edit
-- the first real site-content record from /admin/site-content.

create table if not exists public.phoenix_site_content (
  id uuid primary key default gen_random_uuid(),
  key text not null default 'homepage',
  title text,
  content jsonb,
  section text,
  page text default 'home',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

insert into public.phoenix_site_content (key, title, content, section, page)
select
  'homepage',
  'Hansen IT hjemmeside',
  '{
    "heroTitle": "",
    "heroSubtitle": "",
    "ctaText": "",
    "services": [],
    "aboutText": "",
    "contactText": "",
    "seoTitle": "",
    "seoDescription": ""
  }'::jsonb,
  'home',
  'home'
where not exists (
  select 1
  from public.phoenix_site_content
  where key = 'homepage'
    and page = 'home'
);
