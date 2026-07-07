# Quote / Portal E2E Checklist

## Test 1: Clean start

1. Gå til `/admin/settings/data-cleanup`.
2. Velg `Testdata-opprydding`.
3. Bekreft med `SLETT TESTDATA`.
4. Opprett ny henvendelse via public contact form.
5. Konverter request til kunde fra `/admin/leads`.
6. Opprett scan authorization og kjør passiv scan.
7. Generer samlet rapport.
8. Bruk `Opprett/oppdater tilbud fra anbefalte pakker`.
9. Åpne quote admin og trykk `Klargjør kundeportal`.
10. Bekreft at checklisten er grønn.
11. Åpne portal i inkognito.
12. Last ned PDF-er, send melding, be om endring og godkjenn tilbud.

## Test 2: Ristesund

- request_id: `7de38205-7f93-4c23-a5c1-7d12ede2058e`
- quote_id: `b05134fc-b5a8-45ff-bf31-dc2fb5cc0f16`
- customer_id: `fcdc0794-0952-4b1f-bd15-f78c22da359b`

1. Åpne `/admin/quotes/b05134fc-b5a8-45ff-bf31-dc2fb5cc0f16`.
2. Bekreft at produktpakker vises.
3. Bekreft at `Tilbud PDF` og `Samlet sikkerhetsrapport` vises i dokumentlisten.
4. Trykk `Klargjør kundeportal`.
5. Bekreft `quote_items`, `quote_total`, `portal_token`, `quote_pdf`, `scan_pdf`, `documents_visible`, `download_ready`, `approval_actions` og `messages`.
6. Test portal download på begge PDF-er.
7. Åpne portal i inkognito.
8. Bekreft pakker, pris, dokumenter, meldinger og godkjenn/be om endring.
