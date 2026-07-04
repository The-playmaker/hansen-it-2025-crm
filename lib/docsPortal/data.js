export const docsNav = [
  { label: "Overview", href: "/admin/docs" },
  { label: "Vision", href: "/admin/docs#vision" },
  { label: "Philosophy", href: "/admin/docs#philosophy" },
  { label: "Architecture", href: "/admin/docs/architecture" },
  { label: "Platform Core", href: "/admin/docs/architecture#platform-core" },
  { label: "Database", href: "/admin/docs/database" },
  { label: "APIs", href: "/admin/docs/architecture#apis" },
  { label: "Security", href: "/admin/docs/architecture#security" },
  { label: "AI Engine", href: "/admin/docs/modules#ai-engine" },
  { label: "Design System", href: "/admin/docs#design-system" },
  { label: "Modules", href: "/admin/docs/modules" },
  { label: "Integrations", href: "/admin/docs/modules#integrations" },
  { label: "Reports", href: "/admin/docs/reports" },
  { label: "Deployment", href: "/admin/docs/architecture#deployment" },
  { label: "Roadmap", href: "/admin/docs#roadmap" },
  { label: "Business", href: "/admin/docs/modules#business" },
  { label: "Operations", href: "/admin/docs/modules#operations" },
  { label: "Testing", href: "/admin/docs#testing" },
  { label: "Runbooks", href: "/admin/docs#runbooks" },
  { label: "ADR", href: "/admin/docs/adr-rfc#adr" },
  { label: "RFC", href: "/admin/docs/adr-rfc#rfc" }
];

export const quickModules = [
  { title: "CRM", status: "active", description: "Requests, leads, customers, contacts, tasks og quotes.", metric: "Core" },
  { title: "Scan", status: "active", description: "Passiv security insight og signert scan authorization.", metric: "Security" },
  { title: "Reports", status: "active", description: "PDF, JSON, delte rapportlenker og Resend-distribusjon.", metric: "Engine" },
  { title: "AI", status: "planned", description: "Assistentlag for oppsummering, forslag og dokumentasjon.", metric: "Guarded" },
  { title: "NOC", status: "planned", description: "Availability, incidents, service health og driftsrapporter.", metric: "Ops" },
  { title: "SOC", status: "planned", description: "Security events, incident response og risikostatus.", metric: "Risk" },
  { title: "Customer Portal", status: "active", description: "Tokenbaserte quote-, scan authorization- og report-portaler.", metric: "Portal" }
];

export const currentFocus = [
  "Supabase som source of truth for CRM-data",
  "Scan authorization før aktiv skanning",
  "Report Engine med deling, PDF og kundevennlig portal",
  "Dokumentasjon som fasit for Codex/Cursor/Claude"
];

export const architectureRules = [
  "Service role key brukes kun server-side.",
  "Public portaltilgang krever lange, random tokens.",
  "LocalStorage er kun demo fallback når Supabase mangler.",
  "Requests konverteres, men slettes aldri.",
  "Aktiv skanning krever signert authorization."
];

export const nextDecisions = [
  "RLS-policyer for admin og portalbrukere",
  "Om scan_reports skal erstatte security_scan_reports",
  "Hvordan Fix with Hansen IT skal bli quote-flyt",
  "Første AI Engine use case og godkjenningsmodell"
];

export const architectureLayers = [
  { title: "Experience Layer", status: "active", items: ["Admin CRM", "Developer Portal", "Customer Portal", "Security Report Portal"] },
  { title: "API Layer", status: "active", items: ["Next.js route handlers", "Server-side Supabase admin", "Public token APIs", "Resend report delivery"] },
  { title: "Data Layer", status: "active", items: ["Supabase/Postgres", "JSONB reports", "CRM relations", "Audit-ready scan tables"] },
  { title: "Automation Layer", status: "planned", items: ["Scan runners", "NOC jobs", "SOC findings", "AI summaries"] }
];

export const databaseFlows = [
  {
    title: "CRM Flow",
    status: "active",
    nodes: ["requests", "leads", "customers", "contacts", "quotes"],
    description: "Innkommende henvendelser blir kvalifisert til leads, koblet til kunde/kontakt og ender i tilbud."
  },
  {
    title: "Quote Portal",
    status: "active",
    nodes: ["quotes", "quote_items", "quote_messages", "quote_tokens"],
    description: "Tilbud har linjer, kunde-dialog og sikker tokenbasert portaltilgang."
  },
  {
    title: "Content & Ideas",
    status: "active",
    nodes: ["phoenix_ideas", "phoenix_site_content"],
    description: "Idébank og nettsideinnhold ligger i Supabase, med demo fallback kun uten env."
  },
  {
    title: "Scan Authorization",
    status: "active",
    nodes: ["scan_authorizations", "scan_scopes", "scan_jobs", "scan_results", "scan_findings", "scan_reports"],
    description: "Kunde signerer scope før jobb køes; resultater, funn og rapporter bygges fra samme kjede."
  }
];

export const modules = [
  { id: "crm", title: "CRM", status: "active", owner: "Phoenix Core", description: "Daglig operativ kundebase for requests, leads, customers, contacts, tasks og quotes.", inputs: ["requests", "contact forms"], outputs: ["leads", "quotes", "tasks"] },
  { id: "scan", title: "Scan / Security Insight", status: "active", owner: "Security", description: "Passiv domain/email scan, subdomain discovery og signert scan authorization.", inputs: ["domains", "scan scopes"], outputs: ["findings", "scan reports"] },
  { id: "reports", title: "Reports", status: "active", owner: "Delivery", description: "Executive, technical og customer-friendly rapporter med PDF, JSON og deling.", inputs: ["findings", "quotes"], outputs: ["PDF", "portal links", "tasks"] },
  { id: "portal", title: "Customer Portal", status: "active", owner: "Customer Experience", description: "Tokenbaserte kundevisninger for tilbud, scan authorization og sikkerhetsrapporter.", inputs: ["tokens"], outputs: ["messages", "approvals", "signatures"] },
  { id: "noc", title: "NOC", status: "planned", owner: "Operations", description: "Availability, service health, incidents og månedlig driftsrapport.", inputs: ["assets", "monitors"], outputs: ["incidents", "monthly reports"] },
  { id: "soc", title: "SOC", status: "planned", owner: "Security", description: "Security events, incident response, vulnerability findings og risk status.", inputs: ["events", "scan findings"], outputs: ["cases", "risk reports"] },
  { id: "ai-engine", title: "AI Engine", status: "planned", owner: "Assistive Layer", description: "Oppsummering, forslag og dokumentasjon. Skriver ikke kritiske data uten brukerhandling.", inputs: ["reports", "notes"], outputs: ["drafts", "recommendations"] },
  { id: "assets", title: "Assets", status: "planned", owner: "Operations", description: "Kundens lokasjoner, servere, nettverk, klienter, lisenser og IoT-enheter.", inputs: ["customers", "locations"], outputs: ["asset inventory", "risk context"] },
  { id: "documentation", title: "Documentation", status: "active", owner: "Engineering", description: "Fasit for arkitektur, database, API, ADR, RFC og modulkontrakter.", inputs: ["docs", "decisions"], outputs: ["implementation guidance"] }
];

export const reportTypes = [
  { title: "Executive Report", status: "active", audience: "Daglig leder", description: "Score, risikobilde, topp 3 tiltak og tydelig neste steg." },
  { title: "Technical Report", status: "active", audience: "Tekniker", description: "Alle funn, severity, evidens, anbefalt retting og scope." },
  { title: "Compliance Report", status: "planned", audience: "Revisjon", description: "Metode, kontrollområder, avgrensninger og status per tiltak." },
  { title: "Board Report", status: "planned", audience: "Styre", description: "Trend, risiko, konsekvens og beslutninger som trengs." },
  { title: "Monthly Report", status: "planned", audience: "Fast kunde", description: "Månedens status, nye/lukkede funn, åpne tiltak og neste anbefalte steg." }
];

export const decisions = [
  {
    type: "ADR",
    id: "ADR-0001",
    title: "Supabase as primary database",
    status: "accepted",
    decision: "Supabase/Postgres er primær database for CRM, CMS, scan authorization, rapporter og portaldata.",
    alternatives: ["Firebase", "MongoDB", "Egen Postgres"],
    consequences: ["Relasjonell datamodell er standard", "Service role holdes server-side", "RLS må innføres før bred produksjon"]
  },
  {
    type: "RFC",
    id: "RFC-0001",
    title: "Phoenix Report Engine",
    status: "draft",
    decision: "Rapportmotoren skal normalisere funn til PDF, portalvisning, deling og CRM-actions.",
    alternatives: ["Separate PDF-komponenter per modul", "Manuell rapportproduksjon", "Ekstern BI før MVP"],
    consequences: ["Én rapportkontrakt", "PDF/portal/e-post deler samme datagrunnlag", "Åpne spørsmål om lagret PDF vs on-demand"]
  }
];
