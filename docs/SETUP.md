# Setup

Dette dokumentet beskriver lokal kjøring, miljøvariabler og deploy-notater for Project Phoenix CRM.

## Kjør lokalt

```bash
npm install
npm run dev
```

Åpne `http://localhost:3000/login` og gå videre til Phoenix admin.

## Miljøvariabler

Bruk `.env.local` lokalt og tilsvarende miljøvariabler i Vercel.

```bash
# Supabase (klient)
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>

# Supabase (server)
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# Dashboard / public base URL
PUBLIC_DASHBOARD_URL=https://crm.hansen-it.com
NEXT_PUBLIC_CRM_PUBLIC_URL=https://crm.hansen-it.com

# Teams / Slack
TEAMS_WEBHOOK_URL=https://...
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...

# Resend
RESEND_API_KEY=<resend-api-key>
SCAN_REPORT_FROM=Hansen IT <rapport@hansen-it.com>

# Cloudflare Turnstile / public contact form
NEXT_PUBLIC_TURNSTILE_SITE_KEY=<site-key>
TURNSTILE_SECRET_KEY=<secret-key>
CAPTCHA_REQUIRED=true
CAPTCHA_BYPASS_FOR_PREVIEW=false
CAPTCHA_BYPASS_FOR_PRODUCTION=false
CRM_CONTACT_RELAY_SECRET=<shared-secret-from-hansen-it-2025>
```

`SUPABASE_SERVICE_ROLE_KEY` er server-side only. Den skal bare brukes i API-ruter/serverkode og aldri eksponeres til frontend.

## Cloudflare Turnstile

Public contact API bruker Cloudflare Turnstile for spamkontroll.

- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` brukes kun i frontend-widget.
- `TURNSTILE_SECRET_KEY` brukes server-side for å verifisere token.
- `CAPTCHA_REQUIRED=true` gjør captcha påkrevd også utenfor production.
- `CAPTCHA_BYPASS_FOR_PREVIEW=true` kan brukes i preview/dev når Turnstile ikke er konfigurert.
- `CAPTCHA_BYPASS_FOR_PRODUCTION=true` finnes kun som nødventil og anbefales ikke.

`/api/public/contact` krever enten gyldig Turnstile-token eller en server-side relay secret fra `hansen-it-2025` via `CRM_CONTACT_RELAY_SECRET`. Relay secret skal aldri legges i frontend eller `NEXT_PUBLIC_*`.

## Vercel

- Legg inn miljøvariabler i Vercel Project Settings.
- Ikke legg secrets i repoet.
- `NEXT_PUBLIC_*`-variabler er synlige i klientbundle og skal ikke inneholde hemmeligheter.

## Teams-varsler

Opprett Teams Incoming Webhook i ønsket kanal.

Nye HAST-saker sender melding via:

```http
POST /api/notify/teams
```

Når en sak med `priority='hast'` oppdateres, sendes også melding.

## Slack-varsler

Hvis `SLACK_WEBHOOK_URL` finnes, sender `/api/public/contact` et best-effort Slack-varsel etter at en gyldig lead er lagret.

Slack-feil logges kontrollert, men skal ikke stoppe lead-mottak eller krasje API-et.

Slack-meldingen viser navn, firma, e-post, telefon, kategori, kort melding og kilde.

## Resend

Security reports kan sendes via Resend fra:

```http
POST /api/admin/security/reports/[id]/send
```

Hvis `RESEND_API_KEY` mangler, returnerer API-et kontrollert `503`. Delbar lenke og eksport fungerer fortsatt.
