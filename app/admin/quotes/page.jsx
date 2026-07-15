"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { EmptyState, Field, formatDate, PhoenixPageHeader, PhoenixPanel, PrimaryButton, SelectInput, StatusBadge, TextArea, TextInput } from "@/components/phoenix/PhoenixUi";

const blankQuote = { company: "", name: "", email: "", phone: "", message: "", status: "kladd", priority: "normal", customer_id: "", contact_id: "", lead_id: "", source_request_id: "" };

export default function QuotesPage() {
  const [quotes, setQuotes] = useState([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(blankQuote);
  const [customers, setCustomers] = useState([]);
  const [leads, setLeads] = useState([]);
  const [requests, setRequests] = useState([]);

  const loadQuotes = async () => {
    setLoading(true);
    const response = await fetch("/api/admin/quotes", { cache: "no-store" });
    const result = await response.json();
    setConfigured(result.configured !== false);
    setQuotes(result.data || []);
    setLoading(false);
  };

  useEffect(() => { loadQuotes(); }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadRelations() {
      const [customerRes, leadRes, requestRes] = await Promise.all([
        fetch("/api/admin/customers", { cache: "no-store" }),
        fetch("/api/admin/leads", { cache: "no-store" }),
        fetch("/api/admin/requests", { cache: "no-store" })
      ]);
      const [customerJson, leadJson, requestJson] = await Promise.all([customerRes.json(), leadRes.json(), requestRes.json()]);
      if (cancelled) return;
      setCustomers(customerJson.data || []);
      setLeads(leadJson.data || []);
      setRequests(requestJson.data || []);
    }
    loadRelations().catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const selectedCustomer = customers.find((customer) => customer.id === form.customer_id);
  const contacts = selectedCustomer?.contacts || [];

  const filtered = useMemo(() => quotes.filter((quote) => `${quote.name || ""} ${quote.company || ""} ${quote.customer_name || ""} ${quote.email || ""} ${quote.message || ""}`.toLowerCase().includes(query.toLowerCase())), [quotes, query]);

  const createQuote = async (event) => {
    event.preventDefault();
    if (!configured) return alert("Supabase er ikke konfigurert.");
    const response = await fetch("/api/admin/quotes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const result = await response.json();
    if (!response.ok) return alert(result.error || "Kunne ikke opprette tilbud.");
    setQuotes([result.data, ...quotes]);
    setForm(blankQuote);
  };

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PhoenixPageHeader title="Tilbud" description="Tilbud opprettes som Supabase requests og kan åpnes i eksisterende quote-detalj/portal-flyt." />
      {!configured ? <PhoenixPanel title="Demo mode" description="Supabase er ikke konfigurert. Tilbud kan ikke lagres i produksjonsflyten." /> : null}
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <PhoenixPanel title="Nytt tilbud" description="Oppretter et tilbud/request som kan få portal-lenke fra detaljsiden.">
          <form onSubmit={createQuote} className="space-y-4">
            <Field label="Firma"><TextInput value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} required /></Field>
            <Field label="Kontaktperson"><TextInput value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="E-post"><TextInput type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
              <Field label="Telefon"><TextInput value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></Field>
            </div>
            <Field label="Beskrivelse"><TextArea value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Koble kunde"><SelectInput value={form.customer_id} options={[{ value: "", label: "Ingen valgt" }, ...customers.map((customer) => ({ value: customer.id, label: customer.company_name || customer.email || customer.id }))]} onChange={(event) => setForm({ ...form, customer_id: event.target.value, contact_id: "" })} /></Field>
              <Field label="Koble kontakt"><SelectInput value={form.contact_id} options={[{ value: "", label: "Ingen valgt" }, ...contacts.map((contact) => ({ value: contact.id, label: contact.name || contact.email || contact.id }))]} onChange={(event) => setForm({ ...form, contact_id: event.target.value })} /></Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Koble lead"><SelectInput value={form.lead_id} options={[{ value: "", label: "Ingen valgt" }, ...leads.map((lead) => ({ value: lead.id, label: lead.title || lead.customer?.company_name || lead.id }))]} onChange={(event) => setForm({ ...form, lead_id: event.target.value })} /></Field>
              <Field label="Koble request"><SelectInput value={form.source_request_id} options={[{ value: "", label: "Ingen valgt" }, ...requests.map((request) => ({ value: request.id, label: request.company || request.name || request.email || request.id }))]} onChange={(event) => setForm({ ...form, source_request_id: event.target.value })} /></Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Status"><SelectInput value={form.status} options={["kladd", "Ny", "pågår", "sendt", "godkjent", "avslått"]} onChange={(event) => setForm({ ...form, status: event.target.value })} /></Field>
              <Field label="Prioritet"><SelectInput value={form.priority} options={["normal", "hast"]} onChange={(event) => setForm({ ...form, priority: event.target.value })} /></Field>
            </div>
            <PrimaryButton type="submit"><Plus size={16} />Opprett tilbud</PrimaryButton>
          </form>
        </PhoenixPanel>

        <PhoenixPanel title="Tilbudsliste" description="Åpne et tilbud for detaljer, meldinger, vedlegg og portal-lenke.">
          <TextInput className="mb-4" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Søk tilbud..." />
          {loading ? <EmptyState text="Henter tilbud..." /> : <div className="space-y-3">
            {filtered.length ? filtered.map((quote) => (
              <article key={quote.id} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-white">{quote.customer_name || quote.company || quote.name || "Ukjent kunde"}</h3>
                    <p className="mt-1 text-sm text-slate-400">{quote.email || "Ingen e-post"} - {formatDate(quote.created_at)}</p>
                  </div>
                  <StatusBadge>{quote.status || "Ny"}</StatusBadge>
                </div>
                <p className="mt-3 line-clamp-3 text-sm text-slate-300">{quote.message || quote.description}</p>
                <div className="mt-4"><Link href={`/admin/quotes/${quote.id}`} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">Åpne tilbud <ArrowRight size={16} /></Link></div>
              </article>
            )) : <EmptyState text="Ingen tilbud funnet." />}
          </div>}
        </PhoenixPanel>
      </div>
    </div>
  );
}
