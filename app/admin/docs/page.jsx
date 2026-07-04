import { ArchitectureCard, DocsCard, DocsLayout, ModuleCard, StatusBadge } from "@/components/docs/DocsPortal";
import { architectureRules, currentFocus, nextDecisions, quickModules } from "@/lib/docsPortal/data";

export default function DocsHomePage() {
  return (
    <DocsLayout title="The Living Architecture of Project Phoenix" description="Developer Portal for CRM, Scan, Reports og fremtidige NOC/SOC/AI-moduler. Dette er operativ dokumentasjon, ikke markedsmateriell.">
      <section className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
        <DocsCard title="Project Phoenix" eyebrow="System Map" action={<StatusBadge status="draft">Draft v1.0</StatusBadge>} className="min-h-64">
          <p className="max-w-3xl text-lg text-slate-200">Phoenix er Hansen IT sitt CRM- og operativsystem for kunder, sikkerhet, rapporter og teknisk leveranse.</p>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {["Server-side first", "Supabase primary", "Token portals"].map((item) => (
              <div key={item} className="rounded border border-white/10 bg-white/[0.04] p-4">
                <p className="font-mono text-xs text-cyan-300">{item}</p>
              </div>
            ))}
          </div>
        </DocsCard>
        <DocsCard title="Current Focus" eyebrow="Now">
          <ul className="space-y-3 text-sm text-slate-300">{currentFocus.map((item) => <li key={item} className="border-l-2 border-cyan-300/50 pl-3">{item}</li>)}</ul>
        </DocsCard>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {quickModules.map((module) => (
          <DocsCard key={module.title} title={module.title} eyebrow={module.metric} action={<StatusBadge status={module.status}>{module.status}</StatusBadge>}>
            <p className="text-sm text-slate-300">{module.description}</p>
          </DocsCard>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <DocsCard title="Architecture Rules" eyebrow="Non-negotiable">
          <ul className="space-y-2 text-sm text-slate-300">{architectureRules.map((item) => <li key={item}>- {item}</li>)}</ul>
        </DocsCard>
        <DocsCard title="Next Decisions" eyebrow="Decision Queue">
          <ul className="space-y-2 text-sm text-slate-300">{nextDecisions.map((item) => <li key={item}>- {item}</li>)}</ul>
        </DocsCard>
        <ArchitectureCard title="Design System" status="active" items={["Dark-first enterprise", "Dense cards", "Soft-technical 4-8px radius", "Monospace IDs and metrics"]} />
      </section>

      <section id="vision" className="grid gap-4 md:grid-cols-2">
        <DocsCard title="Vision" eyebrow="Direction">
          <p className="text-sm text-slate-300">Phoenix skal bli ett kontrollsenter for Hansen IT: salg, drift, sikkerhet, dokumentasjon og rapportering i samme arbeidsflate.</p>
        </DocsCard>
        <DocsCard title="Philosophy" eyebrow="Operating Model">
          <p className="text-sm text-slate-300">Systemet skal prioritere struktur og beslutninger over pynt. Data skal være sporbare, handlinger skal kunne følges, og automatisering skal være kontrollert.</p>
        </DocsCard>
      </section>

      <section id="roadmap" className="grid gap-4 md:grid-cols-3">
        {["Testing", "Runbooks", "Roadmap"].map((title) => (
          <DocsCard key={title} title={title} eyebrow="Docs v1.0">
            <p className="text-sm text-slate-300">Statisk innhold nå. Senere kobles denne portalen mot markdown-filene i `docs/`.</p>
          </DocsCard>
        ))}
      </section>
    </DocsLayout>
  );
}
