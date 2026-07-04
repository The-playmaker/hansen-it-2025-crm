# Phoenix API

Phoenix API-er skal være enkle, server-side først og trygge å bruke fra Codex/Cursor/Claude uten å gjette på sikkerhetsmodell.

## Prinsipper

- Server-side først: all skriving til Supabase går via Next.js API-ruter.
- Service role key skal aldri importeres i klientkomponenter.
- Klienter skal bruke interne API-ruter, ikke skrive direkte til produksjonstabeller.
- Public endpoints skal være små, validerte og uten tilgang til admin-data.
- API-er skal returnere norsk, kontrollert feilmelding når miljøvariabler eller tabeller mangler.

## Auth

Adminruter under `/api/admin/*` krever Phoenix-session via `requireMe()`.

Public ruter er kun for spesifikke formål:
- `/api/public/contact`
- `/api/public/site-content`
- `/api/portal/*` med token

Token-ruter skal bruke lange random tokens, utløp der det er relevant og aldri service role key i frontend.

## Rate limit

Rate limit er et krav før bred produksjonseksponering av public endpoints.

Minimumsregel:
- Public contact og portal-actions skal begrenses per IP.
- Admin-ruter kan starte uten rate limit, men skal logge misbrukbare handlinger.
- Scan-relaterte actions skal ikke trigge aktiv skanning uten signert authorization.

Hvis rate limit mangler i kode, skal ny public API dokumentere dette som et kjent kontrollpunkt og ikke skjule risikoen.

## Audit log

Handlinger som endrer forretningsdata eller sikkerhetsdata bør kunne spores.

Skal logges:
- request -> lead/kunde-konvertering
- quote portal-meldinger og godkjenning/avslag
- scan authorization-signering
- opprettelse av scan jobs
- rapportdeling og rapportsending

Minimumsfelt:
- actor eller token-subjekt
- action
- entity type og id
- timestamp
- IP-adresse for public/token handlinger
- relevant metadata

## API naming

Navngiving skal følge ressurs og handling:

- Liste/opprett: `/api/admin/<resource>`
- Detalj/endre: `/api/admin/<resource>/[id]`
- Handling: `/api/admin/<resource>/[id]/<action>`
- Public lesing: `/api/public/<resource>`
- Tokenportal: `/api/portal/<resource>/[token]`

Eksempler:
- `POST /api/admin/requests/[id]/convert`
- `POST /api/admin/security/reports/[id]/share`
- `POST /api/admin/security/reports/[id]/send`
- `GET /api/portal/security-report/[token]`

## Error format

Standard feilformat:

```json
{
  "error": "Kort norsk feilmelding.",
  "code": "optional_machine_code"
}
```

For leseruter som også kan returnere demo/not configured:

```json
{
  "configured": false,
  "data": [],
  "message": "Supabase er ikke konfigurert."
}
```

Regler:
- 400 for ugyldig input.
- 401 for manglende admin-session.
- 403 for manglende rettighet når rollemodell finnes.
- 404 for manglende ressurs/token.
- 410 for utløpt token.
- 500 for ukjent serverfeil.
- 503 når nødvendig miljøkonfig mangler.

Ikke returner rå Supabase-feil til public klienter. Logg teknisk detalj server-side og returner kontrollert melding.
