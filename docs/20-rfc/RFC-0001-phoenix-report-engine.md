# RFC-0001: Phoenix Report Engine

## Problem

Phoenix har scan-data, funn og CRM-handlinger, men rapportering må bli en egen motor slik at samme datagrunnlag kan brukes mot ulike mottakere:

- kundeansvarlig trenger kort oppsummering
- tekniker trenger detaljer og evidens
- ledelse trenger risiko og prioritering
- kunde trenger tydelige tiltak og neste steg

Uten en rapportmotor blir PDF, portalvisning, e-post og CRM-actions ulike varianter av samme logikk.

## Forslag

Lag Phoenix Report Engine som felles lag for rapportstruktur, visualisering og distribusjon.

Motoren skal:
- lese rapportdata fra `scan_reports` eller lagrede security scan reports
- normalisere funn til severity og kategori
- lage executive summary
- produsere PDF
- produsere portalvisning
- støtte delbar token-lenke
- støtte e-postsending av rapportlenke
- koble funn til CRM lead/task/quote

## MVP

MVP skal støtte:

- Security Scan Report
- PDF eksport
- JSON eksport
- delbar token-lenke
- e-postsending via Resend
- portalvisning uten innlogging
- “Create CRM lead/task” fra funn
- score, grade, summary, spoofing-risk, subdomener, funn og tiltak

MVP skal ikke prøve å være et generelt BI-verktøy.

## Out of scope

Ikke i første RFC:

- full rapportdesigner
- drag-and-drop PDF-builder
- AI-genererte rapporter uten godkjenning
- automatisk prising
- faktura
- avansert compliance mapping
- multi-language rapportmotor

## Åpne spørsmål

- Skal rapporter lagres som generert PDF i Supabase Storage, eller genereres on-demand?
- Skal `scan_reports` erstatte `security_scan_reports`, eller leve parallelt i en overgang?
- Skal “Fix with Hansen IT” opprette lead, task eller quote først?
- Skal rapportmaler kunne redigeres i CRM?
- Hvilke compliance-rammeverk er viktigst først: NSM grunnprinsipper, CIS Controls, ISO 27001 eller NIS2?
- Skal kunder kunne kommentere på rapportfunn i portal?
