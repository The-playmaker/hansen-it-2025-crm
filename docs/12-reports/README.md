# Phoenix Report Engine

Phoenix Report Engine skal gjøre tekniske data om til beslutningsgrunnlag. Rapporten skal alltid kunne spores tilbake til kunde, scope, funn og anbefalt tiltak.

## Rapporttyper

### Executive Report

For daglig leder eller kundeansvarlig.

Innhold:
- totalscore
- kort risikobilde
- topp 3 tiltak
- estimert innsats
- “Fix with Hansen IT”

Skal unngå teknisk støy og forklare forretningsrisiko.

### Technical Report

For tekniker eller IT-ansvarlig.

Innhold:
- alle funn
- severity
- teknisk forklaring
- evidens
- anbefalt retting
- scope og scan-type

Skal være presis nok til å jobbe fra.

### Compliance Report

For revisjon, policy og dokumentasjon.

Innhold:
- scope
- tidspunkt
- metode
- funn per kontrollområde
- status for tiltak
- avgrensninger

Skal skille tydelig mellom observert funn og anbefaling.

### Board Report

For styre/ledelse.

Innhold:
- trend
- risikokategori
- økonomisk/operativ konsekvens
- beslutninger som trengs

Skal være kort, tydelig og handlingsorientert.

### Monthly Report

For fast kundeoppfølging.

Innhold:
- månedens status
- nye funn
- lukkede funn
- åpne tiltak
- neste anbefalte steg

Skal kunne brukes i serviceavtaler og QBR/månedsmøter.

## PDF design principles

- Bruk Hansen IT-logo på første side.
- Bruk Hansen IT-paletten: Marine `#152149`, Blå `#1D6FE0`, Blå lys `#3FA1FF`, Grå tekst `#3A4A6B`.
- Executive reports skal fremstå som profesjonelle konsulentrapporter.
- Første side skal gi score, grade, domene/kunde, dato og topp tiltak.
- Bruk statusfarger konsekvent: kritisk/høy/middels/lav/ok.
- Ikke drukn kunden i rådata.
- Vis tekniske detaljer etter executive summary.
- Hver anbefaling skal ha konkret neste handling.
- PDF skal være lesbar på skjerm og utskrift.
- Ingen dekor som gjør rapporten treg, tung eller vanskelig å lese.

Standard dokumentdato er `Dato: [dato]`. Ikke hardkod geografisk sted i rapportmaler. Hvis et dokument faktisk trenger sted, brukes valgfritt `place?: string` og rendres som `{place}, {date}`. Uten sted rendres `Dato: {date}`.

## Score visualisering

Score skal ikke stå alene.

Minimum:
- totalscore 0-100
- grade A-E
- kategorier: web, email, domain/security
- spoofing-risk der relevant
- antall funn per severity

Score skal alltid kobles til tiltak. En lav score uten anbefaling er ubrukelig.

## “Fix with Hansen IT”

Alle rapporter skal kunne konverteres til handling.

Mønstre:
- “Create CRM lead” fra funn
- “Create task” fra funn
- “Fix with Hansen IT” i kundevennlig rapport
- tilbud kan opprettes fra prioriterte tiltak

Knappen/CTA skal ikke love automatisk retting. Den skal starte en kontrollert CRM-flyt hvor Hansen IT vurderer scope, pris og ansvar.
