# Project Phoenix CRM

Project Phoenix CRM er Hansen ITs interne plattform for kundehåndtering, henvendelser, tilbud, sikkerhetsskanning, rapporter og kundeportal.

## Status

Draft / active development.

Phoenix er i aktiv utvikling. Flere moduler bruker Supabase som primær datakilde, mens enkelte eldre v1-flater fortsatt har demo/localStorage fallback når Supabase ikke er konfigurert.

## Tech stack

- Next.js
- React
- Tailwind
- Supabase
- Resend
- Teams/Slack webhooks

## Hovedmoduler

- CRM
- Requests / Leads
- Customers / Contacts
- Quotes / Quote Portal
- Ideas
- Site Content / CMS
- Phoenix Scan
- Reports
- Scan Authorization
- Developer Portal

## Viktige routes

Admin:

- `/login`
- `/admin/dashboard`
- `/admin/leads`
- `/admin/customers`
- `/admin/kanban`
- `/admin/quotes`
- `/admin/ideas`
- `/admin/site-content`
- `/admin/security/scan`
- `/admin/security/reports`
- `/admin/scan-authorizations`
- `/admin/docs`

Portaler:

- `/portal/quote/[token]`
- `/portal/security-report/[token]`
- `/portal/scan-authorization/[token]`

Public API:

- `POST /api/public/contact`
- `GET /api/public/site-content`

## Kjør lokalt

```bash
npm install
npm run dev
```

Åpne `http://localhost:3000/login` og gå videre til Phoenix admin.

## Dokumentasjon

- [Setup](docs/SETUP.md): miljøvariabler, Vercel og lokal kjøring.
- [Database](docs/DATABASE.md): Supabase-tabeller, migrations og datamodell.
- [Modules](docs/MODULES.md): CRM, Scan, Reports, Quote Portal, CMS og Ideas.
- [Security](docs/SECURITY.md): service role, RLS, token-portaler og scan authorization.
- [Implementation Notes](docs/implementation-notes/README.md): historikk, v1-notater, Kanban, Teams og n8n.
- [Phoenix Docs](docs/README.md): levende utviklerportal og arkitekturdokumentasjon.

## Sikkerhetsnotat

- `SUPABASE_SERVICE_ROLE_KEY` er server-side only og skal aldri eksponeres i frontend.
- Public portaltilgang skal bruke lange, random tokens.
- Aktiv scanning krever signert scan authorization.
- RLS må fullføres før bred produksjon.
- Originale `requests` skal konverteres, men ikke slettes.
