# Phoenix Design System: Hansen IT

Dette dokumentet er fasit for Hansen IT-branding i Project Phoenix. Brandingen skal brukes kontrollert: tydelige merkevareflater først, ikke full redesign av eksisterende CRM.

## Farger

| Token | Hex | Bruk |
| --- | --- | --- |
| `--hi-marine` | `#152149` | Hovedfarge, mørke flater, rapport-header |
| `--hi-marine-deep` | `#1B2A52` | Dype bakgrunner, gradient-start, rammer |
| `--hi-blue` | `#1D6FE0` | Primær aksent, CTA, lenker, rapportlinjer |
| `--hi-blue-light` | `#3FA1FF` | Aksent på mørk bakgrunn, fokus og highlights |
| `--hi-text-muted` | `#3A4A6B` | Sekundærtekst på lyse dokumentflater |
| `--hi-gray-light` | `#8B96AC` | Diskret metadata, footer, org.nr |

Eksisterende Tailwind theme skal ikke byttes globalt i CRM før en egen redesign-oppgave. Nye Phoenix-komponenter kan bruke CSS variables direkte.

## Typografi

- Logo/brand-headlines: Arial Black eller Arial Bold der dokumentformatet støtter det.
- UI: behold eksisterende app-font inntil full design-system migrering.
- Tagline skrives i versaler eller små caps med økt bokstavavstand når den brukes som brand-element.

Standard tagline:

`Infrastruktur · Nettverk · Support · Cybersikkerhet`

Ikke bruk eldre variant uten `Cybersikkerhet`.

## Logo Usage

- Lys bakgrunn: bruk `logo-horizontal.svg` eller `logo-horizontal.png`.
- Mørk bakgrunn: bruk `logo-horizontal-dark.svg` eller `logo-horizontal-dark.png`.
- Små ikoner, app icon og favicon: bruk `logo-icon.*` og favicon-filene.
- UI prioriterer SVG der det fungerer.
- PDF, e-postrendering og jsPDF bruker PNG når SVG-støtte er usikker.
- Logo skal ha ro rundt seg. Ikke plasser logo på urolig bakgrunn.

Runtime-assets ligger i:

`public/brand/hansen-it/`

Dokumentasjonskopier og referanser ligger i:

`docs/09-design-system/brand/`

## Public Asset Policy

`public/` er web-tilgjengelig. Legg bare filer der som bevisst skal kunne serveres til nettleser.

Tillatt i `public/brand/hansen-it/`:

- logoer som brukes i UI/PDF
- favicon og app icons
- optimaliserte SVG/PNG som appen faktisk trenger

Ikke tillatt i `public/`:

- hele zip-pakker
- DOCX
- PDF/trykkfiler
- base64 e-postsignaturer
- interne kildemaler som ikke skal lastes ned fra web

CRM og hansen-it.com skal ha egne lokale assets i hvert repo. Ingen av repoene skal hente brand-assets fra det andre.

## Spacing

- CRM/Developer Portal bruker kompakte enterprise-flater.
- Kort bør normalt ha 4-8 px radius og tydelige, men subtile rammer.
- Logo skal ha minst høyden av H-merket som klaring når layouten tillater det.
- Ikke øk spacing på eksisterende CRM-sider bare for branding.

## Dark Mode

Phoenix er dark-first. På mørke flater skal dark-background logo brukes, ikke lys-bakgrunn-logo. Primær aksent er `--hi-blue-light` på mørk marine/svart bakgrunn.

## Rapportdesign

PDF-rapporter skal:

- bruke Hansen IT-logo på første side
- bruke `--hi-marine` og `--hi-blue` som hovedpalett
- ha tydelig score, dato, kunde/domene, executive summary og topp tiltak
- se ut som profesjonelle konsulentrapporter
- forklare risiko og neste steg uten å drukne kunden i rådata

Standard dokumentdato:

`Dato: [dato]`

Hvis et spesifikt dokument trenger sted, brukes valgfritt felt:

- `place?: string`
- hvis `place` finnes: `{place}, {date}`
- hvis `place` mangler: `Dato: {date}`

Ikke hardkod geografisk profilering i maler.

## E-postsignatur

`epost-signatur-flemming.html` finnes som brand asset i merkevarepakken. Den skal ikke brukes som runtime dependency i appen og skal ikke ligge i `public/`.

Hvis signaturen legges i repo for dokumentasjon, skal den ligge under:

`docs/09-design-system/brand/email-signature/`

## PDF og Brevark

Brevark og visittkort er print/dokument-assets. De skal ikke ligge i `public/` med mindre de bevisst skal kunne lastes ned fra nettsiden.

Hvis de legges i repo, skal de ligge under:

`docs/09-design-system/brand/print/`

Standard brevark/PDF-header skal bruke kontaktinfo, org.nr, web, telefon og e-post. Geografisk sted skal ikke brukes som standard identitet.
