"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import { quoteStatuses } from "@/lib/phoenixMockData";
import { usePhoenixData } from "@/components/phoenix/usePhoenixData";
import { EmptyState, Field, FormActions, formatCurrency, formatDate, PhoenixPageHeader, PhoenixPanel, RecordCard, SelectInput, TextArea, TextInput } from "@/components/phoenix/PhoenixUi";

const blankQuote = { customerId: "", title: "", description: "", priceExVat: 0, status: "kladd", validUntil: "", notes: "" };

export default function QuotesPage() {
  const { data, customersById, upsert, remove } = usePhoenixData();
  const [form, setForm] = useState(blankQuote);
  const [editingId, setEditingId] = useState(null);
  const [query, setQuery] = useState("");

  const filtered = data.quotes.filter((quote) => `${quote.title} ${quote.description} ${customersById.get(quote.customerId)?.companyName || ""}`.toLowerCase().includes(query.toLowerCase()));

  const save = (event) => {
    event.preventDefault();
    if (!form.title.trim()) return;
    upsert("quotes", { ...form, id: editingId, customerId: form.customerId || data.customers[0]?.id || "", priceExVat: Number(form.priceExVat || 0) }, "tilbud");
    setForm({ ...blankQuote, customerId: data.customers[0]?.id || "" });
    setEditingId(null);
  };

  const edit = (quote) => {
    setForm({ ...blankQuote, ...quote });
    setEditingId(quote.id);
  };

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PhoenixPageHeader title="Tilbud" description="Quotes-inspirasjon fra gamle CRM, bygget som en enkel v1-liste med status og beløp." />
      <div className="grid gap-6 xl:grid-cols-[400px_1fr]">
        <PhoenixPanel title={editingId ? "Rediger tilbud" : "Nytt tilbud"} description="Faktura og avansert PDF er utenfor v1.">
          <form onSubmit={save} className="space-y-4">
            <Field label="Kunde"><SelectInput value={form.customerId || data.customers[0]?.id || ""} options={data.customers.map((customer) => ({ value: customer.id, label: customer.companyName }))} onChange={(e) => setForm({ ...form, customerId: e.target.value })} /></Field>
            <Field label="Tittel"><TextInput value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></Field>
            <Field label="Beskrivelse"><TextArea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Pris eks. mva"><TextInput type="number" value={form.priceExVat} onChange={(e) => setForm({ ...form, priceExVat: e.target.value })} /></Field>
              <Field label="Status"><SelectInput value={form.status} options={quoteStatuses} onChange={(e) => setForm({ ...form, status: e.target.value })} /></Field>
            </div>
            <Field label="Gyldig til"><TextInput type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} /></Field>
            <Field label="Notater"><TextArea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
            <FormActions editing={Boolean(editingId)} onCancel={() => { setForm(blankQuote); setEditingId(null); }} />
          </form>
        </PhoenixPanel>

        <PhoenixPanel title="Tilbudsliste" description="Søk, se status og åpne/rediger tilbud raskt.">
          <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Søk tilbud eller kunde..." className="mb-4 max-w-sm" />
          <div className="space-y-3">
            {filtered.length ? filtered.map((quote) => (
              <RecordCard key={quote.id} title={quote.title} meta={`${customersById.get(quote.customerId)?.companyName || "Ingen kunde"} - ${formatCurrency(quote.priceExVat)} - gyldig til ${formatDate(quote.validUntil)}`} badge={quote.status} onEdit={() => edit(quote)} onDelete={() => remove("quotes", quote.id)}>
                <p>{quote.description}</p>
                {quote.notes ? <p className="mt-2 text-slate-400">Notat: {quote.notes}</p> : null}
              </RecordCard>
            )) : <EmptyState text="Ingen tilbud funnet." />}
          </div>
        </PhoenixPanel>
      </div>
    </div>
  );
}
