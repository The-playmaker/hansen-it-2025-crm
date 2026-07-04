# ADR-0001: Supabase/Postgres som primær database

## Status

Accepted

## Beslutning

Project Phoenix bruker Supabase/Postgres som primær database for CRM, CMS, scan authorization, rapporter og portaldata.

## Alternativer vurdert

### Firebase

Fordeler:
- rask prototyping
- realtime
- enkel klientintegrasjon

Ulemper:
- dokumentmodell passer dårligere for relasjonene i CRM
- svakere SQL-rapportering
- vanskeligere joins mellom customers, leads, quotes, assets og findings

### MongoDB

Fordeler:
- fleksibel dokumentmodell
- rask lagring av ustrukturert scan-data

Ulemper:
- CRM-flyten er relasjonell
- mer arbeid for auth, RLS-lignende tilgang og rapportspørringer
- mindre direkte match med Supabase-klienten som allerede brukes

### Egen Postgres

Fordeler:
- full kontroll
- standard SQL
- enkel migrering fra Supabase senere

Ulemper:
- mer drift
- auth, storage, realtime og API-nøkler må bygges/driftes separat
- tregere utvikling for liten IT-bedrift

## Begrunnelse

Supabase gir rask utvikling uten å gi opp Postgres:

- Postgres passer CRM-relasjoner, rapporter og joins.
- Realtime kan brukes for requests, quotes, meldinger og drift senere.
- Auth og RLS kan innføres gradvis.
- Storage kan brukes for vedlegg, PDF-er og rapportartefakter.
- Service role kan holdes server-side i Next.js API-ruter.
- Supabase Dashboard gjør feilsøking og SQL-kjøring praktisk i tidlig fase.

## Konsekvenser

- Nye moduler skal først vurdere Supabase-tabeller før localStorage/mock.
- Frontend skal ikke bruke service role key.
- Public tokenflyter skal valideres server-side.
- RLS policies må dokumenteres og innføres før bred produksjon.
- JSONB kan brukes for rapportinnhold og scan raw data, men kjerneobjekter skal ha relasjonelle nøkler.
