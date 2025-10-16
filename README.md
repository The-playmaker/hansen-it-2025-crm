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
