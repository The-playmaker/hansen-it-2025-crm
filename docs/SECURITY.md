# Security

Dette dokumentet beskriver sikkerhetsprinsipper for Project Phoenix CRM.

## Server-side first

Sensitive operasjoner skal skje server-side i Next.js route handlers.

`SUPABASE_SERVICE_ROLE_KEY` er server-side only:

- Skal aldri eksponeres i frontend.
- Skal aldri prefikses med `NEXT_PUBLIC_`.
- Skal bare brukes i API-ruter, serverkode og kontrollerte runner-prosesser.
- Skal ikke logges.

## RLS

RLS må fullføres før bred produksjon.

Minimum som må avklares:

- adminbrukere og roller
- public token-tilgang for quote portal
- public token-tilgang for security report portal
- scan authorization portal
- audit/logging for kritiske handlinger

## Token-portaler

Public portaler bruker lange, random tokens og krever ikke vanlig admin-login:

- `/portal/quote/[token]`
- `/portal/security-report/[token]`
- `/portal/scan-authorization/[token]`

Token skal være langt, random og ikke gjettbart. Service role skal ikke eksponeres for portal-klienter.

## Scan authorization

Aktiv scanning krever signert scan authorization.

Systemet skal logge:

- navn
- e-post
- rolle
- IP-adresse
- timestamp
- scope
- domener
- IP-er
- scan-type
- signaturdata

Etter signering opprettes `scan_jobs` med `status='queued'`.

Passiv DNS/HTTP/TLS/RDAP-sjekk kan kjøres i scan-modulen. Aggressiv portscan, IP-range scanning, credential testing og aktiv angrepstesting skal ikke kjøres uten gyldig signert authorization.

## Scanner runner

`scan_jobs` er en kø. En jobb med `status='queued'` betyr ikke at skanningen kjører. Den venter på en scanner runner.

Statusflyt:

- `queued`: venter på scanner runner
- `running`: runner har plukket opp jobben
- `completed`: passiv scan er lagret som resultater, funn og rapport
- `failed`: runner stoppet kontrollert med trygg feilmelding

Første runner-versjon kjøres server-side fra VPS/scanner-node:

```bash
npm run scanner:run
```

Produksjonsnoden er dokumentert i `docs/runbooks/phoenix-scanner-node.md`:

- host: `phoenix-scan01`
- internal IP: `10.200.1.20`
- egress IP: `185.243.217.163`
- egress type: `shared_proxmox_nat`
- dedicated scanner IP: `false`
- runner path: `/opt/phoenix-scanner/app/scanner-runner.mjs`
- service: `phoenix-scanner.service`
- env file: `/opt/phoenix-scanner/.env`
- mode: `passive`

Påkrevd server-side env:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Valgfri env for aktiv scanning senere:

- `SCANNER_EGRESS_IP`
- `SCANNER_EGRESS_DEDICATED`
- `SCANNER_ALLOW_ACTIVE_SCAN`

`SUPABASE_SERVICE_ROLE_KEY` skal bare finnes på server/scanner-node og aldri i frontend.

## Scanner source IP

Aktiv ekstern scanning skal senere kjøres fra kontrollert Hansen IT scanner-node:

- `scan01.hansen-it.com`
- statisk offentlig IP
- ikke Vercel/serverless
- ikke tilfeldig hjemmenett

Per nå bruker `phoenix-scan01` delt Proxmox/NAT egress IP `185.243.217.163`. Derfor er aktiv scanning deaktivert:

- `SCANNER_EGRESS_DEDICATED=false`
- `SCANNER_ALLOW_ACTIVE_SCAN=false`

Aktiv scanning krever dedikert scanner-IP eller eksplisitt godkjent egress-IP fra kunden. Shared NAT-egress skal kun brukes til passive kontroller.

Kunden kan få oppgitt scanner source IP for whitelist før avtalt aktiv scan.

## Scan scope-regler

Scan-typer:

- `passive`: DNS, HTTP/HTTPS, TLS, security headers og e-post-DNS uten aggressiv probing
- `external_active`: fremtidig autorisert ekstern aktiv scan
- `internal_agent`: fremtidig intern scan via agent, VPN eller avtalt tilgang

`external_active` skal ikke kjøre før alle krav er oppfylt:

- signert scan authorization finnes
- scope er eksplisitt godkjent
- runner har `SCANNER_EGRESS_IP` konfigurert
- target er domene/IP/CIDR i godkjent scope

Før aktiv scan skal domener løses til A/AAAA. MX-, Microsoft-, Google-, CDN- og andre tredjeparts-IP-er skal ikke aktivt skannes uten eksplisitt godkjenning. Public passive scan kan analysere DNS, MX, SPF, DKIM og DMARC uten aktiv scanning.

Internal scan krever agent eller avtalt VPN/tilgang hos kunde.

## Requests og konvertering

`requests` er source of truth for innkommende henvendelser.

Requests konverteres, men slettes aldri. Ved konvertering skal original request beholdes og kobles til lead/customer/contact.

## Webhooks og e-post

Teams, Slack og Resend skal behandles som eksterne integrasjoner:

- webhook-feil skal logges kontrollert
- webhook-feil skal ikke krasje lead-mottak eller rapportflyt
- API keys skal bare ligge i server-side env

## Demo fallback

LocalStorage er kun demo fallback når Supabase mangler. I produksjon skal Supabase være source of truth.

## Admin Auth v2

`/login` bruker Supabase Auth for adminbrukere. Den gamle lokale `phoenixUser`-cookien er ikke lenger produksjonsvei.

Admin-tilgang krever:

- Supabase Auth-bruker.
- Rad i `public.admin_profiles`.
- `is_active=true`.
- Rolle: `owner`, `admin`, `employee` eller `viewer`.

Protected:

- `/admin/*`
- `/api/admin/*`

Public/token-basert og fortsatt uten admin-login:

- `/portal/*`
- `/api/portal/*`
- `/api/public/contact`

`/api/admin/auth/me` returnerer innlogget bruker, admin-profil og rolle uten å eksponere secrets.

Migration:

- `supabase/migrations/20260707133000_admin_profiles_auth.sql`

Migrationen oppretter `admin_profiles` og seeder `flemming@hansen-it.com` som `owner` hvis brukeren allerede finnes i Supabase Auth. Opprett Supabase Auth-brukeren før migrationen kjøres, eller legg inn profilen manuelt etterpå.

Eksempel:

```sql
insert into public.admin_profiles (id, email, name, role, is_active)
select id, email, 'Flemming Hansen', 'owner', true
from auth.users
where lower(email) = lower('flemming@hansen-it.com')
on conflict (id) do update
set role = 'owner', is_active = true, updated_at = now();
```

## Admin roles

Minimumsmodell:

- `owner`: full tilgang.
- `admin`: drift/adminhandlinger.
- `employee`: CRM, quotes, scan/report arbeidsflyt.
- `viewer`: lesetilgang.

Avansert RBAC UI, MFA management og Microsoft/Entra ID SSO er ikke bygget i denne runden, men Supabase Auth-modellen blokkerer ikke dette senere.

## Public contact spam-beskyttelse

`/api/public/contact` er public, men skal ikke bruke anon-key fallback. Endpointet krever `SUPABASE_SERVICE_ROLE_KEY` server-side for lagring, validerer input, bruker Cloudflare Turnstile og har enkel rate limit per IP/e-post.

Miljøvariabler:

- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`
- `CAPTCHA_REQUIRED=true`
- `CAPTCHA_BYPASS_FOR_PREVIEW=false`
- `CAPTCHA_BYPASS_FOR_PRODUCTION=false`

Bypass i production anbefales ikke.

## Production checklist

- Supabase Auth-brukere er opprettet.
- `admin_profiles` har riktige roller og `is_active=true`.
- `SUPABASE_SERVICE_ROLE_KEY` finnes bare server-side.
- RLS-policyer er vurdert/ferdigstilt før bred produksjon.
- Public portal-tokens er lange, random og har utløp der det er relevant.
- Aktiv scanning krever signert scan authorization.
- Turnstile er konfigurert for public contact.
