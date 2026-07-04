"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Download, FileText, Lightbulb, Users } from "lucide-react";
import { usePhoenixData } from "@/components/phoenix/usePhoenixData";
import { EmptyState, formatCurrency, formatDate, MetricCard, PhoenixPageHeader, PhoenixPanel, SecondaryButton, StatusBadge } from "@/components/phoenix/PhoenixUi";

function priorityRank(priority) {
  return { lav: 1, normal: 2, høy: 3, hast: 4 }[priority] || 0;
}

function isOpenLead(lead) {
  return !["fullført", "arkivert"].includes(lead.status);
}

export default function AdminDashboard() {
  const { data, customersById, parkTaskAsIdea, exportBackup } = usePhoenixData();
  const [requestLeads, setRequestLeads] = useState([]);
  const [requestsConfigured, setRequestsConfigured] = useState(true);
  const [ideaStats, setIdeaStats] = useState({ total: 0, parked: 0, configured: true });

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
    async function loadIdeas() {
      try {
        const response = await fetch("/api/admin/ideas", { cache: "no-store" });
        const result = await response.json();
        if (cancelled) return;
        const ideas = result.data || [];
        setIdeaStats({ total: ideas.length, parked: ideas.filter((idea) => idea.status === "parkert").length, configured: result.configured !== false });
      } catch {}
    }
    loadIdeas();
    return () => { cancelled = true; };
  }, []);

  const activeTasks = data.tasks.filter((task) => task.status !== "ferdig");
  const todaysThree = [...activeTasks].sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority) || String(a.dueDate).localeCompare(String(b.dueDate))).slice(0, 3);
  const openRequests = useMemo(() => requestLeads.filter(isOpenLead), [requestLeads]);
  const hastRequests = useMemo(() => requestLeads.filter((lead) => lead.priority === "hast" && isOpenLead(lead)), [requestLeads]);
  const newRequests = useMemo(() => requestLeads.filter((lead) => lead.status === "ny"), [requestLeads]);
  const openQuotes = data.quotes.filter((quote) => ["kladd", "sendt"].includes(quote.status));
  const parkedIdeas = ideaStats.configured ? ideaStats.parked : data.ideas.filter((idea) => idea.status === "parkert").length;
  const totalIdeas = ideaStats.configured ? ideaStats.total : data.ideas.length;

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
        <MetricCard label="Åpne tilbud" value={openQuotes.length} detail="Kladd eller sendt" tone="amber" />
        <MetricCard label="Idébank" value={`${parkedIdeas}/${totalIdeas}`} detail={ideaStats.configured ? "Fra phoenix_ideas" : "Demo fallback"} tone="rose" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <PhoenixPanel title="Dagens 3 prioriteringsmodul" description="Maks tre aktive toppoppgaver. Parker det som ikke skal være aktivt arbeid akkurat nå.">
          <div className="space-y-3">
            {todaysThree.length ? todaysThree.map((task) => (
              <div key={task.id} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-white">{task.title}</h3>
                    <p className="mt-1 text-sm text-slate-400">{customersById.get(task.customerId)?.companyName || "Ingen kunde"} - {formatDate(task.dueDate)}</p>
                  </div>
                  <StatusBadge>{task.priority}</StatusBadge>
                </div>
                <p className="mt-3 text-sm text-slate-300">{task.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <SecondaryButton onClick={() => parkTaskAsIdea(task.id)}>Parker som idé</SecondaryButton>
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
        <PhoenixPanel title="Åpne tilbud" description="Quotes-flyt i enkel v1-form.">
          <div className="space-y-3">
            {openQuotes.map((quote) => (
              <div key={quote.id} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{quote.title}</p>
                    <p className="mt-1 text-sm text-slate-400">{customersById.get(quote.customerId)?.companyName || "Ingen kunde"} - {formatCurrency(quote.priceExVat)}</p>
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


