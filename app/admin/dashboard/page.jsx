"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Download, FileText, Lightbulb, Users } from "lucide-react";
import { usePhoenixData } from "@/components/phoenix/usePhoenixData";
import { EmptyState, formatCurrency, formatDate, MetricCard, PhoenixPageHeader, PhoenixPanel, SecondaryButton, StatusBadge } from "@/components/phoenix/PhoenixUi";

function priorityRank(priority) {
  return { lav: 1, normal: 2, høy: 3 }[priority] || 0;
}

export default function AdminDashboard() {
  const { data, customersById, parkTaskAsIdea, exportBackup } = usePhoenixData();
  const activeTasks = data.tasks.filter((task) => task.status !== "ferdig");
  const todaysThree = [...activeTasks].sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority) || String(a.dueDate).localeCompare(String(b.dueDate))).slice(0, 3);
  const customersToFollowUp = data.customers.filter((customer) => customer.status !== "inaktiv" && customer.followUpDate).slice(0, 5);
  const openQuotes = data.quotes.filter((quote) => ["kladd", "sendt"].includes(quote.status));
  const parkedIdeas = data.ideas.filter((idea) => idea.status === "parkert").length;

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PhoenixPageHeader
        title="Dagens oversikt"
        description="Phoenix v1 fokuserer på dagens tre viktigste oppgaver, kunder som må følges opp, åpne tilbud og ideer som kan parkeres uten å bli prosjekter."
        action={<Link href="/admin/kanban" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-300">Åpne oppgaver <ArrowRight size={16} /></Link>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Dagens 3" value={todaysThree.length} detail="Maks tre aktive hovedoppgaver" tone="cyan" />
        <MetricCard label="Kunder å følge opp" value={customersToFollowUp.length} detail="Lead og aktive kunder" tone="emerald" />
        <MetricCard label="Åpne tilbud" value={openQuotes.length} detail="Kladd eller sendt" tone="amber" />
        <MetricCard label="Parkerte ideer" value={`${parkedIdeas}/${data.ideas.length}`} detail="Ideer uten prosjektstatus" tone="rose" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <PhoenixPanel title="Dagens 3 prioriteringsmodul" description="Maks tre aktive toppoppgaver. Parker det som ikke skal v?re aktivt arbeid akkurat n?.">
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
                  <SecondaryButton onClick={() => parkTaskAsIdea(task.id)}>Parker som id?</SecondaryButton>
                  <Link href="/admin/kanban" className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">Rediger i kanban</Link>
                </div>
              </div>
            )) : <EmptyState text="Ingen aktive oppgaver i Dagens 3." />}
          </div>
        </PhoenixPanel>

        <PhoenixPanel title="Kunder som må følges opp" description="Companies og contacts fra inspirasjons-CRM-et samlet som kundeoversikt.">
          <div className="space-y-3">
            {customersToFollowUp.map((customer) => (
              <Link key={customer.id} href="/admin/customers" className="block rounded-2xl border border-white/10 bg-slate-950/45 p-4 hover:bg-white/10">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{customer.companyName}</p>
                    <p className="mt-1 text-sm text-slate-400">{customer.contactPerson} - {formatDate(customer.followUpDate)}</p>
                  </div>
                  <StatusBadge>{customer.status}</StatusBadge>
                </div>
              </Link>
            ))}
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

        <PhoenixPanel title="CRM-flyt" description="Inspirert av dashboard, companies, contacts, quotes og scrumboard.">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              [Users, "Kunder", "Firma og kontaktpersoner"],
              [CheckCircle2, "Oppgaver", "Kanban for daglig drift"],
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
        </PhoenixPanel>
      </div>
    </div>
  );
}
