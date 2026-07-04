# 03 Architecture

## Overordnet arkitektur

Project Phoenix bygges som en modulær plattform hvor alle moduler deler samme kjerne.

```text
Phoenix Platform
│
├── Platform Core
│   ├── Auth
│   ├── Supabase/Postgres
│   ├── Storage
│   ├── Audit Log
│   ├── Notifications
│   ├── Queue/Jobs
│   ├── AI Engine
│   └── API Layer
│
├── CRM
├── Scan
├── Reports
├── Customer Portal
├── NOC
├── SOC
├── Assets
├── Documentation
└── Integrations
```

## Teknologistack

Foretrukket stack:

- Next.js / React
- TypeScript
- Tailwind
- Supabase
- Hono/API-ruter der det passer
- Vercel / Cloudflare
- Docker for selvhostede tjenester
- GitHub som kilde for kode og dokumentasjon

## Arkitekturregel

Phoenix skal ikke bygges som mange separate apper som ikke snakker sammen. Nye moduler skal enten:

1. bygges som modul i hovedplattformen, eller
2. bygges som separat service med tydelig API og dokumentert ansvar.

## Dataflyt

Første prioriterte CRM-flyt:

```text
requests
→ leads
→ customers
→ contacts
→ quotes
→ quote_messages
→ projects/tickets
→ reports
```

## Scan-flyt

```text
scan_authorization
→ scan_scope
→ scan_job
→ scan_result
→ scan_findings
→ scan_report
→ CRM task/quote
```

## Integrasjonsmønster

Integrasjoner skal følge dette mønsteret:

```text
External System
→ Connector/API Client
→ Normalized Data
→ Phoenix Core Tables
→ UI / AI / Reports
```

Eksempler:

- Microsoft 365 → Secure Score, users, MFA, alerts
- FortiGate → firmware, policies, VPN, events
- Proxmox → nodes, VMs, backup status
- Supabase → app data, realtime, auth
