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
