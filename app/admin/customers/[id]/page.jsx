"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  FileText,
  FileWarning,
  Receipt,
  ScanSearch,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState as UiEmptyState } from "@/components/ui/EmptyState";
import { EmptyState, formatDate, PhoenixPageHeader, PhoenixPanel, StatusBadge } from "@/components/phoenix/PhoenixUi";

const timelineMeta = {
  scan: {
    label: "Skanning",
    icon: ScanSearch,
    accent: "border-sky-400/40 bg-sky-500/15 text-sky-200",
  },
  quote: {
    label: "Tilbud",
    icon: FileText,
    accent: "border-violet-400/40 bg-violet-500/15 text-violet-200",
  },
  invoice: {
    label: "Faktura",
    icon: Receipt,
    accent: "border-emerald-400/40 bg-emerald-500/15 text-emerald-200",
  },
  document: {
    label: "Dokument",
    icon: FileWarning,
    accent: "border-amber-400/40 bg-amber-500/15 text-amber-200",
  },
  authorization: {
    label: "Autorisasjon",
    icon: ShieldCheck,
    accent: "border-cyan-400/40 bg-cyan-500/15 text-cyan-200",
  },
  request: {
    label: "Forespørsel",
    icon: Send,
    accent: "border-rose-400/40 bg-rose-500/15 text-rose-200",
  },
};

function ListSection({ title, items, render, empty }) {
  return (
    <PhoenixPanel title={title}>
      <div className="space-y-3">
        {items?.length ? items.map(render) : <EmptyState text={empty} />}
      </div>
    </PhoenixPanel>
  );
}

function TimelineItem({ item }) {
  const meta = timelineMeta[item.type] || timelineMeta.request;
  const Icon = meta.icon;
  const content = (
    <div className="flex gap-3">
      <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${meta.accent}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">{meta.label}</p>
            <p className="font-semibold text-white">{item.title}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {item.status ? <StatusBadge>{item.status}</StatusBadge> : null}
            <p className="text-xs text-slate-500">{formatDate(item.date)}</p>
          </div>
        </div>
        {item.subtitle ? <p className="mt-1 text-sm text-slate-300">{item.subtitle}</p> : null}
        {item.relatedTo?.label ? (
          <p className="mt-2 border-l-2 border-white/15 pl-3 text-xs text-slate-400">
            ← fra {item.relatedTo.label}
          </p>
        ) : null}
      </div>
    </div>
  );

  if (item.href) {
    return (
      <Link
        href={item.href}
        className="block rounded-2xl border border-white/10 bg-slate-950/45 p-4 transition hover:border-accent-blue/40 hover:bg-white/5"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
      {content}
    </div>
  );
}

export default function CustomerDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [customer, setCustomer] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [timelineLoading, setTimelineLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadCustomer() {
      setLoading(true);
      try {
        const response = await fetch(`/api/admin/customers/${params.id}`, { cache: "no-store" });
        const result = await response.json();
        if (cancelled) return;
        setConfigured(result.configured !== false);
        if (!response.ok) throw new Error(result.error || "Kunne ikke hente kunde.");
        setCustomer(result.data);
      } catch (err) {
        if (!cancelled) setError(err.message || "Kunne ikke hente kunde.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    async function loadTimeline() {
      setTimelineLoading(true);
      try {
        const response = await fetch(`/api/admin/customers/${params.id}/timeline`, { cache: "no-store" });
        const result = await response.json();
        if (cancelled) return;
        if (!response.ok) throw new Error(result.error || "Kunne ikke hente tidslinje.");
        setTimeline(result.data || []);
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setTimeline([]);
        }
      } finally {
        if (!cancelled) setTimelineLoading(false);
      }
    }

    loadCustomer();
    loadTimeline();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  if (loading) return <div className="p-8"><EmptyState text="Henter kunde..." /></div>;
  if (error) return <div className="p-8"><EmptyState text={error} /></div>;
  if (!configured || !customer) return <div className="p-8"><EmptyState text="Supabase er ikke konfigurert." /></div>;

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PhoenixPageHeader
        title={customer.company_name || "Kunde"}
        description="Kundedetaljer med kontakter, requests, leads, quotes, tasks og aktivitet."
        action={<Link href="/admin/customers" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"><ArrowLeft size={16} />Til kunder</Link>}
      />

      <Card className="!bg-brand-900/60">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Tidslinje</h2>
            <p className="mt-1 text-sm text-slate-400">
              Skanning, tilbud, faktura, dokumenter og forespørsler samlet i én historikk.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => router.push("/admin/security/scan")}
          >
            <Sparkles size={16} />
            Ny skanning
          </Button>
        </div>

        {timelineLoading ? (
          <EmptyState text="Henter tidslinje..." />
        ) : timeline.length ? (
          <div className="space-y-3">
            {timeline.map((item) => (
              <TimelineItem key={`${item.type}-${item.id}`} item={item} />
            ))}
          </div>
        ) : (
          <UiEmptyState
            title="Ingen aktivitet ennå"
            text="Ingen aktivitet registrert ennå. Kjør en sikkerhetsskanning for å komme i gang."
            action={
              <Button className="gap-2" onClick={() => router.push("/admin/security/scan")}>
                <ScanSearch size={16} />
                Start sikkerhetsskanning
              </Button>
            }
          />
        )}
      </Card>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <PhoenixPanel title="Kundeinfo">
          <div className="grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
            <div><p className="text-slate-500">Status</p><StatusBadge>{customer.status}</StatusBadge></div>
            <div><p className="text-slate-500">Kundetype</p><p>{customer.customer_type || "-"}</p></div>
            <div><p className="text-slate-500">E-post</p><p>{customer.email || "-"}</p></div>
            <div><p className="text-slate-500">Telefon</p><p>{customer.phone || "-"}</p></div>
            <div className="sm:col-span-2"><p className="text-slate-500">Adresse</p><p>{customer.address || "-"}</p></div>
            <div className="sm:col-span-2"><p className="text-slate-500">Notater</p><p className="whitespace-pre-wrap">{customer.notes || "-"}</p></div>
          </div>
        </PhoenixPanel>

        <ListSection
          title="Kontakter"
          items={customer.contacts}
          empty="Ingen kontakter registrert."
          render={(contact) => (
            <div key={contact.id} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
              <p className="font-semibold text-white">{contact.name || "Ukjent kontakt"}</p>
              <p className="mt-1 text-sm text-slate-400">{contact.role || "Kontakt"} - {contact.email || contact.phone || "Ingen kontaktinfo"}</p>
            </div>
          )}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ListSection
          title="Requests"
          items={customer.requests}
          empty="Ingen requests koblet."
          render={(request) => (
            <div key={request.id} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
              <div className="flex items-start justify-between gap-3"><p className="font-semibold text-white">{request.company || request.name || request.email || request.id}</p><StatusBadge>{request.status || "ny"}</StatusBadge></div>
              <p className="mt-2 text-sm text-slate-300">{request.message || request.description || "Ingen melding."}</p>
              <p className="mt-2 text-xs text-slate-500">{formatDate(request.created_at)}</p>
            </div>
          )}
        />
        <ListSection
          title="Leads"
          items={customer.leads}
          empty="Ingen leads koblet."
          render={(lead) => (
            <div key={lead.id} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
              <div className="flex items-start justify-between gap-3"><p className="font-semibold text-white">{lead.title || "Lead"}</p><StatusBadge>{lead.status || "open"}</StatusBadge></div>
              <p className="mt-2 text-sm text-slate-300">{lead.description || "Ingen beskrivelse."}</p>
            </div>
          )}
        />
        <ListSection
          title="Quotes"
          items={customer.quotes}
          empty="Ingen quotes koblet."
          render={(quote) => (
            <Link key={quote.id} href={`/admin/quotes/${quote.id}`} className="block rounded-2xl border border-white/10 bg-slate-950/45 p-4 hover:bg-white/10">
              <div className="flex items-start justify-between gap-3"><p className="font-semibold text-white">{quote.customer_name || quote.company || quote.name || "Tilbud"}</p><StatusBadge>{quote.status || "ny"}</StatusBadge></div>
              <p className="mt-2 text-sm text-slate-300">{quote.message || quote.description || "Ingen beskrivelse."}</p>
            </Link>
          )}
        />
        <ListSection
          title="Tasks / activity"
          items={customer.tasks}
          empty="Ingen tasks eller activity registrert."
          render={(task) => (
            <div key={task.id} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
              <div className="flex items-start justify-between gap-3"><p className="font-semibold text-white">{task.title || "Task"}</p><StatusBadge>{task.status || "ny"}</StatusBadge></div>
              <p className="mt-2 text-sm text-slate-300">{task.description || task.notes || "Ingen beskrivelse."}</p>
            </div>
          )}
        />
      </div>
    </div>
  );
}
