import { DecisionCard, DocsCard, DocsLayout } from "@/components/docs/DocsPortal";
import { decisions } from "@/lib/docsPortal/data";

export default function DocsAdrRfcPage() {
  return (
    <DocsLayout title="ADR & RFC Log" description="Beslutninger og forslag som styrer Project Phoenix. Dette er kilden for fremtidige implementasjoner.">
      <section className="grid gap-4">
        {decisions.map((decision) => <div id={decision.type.toLowerCase()} key={decision.id}><DecisionCard decision={decision} /></div>)}
      </section>
      <section className="grid gap-4 md:grid-cols-2">
        <DocsCard title="ADR-0001 status" eyebrow="Accepted">
          <p className="text-sm text-slate-300">Supabase/Postgres er valgt fordi Phoenix trenger relasjoner, realtime-mulighet, auth, storage, RLS og rask utvikling.</p>
        </DocsCard>
        <DocsCard title="RFC-0001 åpne spørsmål" eyebrow="Draft">
          <ul className="space-y-2 text-sm text-slate-300">
            <li>- Skal rapporter lagres som PDF eller genereres on-demand?</li>
            <li>- Skal `scan_reports` erstatte `security_scan_reports`?</li>
            <li>- Skal kunder kunne kommentere på rapportfunn i portal?</li>
          </ul>
        </DocsCard>
      </section>
    </DocsLayout>
  );
}
