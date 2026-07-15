"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Download, FileText, Lightbulb, Users } from "lucide-react";
import { usePhoenixData } from "@/components/phoenix/usePhoenixData";
import { EmptyState, formatCurrency, formatDate, MetricCard, PhoenixPageHeader, PhoenixPanel, SecondaryButton, StatusBadge } from "@/components/phoenix/PhoenixUi";

function priorityRank(priority) {
  return { low: 1, lav: 1, normal: 2, high: 3, høy: 3, hast: 4, urgent: 4 }[priority] || 0;
}

function isOpenLead(lead) {
  return !["fullført", "arkivert", "converted"].includes(lead.status);
}

function reportFindings(report = {}) {
  return report.report?.findings || report.findings || [];
}

function highFindingCount(report = {}) {
  return reportFindings(report).filter((finding) => ["critical", "high"].includes(finding.severity || finding.status)).length;
}

export default function AdminDashboard() {
  const { data, customersById, parkTaskAsIdea, exportBackup } = usePhoenixData();
  const [requestLeads, setRequestLeads] = useState([]);
  const [actualLeads, setActualLeads] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [requestsConfigured, setRequestsConfigured] = useState(true);
  const [quotesConfigured, setQuotesConfigured] = useState(true);
  const [tasksConfigured, setTasksConfigured] = useState(true);
  const [ideaStats, setIdeaStats] = useState({ total: 0, parked: 0, configured: true });
  const [scanReports, setScanReports] = useState([]);
  const [scanConfigured, setScanConfigured] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadRequests() {
      try {
        const response = await fetch("/api/admin/requests", { cache: "no-store" });
        const result = await response.json();
        if (cancelled) return;
        setRequestsConfigured(result.configured !== false);
        setRequestLeads(result.leads || []);
      } catch {
        if (!cancelled) setRequestLeads([]);
      }
    }
    loadRequests();
    async function loadLeads() {
      try {
        const response = await fetch("/api/admin/leads", { cache: "no-store" });
        const result = await response.json();
        if (cancelled) return;
        setActualLeads(result.data || []);
      } catch {
        if (!cancelled) setActualLeads([]);
      }
    }
    loadLeads();
    async function loadQuotes() {
      try {
        const response = await fetch("/api/admin/quotes", { cache: "no-store" });
        const result = await response.json();
        if (cancelled) return;
        setQuotesConfigured(result.configured !== false);
        setQuotes(result.configured === false ? data.quotes : result.data || []);
      } catch {
        if (!cancelled) setQuotes(data.quotes);
      }
    }
    loadQuotes();
    async function loadTasks() {
      try {
        const response = await fetch("/api/admin/tasks", { cache: "no-store" });
        const result = await response.json();
        if (cancelled) return;
        setTasksConfigured(result.configured !== false);
        setTasks(result.configured === false ? data.tasks : result.data || []);
      } catch {
        if (!cancelled) setTasks(data.tasks);
      }
    }
    loadTasks();
    async function loadIdeas() {
      try {
        const response = await fetch("/api/admin/ideas", { cache: "no-store" });
        const result = await response.json();
        if (cancelled) return;
        const ideas = result.data || [];
        setIdeaStats({ total: ideas.length, parked: ideas.filter((idea) => ["parked", "parkert"].includes(idea.status)).length, configured: result.configured !== false });
      } catch {}
    }
    loadIdeas();
    async function loadScanReports() {
      try {
        const response = await fetch("/api/admin/security/reports", { cache: "no-store" });
        const result = await response.json();
        if (cancelled) return;
        setScanConfigured(result.configured !== false);
        setScanReports(result.data || []);
      } catch {
        if (!cancelled) {
          setScanConfigured(false);
          setScanReports([]);
        }
      }
    }
    loadScanReports();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeTasks = tasks.filter((task) => !["ferdig", "done", "completed"].includes(String(task.status || "").toLowerCase()));
  const todaysThree = [...activeTasks].sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority) || String(a.due_date || a.dueDate || "").localeCompare(String(b.due_date || b.dueDate || ""))).slice(0, 3);
  const openRequests = useMemo(() => requestLeads.filter(isOpenLead), [requestLeads]);
  const hastRequests = useMemo(() => requestLeads.filter((lead) => lead.priority === "hast" && isOpenLead(lead)), [requestLeads]);
  const newRequests = useMemo(() => requestLeads.filter((lead) => lead.status === "ny"), [requestLeads]);
  const openLeadCount = actualLeads.filter((lead) => !["closed", "lost", "won", "done", "converted"].includes(String(lead.status || "").toLowerCase())).length;
  const openQuotes = quotes.filter((quote) => ["kladd", "ny", "pågår", "sendt"].includes(String(quote.status || "").toLowerCase()));
  const parkedIdeas = ideaStats.configured ? ideaStats.parked : data.ideas.filter((idea) => ["parked", "parkert"].includes(idea.status)).length;
  const totalIdeas = ideaStats.configured ? ideaStats.total : data.ideas.length;
  const lowScoreReports = scanReports.filter((report) => Number(report.score || 0) < 60);
  const highSeverityReports = scanReports.filter((report) => highFindingCount(report) > 0);

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PhoenixPageHeader
        title="Dagens oversikt"
        description="Phoenix bruker Supabase requests som kilde for nye henvendelser, kunder som venter og HAST-saker når databasen er konfigurert."
        action={<Link href="/admin/kanban" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-300">Åpne oppgaver <ArrowRight size={16} /></Link>}
      />

      {!requestsConfigured ? (
        <PhoenixPanel title="Demo mode" description="Supabase er ikke konfigurert. Dashboard viser lokale demo-oppgaver, men ikke fiktive leads eller requests." />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Nye henvendelser" value={newRequests.length} detail="Fra Supabase requests" tone="cyan" />
        <MetricCard label="Kunder som venter" value={openRequests.length} detail="Åpne requests" tone="emerald" />
        <MetricCard label="HAST" value={hastRequests.length} detail="priority='hast'" tone="rose" />
        <MetricCard label="Åpne leads" value={openLeadCount} detail="Fra Supabase leads" tone="emerald" />
        <MetricCard label="Aktive tilbud" value={openQuotes.length} detail={quotesConfigured ? "Fra Supabase requests/quotes" : "Demo fallback"} tone="amber" />
        <MetricCard label="Idébank" value={`${parkedIdeas}/${totalIdeas}`} detail={ideaStats.configured ? "Fra phoenix_ideas" : "Demo fallback"} tone="rose" />
        <MetricCard label="Lav scan-score" value={lowScoreReports.length} detail={scanConfigured ? "Rapporter under 60" : "Demo/ikke konfigurert"} tone="rose" />
        <MetricCard label="High findings" value={highSeverityReports.reduce((sum, report) => sum + highFindingCount(report), 0)} detail="Fix with Hansen IT-muligheter" tone="amber" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <PhoenixPanel title="Dagens 3 prioriteringsmodul" description="Maks tre aktive toppoppgaver. Parker det som ikke skal være aktivt arbeid akkurat nå.">
          <div className="space-y-3">
            {todaysThree.length ? todaysThree.map((task) => (
              <div key={task.id} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-white">{task.title}</h3>
                    <p className="mt-1 text-sm text-slate-400">{task.customer?.company_name || customersById.get(task.customerId)?.companyName || "Ingen kunde"} - {formatDate(task.due_date || task.dueDate)}</p>
                  </div>
                  <StatusBadge>{task.priority}</StatusBadge>
                </div>
                <p className="mt-3 text-sm text-slate-300">{task.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <SecondaryButton onClick={() => tasksConfigured ? alert("Parker som idé er foreløpig bare tilgjengelig for demo/localStorage-oppgaver.") : parkTaskAsIdea(task.id)}>Parker som idé</SecondaryButton>
                  <Link href="/admin/kanban" className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">Rediger i kanban</Link>
                </div>
              </div>
            )) : <EmptyState text="Ingen aktive oppgaver i Dagens 3." />}
          </div>
        </PhoenixPanel>

        <PhoenixPanel title="Kunder som venter" description="Ekte åpne requests fra Supabase, sortert nyest først.">
          <div className="space-y-3">
            {openRequests.length ? openRequests.slice(0, 6).map((lead) => (
              <Link key={lead.id} href="/admin/leads" className="block rounded-2xl border border-white/10 bg-slate-950/45 p-4 hover:bg-white/10">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{lead.company || lead.name || "Ukjent henvendelse"}</p>
                    <p className="mt-1 text-sm text-slate-400">{lead.email || "Ingen e-post"} - {formatDate(lead.created_at)}</p>
                  </div>
                  <StatusBadge>{lead.priority === "hast" ? "HAST" : lead.status}</StatusBadge>
                </div>
              </Link>
            )) : <EmptyState text={requestsConfigured ? "Ingen åpne requests." : "Supabase ikke konfigurert."} />}
          </div>
        </PhoenixPanel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <PhoenixPanel title="Siste scan reports" description="Sikkerhetsrapporter som bør følges opp i CRM/tilbudsflyt.">
          <div className="space-y-3">
            {scanReports.length ? scanReports.slice(0, 5).map((report) => (
              <Link key={report.id} href={`/admin/security/reports/${report.id}`} className="block rounded-2xl border border-white/10 bg-slate-950/45 p-4 hover:bg-white/10">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{report.domain}</p>
                    <p className="mt-1 text-sm text-slate-400">{report.customer?.company_name || report.request?.company || "Ingen kunde koblet"} - {formatDate(report.created_at)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge>{report.score}/100</StatusBadge>
                    {highFindingCount(report) ? <StatusBadge>{highFindingCount(report)} high</StatusBadge> : null}
                  </div>
                </div>
              </Link>
            )) : <EmptyState text={scanConfigured ? "Ingen lagrede scan-rapporter." : "Security reports er ikke konfigurert."} />}
          </div>
        </PhoenixPanel>

        <PhoenixPanel title="Fix with Hansen IT" description="Funn som kan bli oppgaver, kundenotater eller tilbudskladd.">
          <div className="space-y-3">
            {highSeverityReports.length ? highSeverityReports.slice(0, 5).map((report) => (
              <Link key={report.id} href={`/admin/security/reports/${report.id}`} className="block rounded-2xl border border-white/10 bg-slate-950/45 p-4 hover:bg-white/10">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{report.domain}</p>
                    <p className="mt-1 text-sm text-slate-400">{reportFindings(report).find((finding) => ["critical", "high"].includes(finding.severity || finding.status))?.title || "High severity funn"}</p>
                  </div>
                  <StatusBadge>{highFindingCount(report)} funn</StatusBadge>
                </div>
              </Link>
            )) : <EmptyState text="Ingen high severity-funn som venter på oppfølging." />}
          </div>
        </PhoenixPanel>

        <PhoenixPanel title="Åpne tilbud" description="Quotes-flyt i enkel v1-form.">
          <div className="space-y-3">
            {openQuotes.map((quote) => (
              <div key={quote.id} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{quote.title}</p>
                    <p className="mt-1 text-sm text-slate-400">{quote.customer_name || quote.company || customersById.get(quote.customerId)?.companyName || "Ingen kunde"} - {quote.total_ex_vat || quote.priceExVat ? formatCurrency(quote.total_ex_vat || quote.priceExVat) : formatDate(quote.created_at)}</p>
                  </div>
                  <StatusBadge>{quote.status}</StatusBadge>
                </div>
              </div>
            ))}
          </div>
        </PhoenixPanel>

        <PhoenixPanel title="CRM-flyt" description="Kundearbeid, requests, tilbud og idebank samlet i Phoenix.">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              [Users, "Kunder", "Firma og kontaktpersoner"],
              [CheckCircle2, "Requests", "Ekte henvendelser fra Supabase"],
              [FileText, "Tilbud", "Kladd, sendt og godkjent"],
              [Lightbulb, "Idebank", "Parker ideer raskt"]
            ].map(([Icon, title, text]) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                <Icon className="h-5 w-5 text-cyan-300" />
                <p className="mt-3 font-semibold text-white">{title}</p>
                <p className="mt-1 text-sm text-slate-400">{text}</p>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <SecondaryButton onClick={exportBackup}><Download size={16} />Eksporter localStorage-demo</SecondaryButton>
          </div>
        </PhoenixPanel>
      </div>
    </div>
  );
}


