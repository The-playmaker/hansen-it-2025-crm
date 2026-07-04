# Phoenix Database

Dette dokumentet er fasit for Phoenix CRM sin kjerne-datamodell. Supabase/Postgres er primær database. `requests`, `services`, `employees` og eldre `quote_*`-tabeller gjenbrukes der de allerede finnes.

## CRM-tabeller

### `requests`
Source of truth for innkommende henvendelser fra nettside, kontaktskjema og tilbudsskjema.

Forventede felt:
- `id`, `name`, `email`, `phone`, `company`, `message`, `description`
- `priority`: `normal` eller `hast`
- `status`: `ny`, `pågår`, `fullført`, `arkivert`, `converted`
- `customer_id`, `contact_id`, `lead_id`
- `converted_at`, `converted_to_customer`
- `created_at`, `updated_at`

Original request skal aldri slettes ved konvertering.

### `leads`
Representerer salgsmulighet/opportunity etter at en request er kvalifisert.

Viktige felt:
- `customer_id`, `contact_id`
- `source_request_id`
- `title`, `description`, `status`, `value_estimate`
- `source`, `created_at`, `updated_at`

### `customers`
Kunderegisteret for firmaer.

Viktige felt:
- `company_name`, `organization_number`
- `email`, `phone`, `website`, `address`
- `customer_type`
- `status`: typisk `lead`, `active`, `inactive`
- `notes`, `source`

### `contacts`
Kontaktpersoner knyttet til kunder.

Viktige felt:
- `customer_id`
- `name`, `email`, `phone`, `role`
- `is_primary`, `notes`

### `quotes`
Tilbudsheader. Kan kobles til kunde, kontakt, lead eller original request.

Viktige felt:
- `customer_id`, `contact_id`, `lead_id`, `source_request_id`
- `title`, `description`
- `status`: `kladd`, `sendt`, `godkjent`, `avslått`
- `valid_until`
- `total_ex_vat`, `total_vat`, `total_inc_vat`
- `internal_notes`, `customer_note`

### `quote_items`
Linjevarer/tjenester på tilbud.

Viktige felt:
- `quote_id`
- `description`
- `quantity`, `unit_price`, `discount`, `vat_rate`
- `line_total_ex_vat`

### `quote_messages`
Meldinger mellom kunde og admin i quote portal.

Viktige felt:
- `quote_id`
- `author_id`, `author_name`, `author_type`
- `message`, `created_at`

### `quote_tokens`
Delbare quote portal-tokens.

Viktige felt:
- `quote_id`
- `token`
- `expires_at`, `created_at`

Token skal være lang, random og ikke gjettbar.

### `phoenix_ideas`
Idébank. Skal gjøre det lett å parkere ideer uten å gjøre dem til aktive prosjekter.

Viktige felt:
- `title`, `description`, `category`
- `status`: `parkert`, `vurderes`, `aktiv`, `droppet`

### `phoenix_site_content`
Enkel CMS-kilde for Hansen IT-nettsiden.

Viktige felt:
- `key`, `title`, `content`
- `section`, `page`
- `updated_at`, `created_at`

`content` er JSON og brukes for hero, CTA, tjenester, om oss, kontakttekst og SEO.

## Scan-tabeller

### `scan_authorizations`
Signert kundesamtykke før autorisert skanning.

Viktige felt:
- `token`
- `customer_id`, `contact_id`
- `customer_name`
- `signer_name`, `signer_email`, `signer_role`
- `status`: `draft`, `pending`, `signed`, `revoked`, `expired`
- `terms_version`, `terms_text`
- `signed_at`, `signed_ip`, `signature_data`
- `expires_at`

### `scan_scopes`
Definert scope kunden godkjenner.

Viktige felt:
- `authorization_id`
- `scan_type`: `passive`, `standard`, `extended`
- `domains`, `ip_addresses`
- `allowed_checks`, `exclusions`, `notes`
- `confirmed_by_customer`, `confirmed_at`

### `scan_jobs`
Jobbkø for autoriserte scans. Opprettes automatisk etter signering.

Viktige felt:
- `authorization_id`, `scope_id`
- `status`: `queued`, `running`, `completed`, `failed`, `cancelled`
- `scan_type`, `domains`, `ip_addresses`
- `requested_by_name`, `requested_by_email`, `requested_by_role`, `requested_ip`
- `queued_at`, `started_at`, `completed_at`, `error`, `metadata`

### `scan_results`
Rå resultat fra scan-jobb.

Viktige felt:
- `job_id`, `authorization_id`
- `status`, `summary`
- `raw_result`

### `scan_findings`
Normaliserte funn fra scan-resultater.

Viktige felt:
- `result_id`, `job_id`, `authorization_id`
- `title`, `description`
- `severity`: `critical`, `high`, `medium`, `low`, `info`
- `category`, `recommendation`, `evidence`
- `status`: `open`, `accepted_risk`, `fixed`, `false_positive`

### `scan_reports`
Publiserbar rapport basert på scan-jobb og funn.

Viktige felt:
- `job_id`, `authorization_id`
- `title`, `report`
- `created_at`, `published_at`

## Flyt: requests -> leads -> customers -> quotes

1. Nettsiden sender henvendelse til CRM, som lagrer i `requests`.
2. Admin vurderer henvendelsen på Leads/Requests-siden.
3. Ved konvertering finner eller oppretter systemet `customers` basert på firma/e-post.
4. Systemet finner eller oppretter `contacts` basert på navn/e-post.
5. Systemet oppretter `leads` med `source_request_id`.
6. `requests` oppdateres med `customer_id`, `contact_id`, `lead_id`, `status='converted'`, `converted_at` og `converted_to_customer=true`.
7. Tilbud opprettes i `quotes` og `quote_items`, koblet til customer/contact/lead/request.
8. Kunde kan åpne quote portal via `quote_tokens` eller kompatibel portal-tokenflyt.

## Flyt: scan authorization -> scan job -> scan report

1. Admin oppretter `scan_authorizations` og `scan_scopes`.
2. Kunde åpner token-lenke, leser vilkår, bekrefter scope og signerer.
3. Signering logger navn, e-post, rolle, IP, timestamp, scope og signaturdata.
4. Systemet oppretter `scan_jobs` med `status='queued'`.
5. Scan-runner henter `queued` jobs, kjører bare godkjent scope og skriver `scan_results`.
6. Funn normaliseres til `scan_findings`.
7. Rapport bygges i `scan_reports`.
8. Rapport kan eksporteres, deles eller sendes fra Phoenix Reports.
