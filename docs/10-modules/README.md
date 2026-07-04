# Phoenix Modules

Dette er moduloversikten for Project Phoenix. Den beskriver hva hver modul eier, ikke en ønskeliste.

## CRM

Eier daglig kundeflyt:
- requests og leads
- customers og contacts
- tasks/kanban
- quotes og quote portal
- idébank

CRM er operativ base. Nye kommersielle muligheter skal starte som `requests` eller `leads`, ikke som frie notater.

## Scan / Security Insight

Eier passiv og autorisert sikkerhetsinnsikt:
- domain scan
- email/security scan
- subdomain discovery
- scan authorization
- scan jobs
- findings med severity

Public scan skal være passiv. Aktiv skanning krever signert authorization og definert scope.

## Reports

Eier rapportproduksjon og distribusjon:
- scan reports
- PDF/JSON eksport
- delbare token-lenker
- e-postsending
- executive/technical/compliance views

Reports skal gjøre funn forståelige og handlingsbare for kunde, ledelse og tekniker.

## Customer Portal

Eier eksterne tokenbaserte kundeopplevelser:
- quote portal
- scan authorization portal
- public security report portal

Portal skal ikke kreve admin-login. All tilgang styres med lange, random tokens og utløp der det er relevant.

## NOC

Planlagt modul for driftsovervåking.

Skal eie:
- availability
- incidents
- service health
- driftsvarsler
- månedlig driftsrapport

NOC skal ikke blandes med salg/CRM, men kan opprette tasks og rapporter.

## SOC

Planlagt modul for sikkerhetsovervåking.

Skal eie:
- security events
- vulnerability findings
- incident response
- risk status
- security reports

SOC skal bruke samme customers/assets/funnmodell som Scan der det er praktisk.

## AI Engine

Planlagt assistentlag, ikke source of truth.

Skal kunne:
- oppsummere rapporter
- foreslå tiltak
- klassifisere henvendelser
- hjelpe med dokumentasjon

AI skal aldri skrive kritiske data uten eksplisitt brukerhandling.

## Assets

Planlagt/gradvis modul for kundens eiendeler:
- lokasjoner
- servere
- nettverksutstyr
- klienter
- lisenser
- IoT-enheter

Assets skal kobles til customers, tasks, scan findings og NOC/SOC-hendelser.

## Documentation

Eier Phoenix sin interne fasit:
- arkitektur
- datamodell
- API-prinsipper
- ADR-er
- RFC-er
- modulkontrakter

Dokumentasjon skal være praktisk nok til at Codex/Cursor/Claude kan implementere uten å finne opp nye regler.
