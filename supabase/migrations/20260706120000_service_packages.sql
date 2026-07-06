-- Project Phoenix Service Packages / Produktpakker.
-- Foundation only: no invoice/accounting integration and no advanced media library.

create table if not exists public.service_packages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  category text not null check (category in ('web', 'email_security', 'dns_domain', 'microsoft_365', 'security_followup', 'monitoring', 'support')),
  short_description text,
  long_description text,
  target_customer text,
  price_from numeric(12,2),
  fixed_price numeric(12,2),
  hourly_estimate_min numeric(8,2),
  hourly_estimate_max numeric(8,2),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_package_items (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.service_packages(id) on delete cascade,
  title text not null,
  description text,
  quantity numeric(12,2) not null default 1,
  unit text not null default 'stk',
  unit_price numeric(12,2) not null default 0,
  sort_order integer not null default 0
);

create table if not exists public.service_package_assets (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.service_packages(id) on delete cascade,
  type text not null default 'image',
  title text,
  url text,
  storage_path text,
  alt_text text,
  sort_order integer not null default 0
);

create index if not exists idx_service_packages_category on public.service_packages(category);
create index if not exists idx_service_packages_active on public.service_packages(is_active);
create index if not exists idx_service_package_items_package_id on public.service_package_items(package_id);
create index if not exists idx_service_package_assets_package_id on public.service_package_assets(package_id);

insert into public.service_packages (
  name, slug, category, short_description, long_description, target_customer,
  price_from, fixed_price, hourly_estimate_min, hourly_estimate_max, is_active
) values
  ('Websidepakke Start', 'websidepakke-start', 'web', 'Enkel profesjonell nettside med kontaktseksjon.', 'Mobiltilpasset nettside med enkel struktur, kontaktseksjon og grunnleggende SEO.', 'Små bedrifter som trenger en ryddig førsteside eller enkel nettside.', 15000, null, 10, 18, true),
  ('Websidepakke Pro', 'websidepakke-pro', 'web', 'Flere undersider, bedre design og CRM-koblet kontaktskjema.', 'Nettside med flere undersider, forbedret design, kontaktskjema til Phoenix CRM og tracking/analytics etter avtale.', 'Bedrifter som vil ha en mer komplett webprofil og lead-flyt.', 30000, null, 20, 40, true),
  ('E-postsikkerhet Start', 'epostsikkerhet-start', 'email_security', 'SPF, DKIM, DMARC og Microsoft 365-kontroll.', 'Grunnleggende e-postsikring med SPF, DKIM, DMARC p=none/quarantine plan og Microsoft 365-kontroll.', 'Bedrifter som vil redusere spoofing-risiko og bedre e-postleveranse.', 6500, null, 3, 6, true),
  ('E-postsikkerhet Pro', 'epostsikkerhet-pro', 'email_security', 'DMARC opptrapping, rapportering og policy-herding.', 'Oppfølging av DMARC, policy-herding, rapportering og kontroll etter 30 dager.', 'Bedrifter med høyere krav til domene- og e-postbeskyttelse.', 12000, null, 8, 14, true),
  ('Web Security Headers-pakke', 'web-security-headers', 'web', 'HSTS, CSP report-only og moderne sikkerhetsheadere.', 'Innføring eller forbedring av HSTS, CSP report-only, X-Content-Type-Options, Referrer-Policy og frame protection.', 'Bedrifter med nettsider som mangler grunnleggende browser-beskyttelse.', 7500, null, 4, 8, true),
  ('Web/TLS forbedringspakke', 'tls-https-forbedring', 'web', 'HTTPS/TLS, sertifikat og sikker webtilgang.', 'Gjennomgang og forbedring av HTTPS, TLS, sertifikatoppsett og relevante webserver-innstillinger.', 'Bedrifter der nettsiden gir advarsler eller mangler sikker HTTPS.', 7500, null, 4, 10, true),
  ('DNS/domene-sikring', 'dns-domene-sikring', 'dns_domain', 'DNS, domeneoppsett og grunnleggende domenehygiene.', 'Kontroll av DNS, NS, MX, domeneoppsett, DNSSEC-vurdering og anbefalt domenehygiene.', 'Bedrifter som vil sikre domeneoppsett og redusere driftsrisiko.', 5000, null, 3, 7, true),
  ('Månedlig sikkerhetskontroll', 'maanedlig-sikkerhetskontroll', 'security_followup', 'Periodisk passiv scan, enkel rapport og oppfølging.', 'Månedlig eller kvartalsvis passiv kontroll med enkel rapport, endringslogg og oppfølging av avvik.', 'Bedrifter som vil ha jevnlig kontroll uten tung sikkerhetsavtale.', 2500, null, 1, 3, true)
on conflict (slug) do update set
  name = excluded.name,
  category = excluded.category,
  short_description = excluded.short_description,
  long_description = excluded.long_description,
  target_customer = excluded.target_customer,
  price_from = excluded.price_from,
  fixed_price = excluded.fixed_price,
  hourly_estimate_min = excluded.hourly_estimate_min,
  hourly_estimate_max = excluded.hourly_estimate_max,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.service_package_items (package_id, title, description, quantity, unit, unit_price, sort_order)
select sp.id, item.title, item.description, item.quantity, item.unit, item.unit_price, item.sort_order
from public.service_packages sp
join (
  values
    ('websidepakke-start', 'Enkel profesjonell nettside', 'Ryddig førsteside med tydelig budskap.', 1, 'pakke', 0, 10),
    ('websidepakke-start', 'Kontaktseksjon', 'Kontaktinformasjon og enkel konverteringsflyt.', 1, 'pakke', 0, 20),
    ('websidepakke-start', 'Mobiltilpasset', 'Layout som fungerer på mobil og desktop.', 1, 'pakke', 0, 30),
    ('websidepakke-start', 'Grunnleggende SEO', 'Titler, beskrivelser og struktur.', 1, 'pakke', 0, 40),
    ('websidepakke-pro', 'Flere undersider', 'Tjenester, om oss, kontakt og relevante landingssider.', 1, 'pakke', 0, 10),
    ('websidepakke-pro', 'Kontaktskjema til CRM', 'Skjema sender henvendelser til Phoenix CRM.', 1, 'pakke', 0, 20),
    ('websidepakke-pro', 'Tracking/analytics etter avtale', 'Måling settes opp etter samtykke- og personvernbehov.', 1, 'pakke', 0, 30),
    ('epostsikkerhet-start', 'SPF', 'Kontroller og stram inn avsenderkilder.', 1, 'pakke', 0, 10),
    ('epostsikkerhet-start', 'DKIM', 'Kontroller signering for Microsoft 365/domene.', 1, 'pakke', 0, 20),
    ('epostsikkerhet-start', 'DMARC plan', 'Start på p=none/quarantine med trygg opptrapping.', 1, 'pakke', 0, 30),
    ('epostsikkerhet-pro', 'DMARC opptrapping', 'Planlagt overgang mot strengere policy.', 1, 'pakke', 0, 10),
    ('epostsikkerhet-pro', 'Rapportering', 'Oppfølging av DMARC-rapporter og avvik.', 1, 'pakke', 0, 20),
    ('web-security-headers', 'HSTS', 'Aktiver sikker HTTPS-policy der det passer.', 1, 'pakke', 0, 10),
    ('web-security-headers', 'CSP report-only', 'Start trygg CSP-innføring uten å brekke siden.', 1, 'pakke', 0, 20),
    ('web-security-headers', 'Referrer/frame/content headers', 'Sett grunnleggende browser-beskyttelse.', 1, 'pakke', 0, 30),
    ('tls-https-forbedring', 'Sertifikat og HTTPS', 'Kontroller sertifikat, redirect og TLS-oppsett.', 1, 'pakke', 0, 10),
    ('dns-domene-sikring', 'DNS-kontroll', 'Kontroller NS, MX, A/AAAA og DNSSEC-muligheter.', 1, 'pakke', 0, 10),
    ('maanedlig-sikkerhetskontroll', 'Periodisk passiv scan', 'DNS, web, TLS, headere og e-postkontroller.', 1, 'mnd', 0, 10),
    ('maanedlig-sikkerhetskontroll', 'Enkel rapport', 'Kort oppsummering av endringer og tiltak.', 1, 'mnd', 0, 20)
) as item(slug, title, description, quantity, unit, unit_price, sort_order)
on sp.slug = item.slug
where not exists (
  select 1 from public.service_package_items existing
  where existing.package_id = sp.id and existing.title = item.title
);
