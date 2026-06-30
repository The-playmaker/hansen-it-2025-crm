export const PHOENIX_STORAGE_KEY = "hansen-it-project-phoenix-v1";

export const customerStatuses = ["lead", "aktiv", "inaktiv"];
export const taskStatuses = ["ny", "pågår", "venter kunde", "ferdig"];
export const quoteStatuses = ["kladd", "sendt", "godkjent", "avslått"];
export const ideaStatuses = ["parkert", "vurderes", "aktiv", "droppet"];
export const priorities = ["lav", "normal", "høy"];

export const phoenixMockData = {
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
    { id: "tilbud-1", customerId: "kunde-2", title: "Oppstartspakke M365", description: "Klientoppsett, grunnsikring og dokumentasjon.", priceExVat: 18500, status: "sendt", validUntil: "2026-07-15", notes: "Sendt etter kartleggingssamtale." },
    { id: "tilbud-2", customerId: "kunde-1", title: "Utvidet backup", description: "Backup, overvåking og månedlig rapportering.", priceExVat: 7200, status: "kladd", validUntil: "2026-07-20", notes: "Må kvalitetssikres før utsending." }
  ],
  ideas: [
    { id: "ide-1", title: "Standard onboarding-sjekkliste", description: "Fast sjekkliste for nye kunder.", category: "Drift", status: "vurderes" },
    { id: "ide-2", title: "Kundehelse-score", description: "Enkel score basert på oppgaver, avtale og oppfølging.", category: "CRM", status: "parkert" },
    { id: "ide-3", title: "AI-oppsummering av notater", description: "Ikke v1. Parker til datagrunnlaget er bedre.", category: "AI", status: "parkert" }
  ]
};
