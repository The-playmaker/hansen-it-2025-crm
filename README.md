# Hansen IT CRM v1.5 (Next.js + Supabase + Azure AD + Realtime)

## Miljøvariabler (.env.local / Vercel)
```
# Supabase (klient)
NEXT_PUBLIC_SUPABASE_URL=<<https://xyzcompany.supabase.co>>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<<anon public key>>

# Supabase (server)
SUPABASE_URL=<<https://xyzcompany.supabase.co>>
SUPABASE_SERVICE_ROLE_KEY=<<service role key>>
```

## Supabase tabell og endringer
Kjør i Supabase SQL Editor:
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
  assigned_to text,
  internal_notes text
);
alter table public.requests enable row level security;
create policy "allow all via service role" on public.requests for all using (true) with check (true);
```

## Azure AD som provider (Supabase Auth)
1. I Azure Portal → App registrations → New registration
   - Name: Hansen IT CRM
   - Redirect URI: `https://<your-domain>/` (valgfritt nå)
2. Kopier **Client ID** og opprett **Client Secret**
3. I Supabase → Authentication → Providers → Azure
   - Client ID = fra Azure
   - Secret = fra Azure
   - Allowed callback URL: `https://<your-domain>/dashboard`
   - Allowed logout URL: `https://<your-domain>/login`
4. I `.env.local` fyll inn `NEXT_PUBLIC_SUPABASE_URL` og `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Koble n8n → Supabase
I n8n-workflowen din, etter Webhook/Set:
- Legg til **Supabase (Insert)**-node
- Mapp felter: name, email, company, message, priority (status settes automatisk til 'Ny')

## Kjør lokalt
```bash
npm install
npm run dev
```
Åpne http://localhost:3000/login → logg inn med Microsoft.

## Deploy (Vercel)
Legg til env-variabler (både NEXT_PUBLIC_* og server-keys) i Vercel → Deploy.
