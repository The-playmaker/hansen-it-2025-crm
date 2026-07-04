# Database

Supabase/Postgres er primær database for Project Phoenix CRM.

## Migrations

Kjør SQL i Supabase Dashboard eller med Supabase CLI:

```bash
supabase db push
```

Viktige migrations:

- `supabase/migrations/20260701130000_project_phoenix_core.sql`
- `supabase/migrations/20260704193000_security_scan_reports.sql`
- `supabase/migrations/20260704210000_crm_flow_cleanup.sql`
- `supabase/migrations/20260704223000_scan_authorization_flow.sql`
- `supabase/migrations/20260704231500_security_scan_report_sharing.sql`

## Core-tabeller

Phoenix core migration oppretter eller sikrer:

- `customers`
- `customer_contacts`
- `projects`
- `tasks`
- `locations`
- `assets`
- `activity_log`

Eksisterende tabeller som gjenbrukes:

- `requests`
- `services`
- `employees`
- `quote_*`

Casdoor-tabeller skal ikke slettes eller endres.

## Requests

`public.requests` er source of truth for innkommende henvendelser når Supabase er konfigurert.

Minimum forventede felter:

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

Anbefalte felter:

```sql
phone text,
description text,
updated_at timestamptz,
customer_id uuid references customers(id),
converted_at timestamptz,
converted_to_customer boolean default false
```

CRM mapper `requests` til lead-visning:

- `id` -> `id`
- `name` eller `customer_name` -> `name`
- `email` -> `email`
- `company` -> `company`
- `phone` -> `phone` hvis feltet finnes
- `message` eller `description` -> `message`
- `priority` -> `priority`
- `status` -> `status`
- `created_at` -> `created_at`
- `updated_at` -> `updated_at` hvis feltet finnes

`/api/public/contact` skriver nye henvendelser til `requests`. Tidligere forsøkte endpointet primært `phoenix_leads` og brukte `requests` som fallback. Dersom `phoenix_leads` brukes i eldre miljøer, forventes denne modellen:

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

## CRM flow-tabeller

CRM flow cleanup sikrer:

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

Requests konverteres til leads/customers/contacts, men original request slettes ikke.

## CMS

Nettsideinnhold forventes i `phoenix_site_content`.

Forventet enkel modell:

```sql
create table if not exists public.phoenix_site_content (
  id uuid primary key default gen_random_uuid(),
  content jsonb not null,
  updated_at timestamptz default now()
);
```

`content` bør inneholde `heroTitle`, `heroSubtitle`, `ctaText`, `services`, `aboutText`, `contactText`, `seoTitle` og `seoDescription`.

Hvis Supabase er konfigurert men tabellen mangler eller er tom, skal CRM vise ikke konfigurert. Fallback-content brukes bare i demo mode uten Supabase env.

## Scan-tabeller

Security scan reports:

- `security_scan_reports`
- `security_scan_report_shares`
- `security_scan_report_deliveries`

`security_scan_reports` forventet startmodell:

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

Scan authorization flow:

- `scan_authorizations`
- `scan_scopes`
- `scan_jobs`
- `scan_results`
- `scan_findings`
- `scan_reports`

Aktiv scanning skal ikke kjøres uten gyldig signert autorisasjon.

## RLS

RLS policies er ikke fullført for alle tabeller. Før bred produksjon må det legges egne policies for adminbrukere og public token-tilgang.
