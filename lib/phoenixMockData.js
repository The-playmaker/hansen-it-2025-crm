export const PHOENIX_STORAGE_KEY = "hansen-it-project-phoenix-v1";

export const customerStatuses = ["lead", "aktiv", "inaktiv"];
export const taskStatuses = ["ny", "pågår", "venter kunde", "ferdig"];
export const quoteStatuses = ["kladd", "sendt", "godkjent", "avslått"];
export const ideaStatuses = ["parkert", "vurderes", "aktiv", "droppet"];
export const priorities = ["lav", "normal", "høy"];

export const phoenixSiteContentFallback = {
  heroTitle: "Smartere IT. Sikrere systemer. Mindre arbeid.",
  heroSubtitle: "Hansen IT kobler automasjon, sikkerhet og drift for små og mellomstore bedrifter som vil ha kontroll uten mer støy.",
  ctaText: "Se tjenester",
  services: [
    {
      title: "Automatisering som tjeneste",
      description: "Praktiske automasjoner som kobler skjema, CRM, rapportering og varsler.",
      href: "/automation"
    },
    {
      title: "Cybersikkerhet",
      description: "Sikkerhetsgjennomgang, Fortinet-oppsett og bedre kontroll på klienter og tilgang.",
      href: "/cyber"
    },
    {
      title: "Infrastruktur og drift",
      description: "Nettverk, serverdrift, backup og løpende IT-støtte for hverdagen.",
      href: "/infrastructure"
    }
  ],
  aboutText: "Hansen IT hjelper bedrifter med ryddig IT-drift, sikkerhet og automatisering. Målet er enkle løsninger som faktisk blir brukt.",
  contactText: "Fortell kort hva du trenger hjelp med, så tar vi kontakt med et konkret forslag.",
  seoTitle: "Hansen IT - Automatisering, sikkerhet og IT-drift",
  seoDescription: "Hansen IT leverer automasjon, cybersikkerhet, infrastruktur og driftstjenester for små og mellomstore bedrifter."
};

export const phoenixMockData = {
  siteContent: phoenixSiteContentFallback,
  leads: [
    {
      id: "lead-1",
      name: "Lars Berg",
      email: "lars@fjordregnskap.no",
      phone: "+47 911 22 333",
      company: "Fjord Regnskap",
      message: "Vi ønsker en prat om fast IT-support og Microsoft 365-sikring.",
      category: "Salg",
      source: "hansen-it-2025",
      status: "ny",
      createdAt: "2026-06-30T08:00:00.000Z"
    },
    {
      id: "lead-2",
      name: "Kari Nordvik",
      email: "kari@nordvikelektro.no",
      phone: "+47 900 10 200",
      company: "Nordvik Elektro AS",
      message: "Trenger vurdering av backup og klientdrift.",
      category: "Support",
      source: "hansen-it-2025",
      status: "kontaktet",
      createdAt: "2026-06-29T10:30:00.000Z"
    }
  ],
  customers: [
    {
      id: "kunde-1",
      companyName: "Nordvik Elektro AS",
      contactPerson: "Kari Nordvik",
      phone: "+47 900 10 200",
      email: "kari@nordvikelektro.no",
      address: "Industriveien 12, 1481 Hagan",
      customerType: "SMB",
      status: "aktiv",
      followUpDate: "2026-07-02",
      notes: "Avklar backup, M365-sikkerhet og supportavtale.",
      contacts: [
        { name: "Kari Nordvik", role: "Daglig leder", email: "kari@nordvikelektro.no", phone: "+47 900 10 200" },
        { name: "Morten Lie", role: "Driftskontakt", email: "morten@nordvikelektro.no", phone: "+47 900 10 201" }
      ]
    },
    {
      id: "kunde-2",
      companyName: "Fjord Regnskap",
      contactPerson: "Lars Berg",
      phone: "+47 911 22 333",
      email: "lars@fjordregnskap.no",
      address: "Storgata 8, 2000 Lillestrøm",
      customerType: "Lead",
      status: "lead",
      followUpDate: "2026-07-01",
      notes: "Interessert i fast support fra august.",
      contacts: [{ name: "Lars Berg", role: "Partner", email: "lars@fjordregnskap.no", phone: "+47 911 22 333" }]
    },
    {
      id: "kunde-3",
      companyName: "Hansen IT intern",
      contactPerson: "Flemming Hansen",
      phone: "+47 900 00 000",
      email: "post@hansen-it.com",
      address: "Norge",
      customerType: "Intern",
      status: "aktiv",
      followUpDate: "2026-07-05",
      notes: "Interne Phoenix-oppgaver og ideer.",
      contacts: [{ name: "Flemming Hansen", role: "Eier", email: "post@hansen-it.com", phone: "+47 900 00 000" }]
    }
  ],
  tasks: [
    { id: "oppgave-1", title: "Følge opp Fjord Regnskap", description: "Avklar supportavtale, responstid og oppstart.", customerId: "kunde-2", assignee: "Flemming", dueDate: "2026-07-01", status: "pågår", priority: "høy" },
    { id: "oppgave-2", title: "Backup-sjekk Nordvik", description: "Kontroller siste backupstatus og dokumenter funn.", customerId: "kunde-1", assignee: "Flemming", dueDate: "2026-07-03", status: "ny", priority: "normal" },
    { id: "oppgave-3", title: "Rydde idebank", description: "Parker ideer som ikke skal bli aktive prosjekter nå.", customerId: "kunde-3", assignee: "Flemming", dueDate: "2026-07-04", status: "ny", priority: "lav" },
    { id: "oppgave-4", title: "Avvente signatur", description: "Kunden vurderer tilbudet. Ikke eskaler før gyldighetsdato nærmer seg.", customerId: "kunde-2", assignee: "Flemming", dueDate: "2026-07-10", status: "venter kunde", priority: "normal" }
  ],
  quotes: [
    {
      id: "tilbud-1",
      customerId: "kunde-2",
      contactPerson: "Lars Berg",
      title: "Oppstartspakke M365",
      description: "Klientoppsett, grunnsikring og dokumentasjon for Microsoft 365.",
      lineItems: [
        { id: "linje-1", description: "Kartlegging og oppstart", quantity: 1, unitPrice: 6500, discount: 0, vatRate: 25 },
        { id: "linje-2", description: "M365 sikkerhetsoppsett", quantity: 1, unitPrice: 9000, discount: 1000, vatRate: 25 },
        { id: "linje-3", description: "Dokumentasjon og overlevering", quantity: 1, unitPrice: 4000, discount: 0, vatRate: 25 }
      ],
      priceExVat: 18500,
      totalExVat: 18500,
      totalVat: 4625,
      totalIncVat: 23125,
      status: "sendt",
      validUntil: "2026-07-15",
      internalNotes: "Sendt etter kartleggingssamtale.",
      customerNote: "Tilbudet dekker oppstart og grunnsikring. Løpende drift avtales separat."
    },
    {
      id: "tilbud-2",
      customerId: "kunde-1",
      contactPerson: "Kari Nordvik",
      title: "Utvidet backup",
      description: "Backup, overvåking og månedlig rapportering.",
      lineItems: [
        { id: "linje-4", description: "Backup-oppsett", quantity: 1, unitPrice: 4200, discount: 0, vatRate: 25 },
        { id: "linje-5", description: "Månedlig rapportering", quantity: 3, unitPrice: 1000, discount: 0, vatRate: 25 }
      ],
      priceExVat: 7200,
      totalExVat: 7200,
      totalVat: 1800,
      totalIncVat: 9000,
      status: "kladd",
      validUntil: "2026-07-20",
      internalNotes: "Må kvalitetssikres før utsending.",
      customerNote: "Pris gjelder første tre måneder. Videre drift avtales etter evaluering."
    }
  ],
  ideas: [
    { id: "ide-1", title: "Standard onboarding-sjekkliste", description: "Fast sjekkliste for nye kunder.", category: "Drift", status: "vurderes" },
    { id: "ide-2", title: "Kundehelse-score", description: "Enkel score basert på oppgaver, avtale og oppfølging.", category: "CRM", status: "parkert" },
    { id: "ide-3", title: "AI-oppsummering av notater", description: "Ikke v1. Parker til datagrunnlaget er bedre.", category: "AI", status: "parkert" }
  ]
};

