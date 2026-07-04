# 02 Philosophy

## The Phoenix Way

Phoenix skal bygges rundt en fast arbeidsmetode:

```text
Observe
→ Discover
→ Analyze
→ Document
→ Plan
→ Implement
→ Verify
→ Monitor
→ Improve
```

Dette gjelder både teknisk arbeid, kundeleveranser og utvikling av selve plattformen.

## Designprinsipper

### 1. Single Source of Truth

Data skal ha én primær kilde. Eksempel:

- `requests` er kilde for innkommende henvendelser.
- `customers` er kilde for kunder.
- `phoenix_ideas` er kilde for idébanken.
- `scan_reports` er kilde for skannerapporter.

Mock-data og localStorage kan brukes som demo/fallback, men aldri som produksjonskilde når Supabase er konfigurert.

### 2. Documentation by Design

Phoenix skal dokumentere arbeid mens det utføres. Dokumentasjon skal ikke være noe som gjøres til slutt hvis man husker det.

### 3. Security by Default

All utvikling skal anta at systemet håndterer sensitiv kundeinformasjon.

Minimum:

- ingen service role key i frontend
- RLS der det gir mening
- audit log for viktige handlinger
- sikker token-håndtering for kundeportal
- eksplisitt samtykke før aktiv scanning

### 4. AI Assisted, Not AI Replaced

AI skal hjelpe teknikeren, kunden og ledelsen, men ikke ukritisk erstatte menneskelig vurdering.

AI kan:

- skrive rapportutkast
- forklare funn
- foreslå tiltak
- analysere logger
- oppsummere kundeinformasjon

AI skal ikke:

- kjøre aktiv scanning uten samtykke
- sende tilbud uten menneskelig kontroll
- endre sikkerhetskritisk konfigurasjon uten godkjenning

### 5. API First

Alle viktige funksjoner skal kunne brukes via API eller backend-funksjon, ikke bare via UI.

### 6. Practical Before Perfect

Phoenix skal løse ekte problemer for Hansen IT først. Perfeksjon kommer etter at arbeidsflyten fungerer.
