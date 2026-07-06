-- Refresh official Hansen IT service package seed data.

insert into public.service_packages (
  name, slug, category, short_description, long_description, target_customer,
  price_from, fixed_price, hourly_estimate_min, hourly_estimate_max, is_active
) values
  ('Web/TLS forbedringspakke', 'tls-https-forbedring', 'web', 'Fikser HTTPS/TLS, redirect og grunnleggende web-sikkerhet.', 'Kontroll og utbedring av HTTPS/TLS, redirect fra HTTP til HTTPS, sertifikat/fornyelse og enkel validering etter endring.', 'Bedrifter der nettsiden mangler trygg HTTPS eller trenger grunnleggende web-sikring.', 3500, null, 2, 5, true),
  ('E-postsikkerhet Start', 'epostsikkerhet-start', 'email_security', 'Grunnoppsett for SPF, DKIM og DMARC slik at domenet er bedre beskyttet mot e-postforfalskning.', 'SPF-kontroll, DKIM-kontroll, DMARC p=none/quarantine-plan og Microsoft 365/leverandørkontroll.', 'Bedrifter som vil redusere spoofing-risiko og bedre e-postleveranse.', 3500, null, 2, 4, true),
  ('E-postsikkerhet Pro', 'epostsikkerhet-pro', 'email_security', 'Opptrapping av DMARC og oppfølging av e-postleveranse over tid.', 'DMARC-analyse, opptrapping til quarantine/reject, kontroll av legitime avsendere og oppfølging etter 30 dager.', 'Bedrifter med flere e-postkilder eller høyere krav til domene- og e-postbeskyttelse.', 6500, null, 4, 8, true),
  ('Web Security Headers-pakke', 'web-security-headers', 'web', 'Legger inn viktige sikkerhetsheadere for nettsiden.', 'Innføring eller forbedring av HSTS, Content-Security-Policy report-only, X-Content-Type-Options, Referrer-Policy og frame protection.', 'Bedrifter med nettsider som mangler grunnleggende browser-beskyttelse.', 2500, null, 1, 4, true),
  ('DNS/domene-sikring', 'dns-domene-sikring', 'dns_domain', 'Går gjennom DNS, subdomener, DNSSEC og domeneoppsett.', 'DNS-gjennomgang, subdomene-kontroll, DNSSEC-vurdering og fjerning av gamle test/staging-oppføringer etter avtale.', 'Bedrifter som vil sikre domeneoppsett og redusere driftsrisiko.', 2500, null, 1, 3, true),
  ('Månedlig sikkerhetskontroll', 'maanedlig-sikkerhetskontroll', 'security_followup', 'Periodisk passiv kontroll og enkel rapportering.', 'Månedlig passiv scan, endringskontroll, kort statusrapport og anbefalte tiltak ved avvik.', 'Bedrifter som vil ha jevnlig kontroll uten tung sikkerhetsavtale.', 990, null, null, null, true),
  ('Websidepakke Start', 'websidepakke-start', 'web', 'Enkel profesjonell nettside for små bedrifter.', '1-3 sider, mobiltilpasset design, kontaktseksjon, grunnleggende SEO og kontaktskjema til CRM.', 'Små bedrifter som trenger en ryddig førsteside eller enkel nettside.', 12000, null, null, null, true),
  ('Websidepakke Pro', 'websidepakke-pro', 'web', 'Mer komplett nettside med bedre struktur, flere undersider og tydeligere design.', 'Flere undersider, bedre designprofil, kontaktskjema til CRM, ytelse/SEO grunnoppsett og videreutvikling etter avtale.', 'Bedrifter som vil ha en mer komplett webprofil og lead-flyt.', 25000, null, null, null, true)
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
select sp.id, item.title, item.description, 1, item.unit, 0, item.sort_order
from public.service_packages sp
join (
  values
    ('tls-https-forbedring', 'TLS/HTTPS kontroll', 'Kontroller at nettsiden bruker trygg HTTPS og moderne TLS.', 'stk', 10),
    ('tls-https-forbedring', 'Redirect HTTP til HTTPS', 'Sørger for at besøkende sendes til sikker versjon av siden.', 'stk', 20),
    ('tls-https-forbedring', 'Sertifikat/fornyelse kontroll', 'Kontrollerer sertifikatstatus og fornyelsesrisiko.', 'stk', 30),
    ('tls-https-forbedring', 'Enkel validering etter endring', 'Bekrefter at tiltaket fungerer etter oppsett.', 'stk', 40),
    ('epostsikkerhet-start', 'SPF-kontroll', 'Kontrollerer og strammer inn godkjente e-postavsendere.', 'stk', 10),
    ('epostsikkerhet-start', 'DKIM-kontroll', 'Kontrollerer signering for Microsoft 365/domene.', 'stk', 20),
    ('epostsikkerhet-start', 'DMARC plan', 'Starter trygg DMARC-plan med p=none/quarantine.', 'stk', 30),
    ('epostsikkerhet-start', 'Microsoft 365/leverandørkontroll', 'Kontrollerer at legitime leverandører er med i oppsettet.', 'stk', 40),
    ('epostsikkerhet-pro', 'DMARC analyse', 'Analyserer legitime og mistenkelige avsendere.', 'stk', 10),
    ('epostsikkerhet-pro', 'Opptrapping til quarantine/reject', 'Planlegger strengere policy uten å stoppe legitim e-post.', 'stk', 20),
    ('epostsikkerhet-pro', 'Kontroll av legitime avsendere', 'Sikrer at faktiske leverandører fortsatt kan sende.', 'stk', 30),
    ('epostsikkerhet-pro', 'Oppfølging etter 30 dager', 'Kontrollerer effekt og justerer videre tiltak.', 'stk', 40),
    ('web-security-headers', 'HSTS', 'Aktiverer eller forbedrer streng HTTPS-policy.', 'stk', 10),
    ('web-security-headers', 'Content-Security-Policy report-only', 'Starter trygg CSP-innføring uten å brekke nettsiden.', 'stk', 20),
    ('web-security-headers', 'X-Content-Type-Options', 'Reduserer risiko for feil tolking av filer i nettleser.', 'stk', 30),
    ('web-security-headers', 'Referrer-Policy', 'Begrenser unødig lekkasje av lenkeinformasjon.', 'stk', 40),
    ('web-security-headers', 'Frame protection', 'Reduserer risiko for clickjacking.', 'stk', 50),
    ('dns-domene-sikring', 'DNS-gjennomgang', 'Kontrollerer A/AAAA, NS, MX og relevante records.', 'stk', 10),
    ('dns-domene-sikring', 'Subdomene-kontroll', 'Ser etter gamle test/staging-navn og unødvendig eksponering.', 'stk', 20),
    ('dns-domene-sikring', 'DNSSEC-vurdering', 'Vurderer om DNSSEC bør aktiveres eller justeres.', 'stk', 30),
    ('dns-domene-sikring', 'Fjerning av gamle oppføringer', 'Gir konkret ryddeliste for gamle eller risikable records.', 'stk', 40),
    ('maanedlig-sikkerhetskontroll', 'Månedlig passiv scan', 'DNS, web, TLS, headere og e-postkontroller.', 'mnd', 10),
    ('maanedlig-sikkerhetskontroll', 'Endringskontroll', 'Sammenligner status over tid og fanger avvik.', 'mnd', 20),
    ('maanedlig-sikkerhetskontroll', 'Kort statusrapport', 'Sender enkel rapport med funn og anbefalte tiltak.', 'mnd', 30),
    ('websidepakke-start', '1-3 sider', 'Enkel struktur med tydelig budskap.', 'pakke', 10),
    ('websidepakke-start', 'Mobiltilpasset design', 'Fungerer på mobil og desktop.', 'pakke', 20),
    ('websidepakke-start', 'Kontaktseksjon', 'Gjør det enkelt å ta kontakt.', 'pakke', 30),
    ('websidepakke-start', 'Kontaktskjema til CRM', 'Henvendelser sendes inn til Phoenix CRM.', 'pakke', 40),
    ('websidepakke-pro', 'Flere undersider', 'Tjenester, om oss, kontakt og relevante landingssider.', 'pakke', 10),
    ('websidepakke-pro', 'Bedre designprofil', 'Mer komplett visuell struktur og presentasjon.', 'pakke', 20),
    ('websidepakke-pro', 'Kontaktskjema til CRM', 'Skjema sender henvendelser til Phoenix CRM.', 'pakke', 30),
    ('websidepakke-pro', 'Ytelse/SEO grunnoppsett', 'Grunnleggende struktur for synlighet og hastighet.', 'pakke', 40)
) as item(slug, title, description, unit, sort_order)
on sp.slug = item.slug
where not exists (
  select 1 from public.service_package_items existing
  where existing.package_id = sp.id and existing.title = item.title
);
