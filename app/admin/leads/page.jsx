"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EmptyState, Field, formatDate, PhoenixPageHeader, PhoenixPanel, SelectInput, StatusBadge, TextInput } from "@/components/phoenix/PhoenixUi";

const leadStatuses = ["alle", "ny", "pågår", "fullført", "arkivert", "converted"];
const editableRequestStatuses = ["ny", "pågår", "fullført", "arkivert"];
const priorities = ["alle", "normal", "hast"];

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("alle");
  const [priority, setPriority] = useState("alle");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const fetchLeads = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/requests", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Kunne ikke hente henvendelser.");
      setConfigured(result.configured !== false);
      setLeads(result.leads || []);
    } catch (err) {
      setError(err.message || "Kunne ikke hente henvendelser.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLeads(); }, []);

  const filtered = useMemo(() => {
    return leads.filter((lead) => {
      const haystack = `${lead.name || ""} ${lead.email || ""} ${lead.company || ""} ${lead.phone || ""} ${lead.message || ""}`.toLowerCase();
      const matchesQuery = haystack.includes(query.toLowerCase());
      const isConverted = Boolean(lead.converted_to_customer || lead.customer_id || lead.status === "converted");
      const matchesStatus = status === "alle" || (status === "converted" ? isConverted : lead.status === status);
      const matchesPriority = priority === "alle" || lead.priority === priority;
      return matchesQuery && matchesStatus && matchesPriority;
    });
  }, [leads, query, status, priority]);

  const convertLead = async (lead) => {
    setSavingId(lead.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/requests/${lead.id}/convert`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) {
        const hint = result.hint ? ` ${result.hint}` : "";
        throw new Error(`${result.error || "Kunne ikke konvertere henvendelsen."}${hint}`);
      }
      setLeads((current) => current.map((item) => item.id === lead.id ? {
        ...item,
        converted_to_customer: true,
        converted_at: result.request?.converted_at || item.converted_at,
        customer_id: result.customerId || result.request?.customer_id || item.customer_id,
        contact_id: result.contactId || result.request?.contact_id || item.contact_id,
        lead_id: result.leadId || result.request?.lead_id || item.lead_id,
        request: result.request || item.request
      } : item));
      setNotice(result.alreadyConverted ? "Henvendelsen var allerede konvertert." : "Henvendelsen er konvertert til kunde.");
    } catch (err) {
      setError(err.message || "Kunne ikke konvertere henvendelsen.");
    } finally {
      setSavingId(null);
    }
  };

  const updateLead = async (lead, patch) => {
    setSavingId(lead.id);
    try {
      const response = await fetch(`/api/admin/requests/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Kunne ikke oppdatere henvendelsen.");
      setLeads((current) => current.map((item) => item.id === lead.id ? result.lead : item));
    } catch (err) {
      alert(err.message || "Kunne ikke oppdatere henvendelsen.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PhoenixPageHeader
        title="Leads"
        description="Henvendelser fra Hansen IT-nettsiden hentes fra Supabase-tabellen requests. Dette er source of truth når Supabase er konfigurert."
      />

      {!configured ? (
        <PhoenixPanel title="Demo mode" description="Supabase-miljøvariabler mangler. Ekte leads vises ikke før SUPABASE_URL og SUPABASE_SERVICE_ROLE_KEY er satt.">
          <EmptyState text="Ingen ekte requests er koblet i demo mode." />
        </PhoenixPanel>
      ) : null}

      <PhoenixPanel title="Requests / henvendelser" description="Mapping: id, name, email, company, phone, message, priority, status, created_at og updated_at fra requests.">
        <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_180px_180px]">
          <Field label="Søk"><TextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Søk navn, firma, e-post, telefon eller melding..." /></Field>
          <Field label="Status"><SelectInput value={status} options={leadStatuses} onChange={(event) => setStatus(event.target.value)} /></Field>
          <Field label="Prioritet"><SelectInput value={priority} options={priorities} onChange={(event) => setPriority(event.target.value)} /></Field>
        </div>

        {loading ? <EmptyState text="Henter henvendelser fra Supabase..." /> : null}
        {error ? <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div> : null}
        {notice ? <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">{notice}</div> : null}

        {!loading && !error ? (
          <div className="grid gap-3 xl:grid-cols-2">
            {filtered.length ? filtered.map((lead) => (
              <article key={lead.id} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-white">{lead.company || lead.name || "Ukjent henvendelse"}</h3>
                    <p className="mt-1 text-sm text-slate-400">{lead.name || "Ukjent navn"} - {lead.email || "Ingen e-post"}{lead.phone ? ` - ${lead.phone}` : ""}</p>
                  </div>
                  <div className="flex flex-wrap gap-2"><StatusBadge>{lead.status}</StatusBadge><StatusBadge>{lead.priority}</StatusBadge></div>
                </div>
                <p className="mt-3 whitespace-pre-line text-sm text-slate-300">{lead.message || "Ingen melding."}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span>Request ID: {lead.id}</span>
                  <span>Opprettet: {formatDate(lead.created_at)}</span>
                  {lead.updated_at ? <span>Oppdatert: {formatDate(lead.updated_at)}</span> : null}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {lead.converted_to_customer || lead.customer_id || lead.status === "converted" ? (
                    lead.customer_id ? (
                      <Link href={`/admin/customers/${lead.customer_id}`} className="inline-flex min-h-10 items-center justify-center rounded-xl bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-300">Åpne kunde</Link>
                    ) : (
                      <span className="inline-flex min-h-10 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200">Konvertert</span>
                    )
                  ) : (
                    <button type="button" disabled={savingId === lead.id} onClick={() => convertLead(lead)} className="inline-flex min-h-10 items-center justify-center rounded-xl bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-50">Konverter til kunde</button>
                  )}
                </div><div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Field label="Status"><SelectInput disabled={savingId === lead.id} value={editableRequestStatuses.includes(lead.status) ? lead.status : "ny"} options={editableRequestStatuses} onChange={(event) => updateLead(lead, { status: event.target.value })} /></Field>
                  <Field label="Prioritet"><SelectInput disabled={savingId === lead.id} value={lead.priority || "normal"} options={priorities.filter((item) => item !== "alle")} onChange={(event) => updateLead(lead, { priority: event.target.value })} /></Field>
                </div>
              </article>
            )) : <EmptyState text="Ingen requests i dette filteret." />}
          </div>
        ) : null}
      </PhoenixPanel>
    </div>
  );
}

