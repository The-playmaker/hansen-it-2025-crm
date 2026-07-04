# Hansen IT CRM v1.6 – Kanban + Teams varsler

## Miljøvariabler (.env.local / Vercel)
```
# Supabase (klient)
NEXT_PUBLIC_SUPABASE_URL=<<https://xyz.supabase.co>>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<<anon key>>

# Supabase (server)
SUPABASE_URL=<<https://xyz.supabase.co>>
SUPABASE_SERVICE_ROLE_KEY=<<service role>>

# Teams (Incoming Webhook)
TEAMS_WEBHOOK_URL=<<din Teams incoming webhook URL>>
PUBLIC_DASHBOARD_URL=https://crm.hansen-it.com
```
Opprett Teams Incoming Webhook i en kanal (Channel → Connectors → Incoming Webhook).

## Kanban
- Dra kort mellom `Ny`, `Pågår`, `Fullført`
- Status oppdateres via `/api/requests/[id]`

## Teams-varsler
- Nye HAST-saker sender melding via `/api/notify/teams`
- Når en sak med `priority='hast'` oppdateres, sendes også melding

## Koble n8n → Supabase
- n8n Insert til `public.requests` (felter: name, email, company, message, priority)
- Realtime gjør at nye saker dukker opp automatisk i både Tabell og Kanban

## Kjør lokalt
```bash
npm install
npm run dev
```
Åpne /login → Microsoft → /dashboard eller /dashboard/kanban

## Project Phoenix v1

Phoenix v1 er lagt oppå eksisterende `hansen-it-2025-crm` uten migrering til Refine og uten Ant Design. Design og flyt er inspirert av `The-playmaker/crm-Hansen-IT`, men implementert med Next.js, React og Tailwind i dagens 2025 CRM-base.

### Gjort i v1

- Forbedret `/login` med Hansen IT / Project Phoenix-branding og eksisterende Casdoor SSO-flyt.
- Ny Phoenix adminstruktur med sidepanel for Dashboard, Kunder, Oppgaver, Tilbud og Idebank.
- Dashboard med Dagens 3, kunder til oppfølging, åpne tilbud og idebank-teller.
- Kunder-side inspirert av Companies/Contacts: firma, primærkontakt, kontaktpersoner, status og notater.
- Oppgaver/Kanban-side inspirert av Scrumboard: enkel status-board med `ny`, `pågår`, `venter kunde`, `ferdig`.
- Tilbud-side inspirert av Quotes: kladd/sendt/godkjent/avslått, pris eks. mva og gyldighet.
- Idebank med `parkert` som standardstatus, slik at ideer ikke automatisk blir aktive prosjekter.
- Midlertidig lokal mock-data via `localStorage` når Supabase-tabeller for Phoenix ikke finnes.

### Neste steg

- Lage Supabase-tabeller/migrasjoner for `phoenix_customers`, `phoenix_contacts`, `phoenix_tasks`, `phoenix_quotes` og `phoenix_ideas`.
- Bytte `components/phoenix/usePhoenixData.jsx` fra `localStorage` til Supabase CRUD.
- Koble eksisterende `requests`/quotes-data inn i Phoenix tilbud hvis den tabellen skal være videre kilde.
- Legge til rolle-/RLS-policyer før produksjonsbruk.

### Ikke inkludert i v1

Faktura, AI, lager, kundeportal og avansert rapportering er bevisst holdt utenfor Phoenix v1.

## Auth etter Casdoor-fjerning

Casdoor er fjernet fra Phoenix v1. `/login` bruker nå en enkel lokal Phoenix-session som setter `phoenixUser` cookie via `/api/auth/login`. Dette er ment for v1/mock-drift og lokal bruk mens CRM-et fortsatt bruker `localStorage` for Phoenix-data.

Neste auth-steg bør være å velge og implementere produksjonsauth, for eksempel Supabase Auth med RLS-policyer for Phoenix-tabellene.

## Hansen IT-nettside -> Phoenix lead-bro

CRM-et eksponerer et offentlig endpoint for kontaktskjema fra nettsiden:

```http
POST /api/public/contact
Content-Type: application/json
```

### Miljøvariabler i CRM

Endpointet krever Supabase-konfig for å lagre leads:

```bash
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

Alternativt kan `NEXT_PUBLIC_SUPABASE_URL` og `NEXT_PUBLIC_SUPABASE_ANON_KEY` brukes i enklere dev-miljø, men service role anbefales for server-side lead-mottak.

Hvis Supabase-miljøvariabler mangler returnerer endpointet kontrollert `503` med norsk feilmelding. Build/dev skal ikke krasje.

### Forventet payload

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

### Forventet Supabase-schema

Primært forsøker endpointet å skrive til `phoenix_leads`:

```sql
create table if not exists public.phoenix_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  company text,
  message text not null,
  category text,
  source text default 'hansen-it-2025',
  status text default 'ny',
  created_at timestamptz default now()
);
```

Hvis `phoenix_leads` ikke finnes, brukes eksisterende `requests`-tabell som fallback med feltene `name`, `email`, `phone`, `company`, `description`, `message`, `priority` og `status`.

### Eksempel curl

```bash
curl -X POST https://crm.hansen-it.com/api/public/contact \
  -H "Content-Type: application/json" \
  -d '{"name":"Ola Nordmann","email":"ola@example.no","phone":"+47 900 00 000","company":"Eksempel AS","message":"Vi ønsker hjelp med IT-drift.","category":"Salg","source":"hansen-it-2025"}'
```

## Phoenix CMS for Hansen IT-nettsiden

CRM-et har en enkel CMS-side på `/admin/site-content` for forsideinnhold til Hansen IT-nettsiden:

- hero title og subtitle
- CTA-tekst
- tjenester/seksjoner
- om oss tekst
- kontakttekst
- SEO title og description

Offentlig innhold kan hentes via:

```http
GET /api/public/site-content
```

Hvis Supabase ikke er konfigurert, eller tabellen ikke kan leses, returnerer endpointet trygg fallback/mock-data.

### Forventet Supabase-schema

Endpointet forsøker å lese siste rad fra `phoenix_site_content`. En enkel startmodell kan være:

```sql
create table if not exists public.phoenix_site_content (
  id uuid primary key default gen_random_uuid(),
  content jsonb not null,
  updated_at timestamptz default now()
);
```

`content` bør inneholde feltene `heroTitle`, `heroSubtitle`, `ctaText`, `services`, `aboutText`, `contactText`, `seoTitle` og `seoDescription`.

### Slack-varsel for nye leads

Hvis `SLACK_WEBHOOK_URL` finnes i CRM-miljøet, sender `/api/public/contact` et best-effort Slack-varsel etter at en gyldig lead er lagret i `phoenix_leads` eller fallback-tabellen `requests`.

```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

Slack-feil logges kontrollert med `console.error`, men skal ikke stoppe lead-mottaket eller krasje API-et. Meldingen viser navn, firma, e-post, telefon, kategori, kort melding og kilde.

## Project Phoenix core Supabase-migration

Ny migration ligger i:

```bash
supabase/migrations/20260701130000_project_phoenix_core.sql
```

### Nye tabeller

Migrationen oppretter disse Phoenix core-tabellene hvis de ikke finnes:

- `customers`
- `customer_contacts`
- `projects`
- `tasks`
- `locations`
- `assets`
- `activity_log`

Den legger også trygge koblingskolonner på eksisterende `requests` hvis de mangler:

- `requests.customer_id uuid references customers(id)`
- `requests.converted_at timestamptz`
- `requests.converted_to_customer boolean default false`

### Eksisterende tabeller som gjenbrukes

Migrationen gjenbruker eksisterende tabeller og endrer ikke Casdoor-tabeller:

- `requests`
- `services`
- `employees`
- `quote_*`

`projects`, `tasks` og `activity_log` kan kobles mot `requests`. `projects` kan også kobles mot `services` og `employees`.

### Kjøre SQL i Supabase

Alternativ 1: Supabase Dashboard

1. Åpne Supabase-prosjektet.
2. Gå til SQL Editor.
3. Lim inn innholdet fra `supabase/migrations/20260701130000_project_phoenix_core.sql`.
4. Kjør scriptet.

Alternativ 2: Supabase CLI

```bash
supabase db push
```

Denne migrationen lager ikke RLS policies ennå. Det bør gjøres i en egen sikkerhetsrunde før produksjonsbruk.

## Supabase source of truth for leads og henvendelser

Phoenix CRM bruker `public.requests` som source of truth for leads/henvendelser når Supabase er konfigurert. Fiktive mock-leads er fjernet fra Phoenix demo-data.

### Requests mapping til CRM-lead

CRM mapper `requests` til leads slik:

- `id` -> `id`
- `name` eller `customer_name` -> `name`
- `email` -> `email`
- `company` -> `company`
- `phone` -> `phone` hvis feltet finnes
- `message` eller `description` -> `message`
- `priority` -> `priority` (`normal` eller `hast`)
- `status` -> `status` (`ny`, `pågår`, `fullført`, `arkivert`)
- `created_at` -> `created_at`
- `updated_at` -> `updated_at` hvis feltet finnes

### Forventede felter i `requests`

Minimum:

```sql
id uuid primary key,
name text,
email text,
company text,
message text,
priority text default 'normal',
status text default 'ny',
created_at timestamptz default now()
```

Anbefalt:

```sql
phone text,
description text,
updated_at timestamptz,
customer_id uuid references customers(id),
converted_at timestamptz,
converted_to_customer boolean default false
```

### Bruk i CRM

- `/api/public/contact` skriver nye henvendelser direkte til `requests`.
- `/api/admin/requests` leser `requests` og returnerer både rådata og CRM-lead mapping.
- `/api/admin/requests/[id]` støtter oppdatering av `status` og `priority`.
- `/admin/leads` viser og oppdaterer ekte `requests`.
- `/admin/dashboard` bruker `requests` for “Nye henvendelser”, “Kunder som venter” og “HAST”.

### Demo/fallback som fortsatt finnes

Når Supabase env mangler (`SUPABASE_URL` og `SUPABASE_SERVICE_ROLE_KEY`), viser Phoenix tydelig “Demo mode”. LocalStorage brukes da fortsatt for ikke-migrerte v1-moduler som kunder, oppgaver, tilbud og idebank. Disse er demo/fallback og er ikke source of truth i produksjon.

### Nettsideinnhold / CMS

Nettsideinnhold forventes i `phoenix_site_content`:

```sql
create table if not exists public.phoenix_site_content (
  id uuid primary key default gen_random_uuid(),
  content jsonb not null,
  updated_at timestamptz default now()
);
```

Hvis Supabase er konfigurert men `phoenix_site_content` mangler eller er tom, viser CRM “ikke konfigurert” og returnerer ikke fiktiv produksjonsdata. Fallback-content brukes bare i demo mode uten Supabase env.

## Phoenix Scan som CRM-modul

Phoenix Scan er integrert i samme kodebase som CRM-et, ikke som separat app.

Adminruter:

- `/admin/security/scan` - kjør passiv domeneskanning
- `/admin/security/reports` - se lagrede rapporter

API-ruter:

- `POST /api/admin/security/scan`
- `GET /api/admin/security/reports`

Modulen bruker eksisterende Phoenix admin-shell, UI-komponenter, session-cookie og Supabase admin-klient.

### Supabase-tabell for scan-rapporter

Migration:

```bash
supabase/migrations/20260704193000_security_scan_reports.sql
```

Tabell:

```sql
create table if not exists public.security_scan_reports (
  id uuid primary key default gen_random_uuid(),
  domain text not null,
  score integer not null,
  grade text not null,
  report jsonb not null,
  created_by text,
  created_at timestamptz not null default now()
);
```

Hvis Supabase ikke er konfigurert, kan scan kjøres, men rapporten lagres ikke. Reports-siden viser da demo mode.

## CRM-flyt: requests -> leads -> customers -> quotes

Phoenix bruker nå `requests` som inngang for henvendelser fra nettside/contact/quote forms. Original request slettes ikke ved konvertering.

Flyt:

1. Ny henvendelse lagres i `requests`.
2. Fra `/admin/leads` kan request konverteres med "Konverter til lead/kunde".
3. Konvertering finner eller oppretter:
   - `customers` basert på company/email
   - `contacts` basert på name/email
   - `leads` med `source_request_id`
4. Request oppdateres med `customer_id`, `contact_id`, `lead_id`, `status='converted'`, `converted_at` og `converted_to_customer=true`.
5. Tilbud opprettes fra `/admin/quotes` og åpnes i eksisterende `/admin/quotes/[id]`.
6. Kundeportal-lenke genereres fra quote-detalj og kan åpnes via både `/portal/[token]` og `/portal/quote/[token]`.

Ny migration for denne oppryddingen:

```bash
supabase/migrations/20260704210000_crm_flow_cleanup.sql
```

Den oppretter eller sikrer tabellene:

- `leads`
- `customers`
- `contacts`
- `phoenix_ideas`
- `quotes`
- `quote_items`
- `quote_messages`
- `quote_tokens`
- `quote_portal_tokens`
- `phoenix_site_content`

### Quote portal

Eksisterende quote portal er videreført og kompatibel med gammel `quote_portal_tokens`-flyt:

- Admin åpner `/admin/quotes/[id]`.
- Admin lager portal-lenke.
- Token er lang og random (`randomBytes(32).toString("hex")`).
- Kunde åpner `/portal/quote/[token]` uten innlogging.
- Kunde kan se tilbud/request, sende melding og godkjenne eller be om endringer.
- Meldinger lagres i `quote_messages` og vises i CRM.

### Idébank

`/admin/ideas` bruker `phoenix_ideas` når Supabase er konfigurert. LocalStorage brukes kun som demo fallback uten Supabase env, og siden viser tydelig Demo mode.

### RLS og sikkerhet

Service role brukes kun server-side i API-ruter. Den eksponeres ikke til frontend. RLS policies er ikke aktivert i denne migrationen; før produksjon bør det legges egne policies for adminbrukere og public token-tilgang til quote portal.
