"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { EmptyState, formatDate, PhoenixPageHeader, PhoenixPanel, StatusBadge } from "@/components/phoenix/PhoenixUi";

function ListSection({ title, items, render, empty }) {
  return (
    <PhoenixPanel title={title}>
      <div className="space-y-3">
        {items?.length ? items.map(render) : <EmptyState text={empty} />}
      </div>
    </PhoenixPanel>
  );
}

export default function CustomerDetailsPage() {
  const params = useParams();
  const [customer, setCustomer] = useState(null);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
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
    loadCustomer();
    return () => { cancelled = true; };
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
