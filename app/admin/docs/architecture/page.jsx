import { ArchitectureCard, DocsCard, DocsLayout, StatusBadge } from "@/components/docs/DocsPortal";
import { architectureLayers, architectureRules } from "@/lib/docsPortal/data";

export default function DocsArchitecturePage() {
  return (
    <DocsLayout title="Architecture" description="Phoenix er bygget som en Next.js admin-app med server-side API-ruter, Supabase/Postgres og tokenbaserte kundeportaler.">
      <section className="grid gap-4 xl:grid-cols-4">
        {architectureLayers.map((layer) => <ArchitectureCard key={layer.title} {...layer} />)}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <DocsCard title="Platform Core" eyebrow="Runtime" action={<StatusBadge status="active">active</StatusBadge>}>
          <div id="platform-core" className="space-y-3 text-sm text-slate-300">
            <p>Next.js App Router er UI- og API-runtime. Admin-flater kjører bak Phoenix-session, mens portalflater bruker token.</p>
            <p>Supabase service role brukes kun i route handlers. Klientkomponenter skal aldri importere admin-klienten.</p>
          </div>
        </DocsCard>
        <DocsCard title="APIs" eyebrow="Contract" action={<StatusBadge status="active">server-side</StatusBadge>}>
          <div id="apis" className="space-y-2 text-sm text-slate-300">
            <p>`/api/admin/*` krever admin-session.</p>
            <p>`/api/public/*` er små og validerte public endpoints.</p>
            <p>`/api/portal/*` bruker lange token-lenker og kontrollerte feilmeldinger.</p>
          </div>
        </DocsCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <DocsCard title="Security" eyebrow="Rules">
          <div id="security" className="space-y-2 text-sm text-slate-300">{architectureRules.map((rule) => <p key={rule}>- {rule}</p>)}</div>
        </DocsCard>
        <DocsCard title="Deployment" eyebrow="Environment">
          <div id="deployment" className="space-y-2 text-sm text-slate-300">
            <p>Produksjon krever `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, public CRM URL og Resend-konfig for rapportutsending.</p>
            <p>Build skal ikke krasje hvis valgfri integrasjon mangler; API skal returnere kontrollert `503`.</p>
          </div>
        </DocsCard>
      </section>
    </DocsLayout>
  );
}
