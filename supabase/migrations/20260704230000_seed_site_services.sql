-- Seed/edit homepage services shown on hansen-it.com.
-- Run this when phoenix_site_content has too few service cards.

create extension if not exists pgcrypto;

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
  '{}'::jsonb,
  'home',
  'home'
where not exists (
  select 1 from public.phoenix_site_content where key = 'homepage' and page = 'home'
);

update public.phoenix_site_content
set
  content = jsonb_set(
    coalesce(content, '{}'::jsonb),
    '{services}',
    '[
      {
        "id": "automation",
        "title": "Automatisering som tjeneste",
        "name": "Automatisering som tjeneste",
        "description": "Ferdige automasjoner i n8n/Node-RED som kobler sammen systemer, markedsføring og rapportering.",
        "short_description": "Ferdige automasjoner i n8n/Node-RED som kobler sammen systemer, markedsføring og rapportering.",
        "href": "/automation",
        "features": ["Shopify til Mailchimp", "Daglig rapporter", "Skjema til CRM/Sheets"]
      },
      {
        "id": "cyber",
        "title": "Cybersikkerhet",
        "name": "Cybersikkerhet",
        "description": "Komplett sikkerhet med produkter tilpasset små og mellomstore bedrifter.",
        "short_description": "Komplett sikkerhet med produkter tilpasset små og mellomstore bedrifter.",
        "href": "/cyber",
        "features": ["Brannmur", "Endpoint-beskyttelse", "24/7 overvåkning", "Norsk support"]
      },
      {
        "id": "infrastructure",
        "title": "Infrastruktur og serverdrift",
        "name": "Infrastruktur og serverdrift",
        "description": "Nettverk, servere, backup og trygg drift for bedrifter som trenger stabil IT-hverdag.",
        "short_description": "Nettverk, servere, backup og trygg drift for bedrifter som trenger stabil IT-hverdag.",
        "href": "/infrastructure",
        "features": ["Nettverk og WiFi", "Serverdrift", "Backup og restore", "Microsoft 365"]
      },
      {
        "id": "iot",
        "title": "IoT-løsninger",
        "name": "IoT-løsninger",
        "description": "Smarte sensorer og overvåking som gir deg kontroll over driften.",
        "short_description": "Smarte sensorer og overvåking som gir deg kontroll over driften.",
        "href": "/iot",
        "features": ["Temperatur/fuktighet", "Strømforbruk", "Varsling til Teams/SMS", "Dashboards og rapporter"]
      }
    ]'::jsonb,
    true
  ),
  updated_at = now()
where key = 'homepage'
  and page = 'home'
  and jsonb_array_length(coalesce(content->'services', '[]'::jsonb)) < 4;
