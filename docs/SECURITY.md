# Security

Dette dokumentet beskriver sikkerhetsprinsipper for Project Phoenix CRM.

## Server-side first

Sensitive operasjoner skal skje server-side i Next.js route handlers.

`SUPABASE_SERVICE_ROLE_KEY` er server-side only:

- Skal aldri eksponeres i frontend.
- Skal aldri prefikses med `NEXT_PUBLIC_`.
- Skal bare brukes i API-ruter/serverkode.
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

Public portaler bruker lange, random tokens og krever ikke innlogging:

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

Passiv DNS/HTTP/TLS/RDAP-sjekk kan kjøres i scan-modulen, men aggressiv portscan, IP-range scanning, credential testing og aktiv angrepstesting skal ikke kjøres uten gyldig signert authorization.

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
