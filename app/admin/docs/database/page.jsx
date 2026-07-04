import { DocsCard, DocsLayout, StatusBadge } from "@/components/docs/DocsPortal";
import { databaseFlows } from "@/lib/docsPortal/data";

function FlowCard({ flow }) {
  return (
    <DocsCard title={flow.title} eyebrow="Data Flow" action={<StatusBadge status={flow.status}>{flow.status}</StatusBadge>}>
      <p className="mb-4 text-sm text-slate-300">{flow.description}</p>
      <div className="flex flex-wrap items-center gap-2">
        {flow.nodes.map((node, index) => (
          <div key={node} className="flex items-center gap-2">
            <span className="rounded border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 font-mono text-xs text-cyan-100">{node}</span>
            {index < flow.nodes.length - 1 ? <span className="text-slate-500">→</span> : null}
          </div>
        ))}
      </div>
    </DocsCard>
  );
}

export default function DocsDatabasePage() {
  return (
    <DocsLayout title="Database Schema" description="Phoenix datamodell i Supabase/Postgres. Dette er praktisk oversikt for implementering og feilsøking.">
      <section className="grid gap-4">
        {databaseFlows.map((flow) => <FlowCard key={flow.title} flow={flow} />)}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <DocsCard title="CRM tables" eyebrow="Core">
          <p className="text-sm text-slate-300">`requests`, `leads`, `customers`, `contacts`, `quotes`, `quote_items`, `quote_messages`, `quote_tokens`.</p>
        </DocsCard>
        <DocsCard title="Phoenix tables" eyebrow="Support">
          <p className="text-sm text-slate-300">`phoenix_ideas` holder idébank. `phoenix_site_content` holder redigerbart nettsideinnhold.</p>
        </DocsCard>
        <DocsCard title="Scan tables" eyebrow="Security">
          <p className="text-sm text-slate-300">`scan_authorizations`, `scan_scopes`, `scan_jobs`, `scan_results`, `scan_findings`, `scan_reports`.</p>
        </DocsCard>
      </section>
    </DocsLayout>
  );
}
