# Hansen IT CRM Dashboard (Next.js + Supabase)

## Miljøvariabler (.env.local)
```
SUPABASE_URL=<<din supabase url>>
SUPABASE_SERVICE_ROLE_KEY=<<din service role key>>
BASIC_AUTH_USER=hansen
BASIC_AUTH_PASS=dev1234
```

## Supabase tabell
Kjør i Supabase SQL editor:
```sql
create extension if not exists pgcrypto;
create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  name text,
  email text,
  company text,
  message text,
  priority text check (priority in ('normal','hast')) default 'normal',
  status text check (status in ('Ny','Pågår','Fullført')) default 'Ny',
  assigned_to text
);
alter table public.requests enable row level security;
create policy "allow all via service role" on public.requests for all using (true) with check (true);
```

## Koble n8n → Supabase
I n8n: legg til "Supabase" node (Insert) etter Webhook/Set, mapp felter til `requests` tabellen.

## Lokal utvikling
```bash
npm install
npm run dev
```
Åpne http://localhost:3000/dashboard (bruk basic auth).

## Deploy (Vercel)
Sett env-variabler i Vercel Project Settings, deploy.
