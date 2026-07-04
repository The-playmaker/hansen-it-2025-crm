# Phoenix Docs v1.0

**Project Phoenix – The Living Architecture of Project Phoenix**

Phoenix Docs er den levende utviklerportalen for Project Phoenix og Hansen IT. Dette er prosjektets **single source of truth** for strategi, arkitektur, datamodell, API-er, sikkerhet, AI, moduler, rapporter, drift og roadmap.

## Formål

Phoenix skal ikke bare være et CRM. Phoenix skal bli en samlet IT-plattform for Hansen IT og fremtidige kunder:

- CRM og kundeoppfølging
- Requests, leads, tilbud og kundeportal
- Security Scan og rapportmotor
- NOC og overvåking
- SOC og sikkerhetsanalyse
- Asset management og dokumentasjon
- AI-assistent for teknikere, kunder og rapporter

## Brukere av dokumentasjonen

Phoenix Docs skrives for fire målgrupper:

1. **Utviklere** – mennesker, Codex, Cursor og Claude.
2. **Teknikere** – Hansen ITs rutiner, runbooks og arbeidsflyt.
3. **Ledelse/produkt** – roadmap, forretning og prioritering.
4. **AI** – strukturert kontekst som kan brukes til å generere riktig kode, rapporter og dokumentasjon.

## Hovedregel

> Ingen større modul bygges før den er beskrevet i Phoenix Docs.

Dette betyr:

- Ny datamodell skal dokumenteres før implementering.
- Nye API-er skal dokumenteres før eller samtidig med kode.
- Nye moduler skal ha problem, bruker, scope og roadmap.
- Nye arkitekturvalg skal ha en ADR.
- Nye større forslag skal starte som RFC.

## Struktur

```text
docs/
├── 00-introduction/
├── 01-vision/
├── 02-philosophy/
├── 03-architecture/
├── 04-platform-core/
├── 05-database/
├── 06-api/
├── 07-security/
├── 08-ai/
├── 09-design-system/
├── 10-modules/
├── 11-integrations/
├── 12-reports/
├── 13-deployment/
├── 14-roadmap/
├── 15-business/
├── 16-operations/
├── 17-testing/
├── 18-runbooks/
├── 19-adr/
└── 20-rfc/
```

## Status

Dette er **Draft 0.1** av Phoenix Docs v1.0. Dokumentasjonen skal bygges iterativt sammen med produktet.

## Neste steg

1. Låse terminologi for CRM-flyten: `requests → leads → customers → quotes → projects/tickets`.
2. Dokumentere Supabase-tabeller og relasjoner.
3. Dokumentere Phoenix Scan, rapportmotor og Scan Authorization Flow.
4. Dokumentere quote portal og kundedialog.
5. Etablere ADR- og RFC-prosess.
