"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Activity, BookOpen, Boxes, Database, FileText, GitBranch, LayoutDashboard, Search, ShieldCheck } from "lucide-react";
import { docsNavGroups } from "@/lib/docsPortal/data";

const statusTone = {
  active: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  accepted: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  draft: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  planned: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
  risk: "border-rose-400/30 bg-rose-400/10 text-rose-200"
};

const iconMap = {
  overview: LayoutDashboard,
  architecture: GitBranch,
  database: Database,
  modules: Boxes,
  reports: FileText,
  security: ShieldCheck,
  activity: Activity,
  docs: BookOpen
};

export function StatusBadge({ children, status = "planned" }) {
  return <span className={`inline-flex rounded border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${statusTone[status] || statusTone.planned}`}>{children}</span>;
}

export function DocsCard({ title, eyebrow, children, action, className = "" }) {
  return (
    <section className={`rounded-lg border border-white/10 bg-slate-900/60 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur ${className}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          {eyebrow ? <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-300/80">{eyebrow}</p> : null}
          {title ? <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-50">{title}</h2> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function DocsSidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-64 shrink-0 border-r border-white/10 bg-slate-950/75 lg:block">
      <div className="docs-scrollbar sticky top-0 h-screen overflow-y-auto px-3 py-4">
        <div className="mb-4 rounded-lg border border-white/10 bg-white/[0.04] p-3">
          <Image src="/brand/hansen-it/logo/logo-horizontal-dark.svg" alt="Hansen IT" width={190} height={56} priority className="mb-3 h-auto w-36" />
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-cyan-300">Developer Portal</p>
          <p className="mt-1 text-sm font-semibold text-white">Phoenix Docs v1.0</p>
          <p className="mt-1 text-[11px] text-slate-400">Infrastruktur · Nettverk · Support · Cybersikkerhet</p>
          <p className="mt-2 text-[11px] text-slate-500">Static draft content – markdown sync planned</p>
        </div>
        <nav className="space-y-4">
          {docsNavGroups.map((group) => (
            <div key={group.title}>
              <p className="mb-1 px-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{group.title}</p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const baseHref = item.activePath || item.href.split("#")[0];
                  const active = pathname === baseHref && (!item.href.includes("#") || item.activePath);
                  return (
                    <Link key={`${group.title}-${item.label}`} href={item.href} className={`block rounded px-2.5 py-1.5 text-[13px] transition ${active ? "bg-[var(--hi-blue)]/20 text-white ring-1 ring-[var(--hi-blue-light)]/30" : "text-slate-400 hover:bg-white/[0.05] hover:text-white"}`}>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}

export function DocsTopbar({ title, description, badge = "Docs v1.0 draft" }) {
  return (
    <header className="border-b border-white/10 bg-slate-950/75 px-4 py-4 backdrop-blur lg:px-6">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="mb-3 flex items-center gap-3">
              <Image src="/brand/hansen-it/logo/logo-horizontal-dark.svg" alt="Hansen IT" width={180} height={54} priority className="h-auto w-32" />
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--hi-blue-light)]">Project Phoenix</p>
            </div>
            <StatusBadge status="draft">{badge}</StatusBadge>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">{title}</h1>
          {description ? <p className="mt-2 max-w-3xl text-sm text-slate-400">{description}</p> : null}
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-slate-500">Static draft content – markdown sync planned</p>
        </div>
        <div className="flex min-h-10 items-center gap-2 rounded border border-white/10 bg-slate-900/70 px-3 text-sm text-slate-400">
          <Search className="h-4 w-4" />
          <span>Search docs / CMD+K</span>
        </div>
      </div>
    </header>
  );
}

export function DocsLayout({ title, description, children }) {
  return (
    <div className="docs-scrollbar min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(29,111,224,0.20),transparent_32%),linear-gradient(180deg,#020617,var(--hi-marine))] text-slate-100">
      <style jsx global>{`
        .docs-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(63, 161, 255, 0.42) rgba(21, 33, 73, 0.72);
        }
        html,
        body {
          scrollbar-width: thin;
          scrollbar-color: rgba(63, 161, 255, 0.42) rgba(21, 33, 73, 0.72);
        }
        .docs-scrollbar::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        body::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        .docs-scrollbar::-webkit-scrollbar-track {
          background: rgba(21, 33, 73, 0.72);
        }
        body::-webkit-scrollbar-track {
          background: rgba(21, 33, 73, 0.72);
        }
        .docs-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, rgba(63, 161, 255, 0.48), rgba(29, 111, 224, 0.32));
          border: 2px solid rgba(15, 23, 42, 0.92);
          border-radius: 999px;
        }
        body::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, rgba(63, 161, 255, 0.48), rgba(29, 111, 224, 0.32));
          border: 2px solid rgba(15, 23, 42, 0.92);
          border-radius: 999px;
        }
        .docs-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(34, 211, 238, 0.56);
        }
      `}</style>
      <div className="flex">
        <DocsSidebar />
        <div className="min-w-0 flex-1">
          <DocsTopbar title={title} description={description} />
          <main className="mx-auto max-w-[1440px] space-y-5 p-4 lg:p-6 xl:p-7">{children}</main>
        </div>
      </div>
    </div>
  );
}

export function ArchitectureCard({ title, status, items }) {
  const Icon = iconMap.architecture;
  return (
    <DocsCard title={title} action={<StatusBadge status={status}>{status}</StatusBadge>}>
      <Icon className="mb-3 h-5 w-5 text-cyan-300" />
      <ul className="space-y-2 text-sm text-slate-300">
        {items.map((item) => <li key={item} className="rounded border border-white/10 bg-white/[0.03] px-3 py-2">{item}</li>)}
      </ul>
    </DocsCard>
  );
}

export function ModuleCard({ module }) {
  return (
    <DocsCard title={module.title} eyebrow={module.owner} action={<StatusBadge status={module.status}>{module.status}</StatusBadge>}>
      <p className="text-sm text-slate-300">{module.description}</p>
      <div className="mt-4 grid gap-3 text-xs text-slate-400 md:grid-cols-2">
        <div><p className="mb-2 font-mono uppercase tracking-[0.12em] text-slate-500">Inputs</p>{module.inputs.map((item) => <span key={item} className="mr-2 mt-2 inline-flex rounded bg-white/[0.06] px-2 py-1">{item}</span>)}</div>
        <div><p className="mb-2 font-mono uppercase tracking-[0.12em] text-slate-500">Outputs</p>{module.outputs.map((item) => <span key={item} className="mr-2 mt-2 inline-flex rounded bg-cyan-400/10 px-2 py-1 text-cyan-200">{item}</span>)}</div>
      </div>
    </DocsCard>
  );
}

export function DecisionCard({ decision }) {
  return (
    <DocsCard title={`${decision.id}: ${decision.title}`} eyebrow={decision.type} action={<StatusBadge status={decision.status}>{decision.status}</StatusBadge>}>
      <p className="text-sm text-slate-300">{decision.decision}</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-slate-500">Alternativer</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-300">{decision.alternatives.map((item) => <li key={item}>- {item}</li>)}</ul>
        </div>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-slate-500">Konsekvenser / åpne spørsmål</p>
          <ul className="mt-2 space-y-1 text-sm text-slate-300">{decision.consequences.map((item) => <li key={item}>- {item}</li>)}</ul>
        </div>
      </div>
    </DocsCard>
  );
}

export function ReportPreviewCard({ report }) {
  return (
    <DocsCard title={report.title} eyebrow={report.audience} action={<StatusBadge status={report.status}>{report.status}</StatusBadge>}>
      <p className="text-sm text-slate-300">{report.description}</p>
      <div className="mt-4 h-2 rounded bg-slate-800">
        <div className="h-2 w-3/4 rounded bg-gradient-to-r from-cyan-300 to-indigo-400" />
      </div>
    </DocsCard>
  );
}
