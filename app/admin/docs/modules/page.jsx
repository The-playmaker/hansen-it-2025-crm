import { DocsCard, DocsLayout, ModuleCard } from "@/components/docs/DocsPortal";
import { modules } from "@/lib/docsPortal/data";

export default function DocsModulesPage() {
  return (
    <DocsLayout title="Module Details" description="Eierskap, input og output for Phoenix-modulene. Nye funksjoner skal plasseres i riktig modul før de implementeres.">
      <section className="grid gap-4 xl:grid-cols-3">
        {modules.map((module) => <div id={module.id} key={module.id}><ModuleCard module={module} /></div>)}
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        <DocsCard title="Integrations" eyebrow="Boundary">
          <p id="integrations" className="text-sm text-slate-300">Eksterne systemer skal kobles via API-ruter og webhooks. Ikke legg eksterne nøkler i klientkode.</p>
        </DocsCard>
        <DocsCard title="Business" eyebrow="Commercial">
          <p id="business" className="text-sm text-slate-300">Kommersielle muligheter starter som requests/leads og kan bli quote. Ikke hopp rett til faktura.</p>
        </DocsCard>
        <DocsCard title="Operations" eyebrow="Delivery">
          <p id="operations" className="text-sm text-slate-300">Driftshendelser, NOC og SOC skal kunne opprette tasks, reports og kundeoppfølging.</p>
        </DocsCard>
      </section>
    </DocsLayout>
  );
}
