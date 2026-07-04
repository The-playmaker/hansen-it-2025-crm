import { DocsCard, DocsLayout, ReportPreviewCard, StatusBadge } from "@/components/docs/DocsPortal";
import { reportTypes } from "@/lib/docsPortal/data";
import Image from "next/image";

export default function DocsReportsPage() {
  return (
    <DocsLayout title="Reports Engine" description="Phoenix Report Engine gjør funn og CRM-data om til beslutningsgrunnlag, PDF-er, portalvisninger og konkrete tiltak.">
      <section className="grid gap-4 xl:grid-cols-5">
        {reportTypes.map((report) => <ReportPreviewCard key={report.title} report={report} />)}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <DocsCard title="Security Assessment PDF preview" eyebrow="PDF Design" action={<StatusBadge status="active">template</StatusBadge>}>
          <div className="rounded-lg border border-white/10 bg-slate-950 p-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <Image src="/brand/hansen-it/logo/logo-horizontal-dark.svg" alt="Hansen IT" width={180} height={54} className="mb-4 h-auto w-36" />
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--hi-blue-light)]">Phoenix Scan</p>
                <h3 className="mt-1 text-xl font-semibold text-white">Security Assessment</h3>
              </div>
              <div className="text-right"><p className="text-3xl font-bold text-emerald-200">82</p><p className="text-xs text-slate-400">Score A/B</p></div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {["Top risks", "Recommended fixes", "Evidence"].map((item) => <div key={item} className="rounded border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-300">{item}</div>)}
            </div>
          </div>
        </DocsCard>
        <DocsCard title="Fix with Hansen IT" eyebrow="Action Pattern" action={<StatusBadge status="planned">next</StatusBadge>}>
          <p className="text-sm text-slate-300">Rapporter skal kunne starte kontrollert CRM-flyt: create lead, create task eller quote request. CTA lover ikke automatisk retting.</p>
          <button className="mt-5 rounded bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950">Fix with Hansen IT</button>
        </DocsCard>
      </section>
    </DocsLayout>
  );
}
