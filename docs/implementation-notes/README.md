# Implementation Notes

Dette dokumentet samler historikk og eldre operative notater som ikke skal ligge i root README.

## Project Phoenix v1

Phoenix v1 ble lagt oppå eksisterende `hansen-it-2025-crm` uten migrering til Refine og uten Ant Design. Design og flyt var inspirert av `The-playmaker/crm-Hansen-IT`, men implementert med Next.js, React og Tailwind i dagens 2025 CRM-base.

Gjort i v1:

- Forbedret `/login` med Hansen IT / Project Phoenix-branding.
- Ny Phoenix adminstruktur med sidepanel for Dashboard, Kunder, Oppgaver, Tilbud og Idebank.
- Dashboard med Dagens 3, kunder til oppfølging, åpne tilbud og idébank-teller.
- Kunder-side inspirert av Companies/Contacts.
- Oppgaver/Kanban-side inspirert av Scrumboard.
- Tilbud-side inspirert av Quotes.
- Idébank med `parkert` som standardstatus.
- Midlertidig lokal mock-data via `localStorage` når Supabase-tabeller ikke finnes.

Ikke inkludert i v1:

- faktura
- AI
- lager
- kundeportal
- avansert rapportering

## Auth etter Casdoor-fjerning

Oppdatert status: Auth v2 bruker Supabase Auth og `public.admin_profiles` for adminroller. Gammel lokal cookie er bare demo fallback når `NEXT_PUBLIC_DEMO_MODE=true` utenfor production.

Casdoor ble fjernet fra Phoenix v1. Den tidlige dev-flyten brukte en enkel lokal Phoenix-session med `phoenixUser` cookie.

Neste auth-steg bør være produksjonsauth, for eksempel Supabase Auth med RLS-policyer.

## Kanban

- Dra kort mellom `Ny`, `Pågår`, `Fullført`.
- Status oppdateres via `/api/requests/[id]`.

## Teams-varsler

- Nye HAST-saker sender melding via `/api/notify/teams`.
- Når en sak med `priority='hast'` oppdateres, sendes også melding.

## n8n -> Supabase

Tidligere anbefalt flyt:

- n8n Insert til `public.requests`.
- Felter: `name`, `email`, `company`, `message`, `priority`.
- Realtime gjør at nye saker dukker opp i Tabell og Kanban.

## Demo/fallback

Når Supabase env mangler, viser Phoenix Demo mode. LocalStorage brukes fortsatt for ikke-migrerte eller demo-orienterte flater.

## Neste historiske steg fra v1

- Lage Supabase-tabeller/migrasjoner for tidlige Phoenix-tabeller.
- Bytte lokal data fra `localStorage` til Supabase CRUD.
- Koble eksisterende `requests`/quotes-data inn i Phoenix.
- Legge til rolle-/RLS-policyer før produksjonsbruk.
