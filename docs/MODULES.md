# Modules

Dette dokumentet samler operativ moduloversikt for Project Phoenix CRM.

## CRM

Phoenix CRM dekker dashboard, kunder, oppgaver, tilbud, henvendelser og idébank.

Dashboard bruker ekte Supabase-data der tabeller/env finnes:

- nye requests
- åpne leads
- aktive quotes
- dagens 3
- idébank fra `phoenix_ideas`

## Requests / Leads

`/api/public/contact` tar imot henvendelser fra Hansen IT-nettsiden:

```http
POST /api/public/contact
Content-Type: application/json
```

Forventet payload:

```json
{
  "name": "Ola Nordmann",
  "email": "ola@example.no",
  "phone": "+47 900 00 000",
  "company": "Eksempel AS",
  "message": "Vi ønsker hjelp med IT-drift.",
  "category": "Salg",
  "source": "hansen-it-2025"
}
```

`name`, `email` og `message` er påkrevd.

Eksempel curl:

```bash
curl -X POST https://crm.hansen-it.com/api/public/contact \
  -H "Content-Type: application/json" \
  -d '{"name":"Ola Nordmann","email":"ola@example.no","phone":"+47 900 00 000","company":"Eksempel AS","message":"Vi ønsker hjelp med IT-drift.","category":"Salg","source":"hansen-it-2025"}'
```

CRM bruker:

- `/api/admin/requests`
- `/api/admin/requests/[id]`
- `/api/admin/requests/[id]/convert`
- `/admin/leads`
- `/admin/dashboard`

Status støtter `ny`, `pågår`, `fullført`, `arkivert` og `converted`.

Dashboard bruker `requests` for Nye henvendelser, Kunder som venter og HAST.

## CRM-flyt: requests -> leads -> customers -> quotes

1. Ny henvendelse lagres i `requests`.
2. Request kan konverteres fra `/admin/leads`.
3. Konvertering finner eller oppretter `customers`, `contacts` og `leads`.
4. Request oppdateres med koblinger og `status='converted'`.
5. Tilbud opprettes fra `/admin/quotes`.
6. Kundeportal-lenke åpnes via `/portal/quote/[token]`.

Original request slettes aldri.

## Quotes / Quote Portal

Admin:

- `/admin/quotes`
- `/admin/quotes/[id]`

Portal:

- `/portal/quote/[token]`
- `/portal/[token]`

Quote portal støtter:

- delbar token-lenke
- kundevisning uten innlogging
- meldinger/spørsmål
- godkjenning eller endringsønske
- adminvisning av kunde-meldinger

Token er lang og random.

## Site Content / CMS

Adminside:

- `/admin/site-content`

Public API:

```http
GET /api/public/site-content
```

CMS støtter forsideinnhold, tjenester/seksjoner, kontakttekst og SEO-felter.

## Ideas

`/admin/ideas` bruker `phoenix_ideas` når Supabase er konfigurert.

LocalStorage brukes kun som demo fallback uten Supabase env, og siden skal vise Demo mode.

Nye ideer skal kunne parkeres raskt uten at de blir aktive prosjekter.

## Phoenix Scan

Admin:

- `/admin/security/scan`
- `/admin/security/reports`

API:

- `POST /api/admin/security/scan`
- `GET /api/admin/security/reports`

Phoenix Scan v2 er en passiv, CRM-integrert sikkerhetssjekk:

- domain scan
- email/security scan
- subdomain discovery
- email spoofing risk
- MX/SPF/DKIM/DMARC-analyse
- findings med severity
- anbefalte tiltak
- Create CRM lead/task fra funn

Begrensninger:

- Ingen aggressiv portscan mot tredjepart.
- Ingen IP-range scanning.
- Ingen aktiv angrepstesting uten signert authorization.
- Ingen credential testing eller brute force.

## Reports

Lagrede rapporter kan eksporteres og deles:

- Last ned PDF
- Last ned JSON
- Lag delbar token-lenke
- Send rapportlenke via Resend

Public rapportportal:

- `/portal/security-report/[token]`
- `/api/portal/security-report/[token]`

Admin API:

- `POST /api/admin/security/reports/[id]/share`
- `POST /api/admin/security/reports/[id]/send`

Hvis `RESEND_API_KEY` mangler, returnerer send-API kontrollert `503`.

## Scan Authorization

Admin:

- `/admin/scan-authorizations`
- `/admin/scan-authorizations/[id]`

Portal:

- `/portal/scan-authorization/[token]`

Flyt:

1. Admin oppretter autorisasjon med kunde, signatar, scan-type, domener/IP-er og vilkår.
2. Systemet lager lang random token og portal-lenke.
3. Kunden leser vilkår, bekrefter scope og signerer digitalt.
4. Systemet logger navn, e-post, rolle, IP-adresse, timestamp, scope, domener, IP-er, scan-type og signaturdata.
5. Etter signering opprettes `scan_jobs` med `status='queued'`.

## Developer Portal

Developer Portal ligger under:

- `/admin/docs`
- `/admin/docs/architecture`
- `/admin/docs/database`
- `/admin/docs/modules`
- `/admin/docs/reports`
- `/admin/docs/adr-rfc`

Innholdet er statisk draft-content nå, med planlagt markdown-sync senere.
