"use client";
export const dynamic = "force-dynamic";

import { useMemo, useState } from "react";
import { Copy, Eye, FileDown, Plus, Trash2 } from "lucide-react";
import { quoteStatuses } from "@/lib/phoenixMockData";
import { usePhoenixData } from "@/components/phoenix/usePhoenixData";
import { EmptyState, Field, FormActions, formatCurrency, formatDate, PhoenixPageHeader, PhoenixPanel, SecondaryButton, SelectInput, StatusBadge, TextArea, TextInput } from "@/components/phoenix/PhoenixUi";

const defaultVatRate = 25;

const blankLine = () => ({
  id: `linje-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  description: "",
  quantity: 1,
  unitPrice: 0,
  discount: 0,
  vatRate: defaultVatRate
});

const blankQuote = {
  customerId: "",
  contactPerson: "",
  title: "",
  description: "",
  lineItems: [blankLine()],
  status: "kladd",
  validUntil: "",
  internalNotes: "",
  customerNote: ""
};

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function calculateLine(line) {
  const quantity = Math.max(0, toNumber(line.quantity));
  const unitPrice = Math.max(0, toNumber(line.unitPrice));
  const discount = Math.max(0, toNumber(line.discount));
  const vatRate = Math.max(0, toNumber(line.vatRate));
  const gross = quantity * unitPrice;
  const net = Math.max(0, gross - discount);
  const vat = net * (vatRate / 100);
  return { gross, net, vat, total: net + vat };
}

function calculateTotals(lineItems = []) {
  return lineItems.reduce((acc, line) => {
    const calculated = calculateLine(line);
    return {
      subtotalExVat: acc.subtotalExVat + calculated.net,
      vatTotal: acc.vatTotal + calculated.vat,
      totalIncVat: acc.totalIncVat + calculated.total
    };
  }, { subtotalExVat: 0, vatTotal: 0, totalIncVat: 0 });
}

function normalizeQuote(quote, customersById, fallbackCustomerId) {
  const customer = customersById.get(quote.customerId || fallbackCustomerId);
  const lineItems = Array.isArray(quote.lineItems) && quote.lineItems.length
    ? quote.lineItems.map((line) => ({ ...blankLine(), ...line, id: line.id || blankLine().id }))
    : [{ ...blankLine(), description: quote.description || quote.title || "Tjeneste", quantity: 1, unitPrice: toNumber(quote.priceExVat), discount: 0, vatRate: defaultVatRate }];

  return {
    ...blankQuote,
    ...quote,
    customerId: quote.customerId || fallbackCustomerId || "",
    contactPerson: quote.contactPerson || customer?.contactPerson || "",
    lineItems,
    internalNotes: quote.internalNotes ?? quote.notes ?? "",
    customerNote: quote.customerNote ?? "",
    status: quote.status || "kladd"
  };
}

function prepareQuoteForSave(form, editingId) {
  const totals = calculateTotals(form.lineItems);
  return {
    ...form,
    id: editingId || form.id,
    priceExVat: totals.subtotalExVat,
    totalExVat: totals.subtotalExVat,
    totalVat: totals.vatTotal,
    totalIncVat: totals.totalIncVat,
    notes: form.internalNotes
  };
}

export default function QuotesPage() {
  const { data, customersById, upsert, remove } = usePhoenixData();
  const firstCustomerId = data.customers[0]?.id || "";
  const [form, setForm] = useState({ ...blankQuote, customerId: firstCustomerId, contactPerson: data.customers[0]?.contactPerson || "" });
  const [editingId, setEditingId] = useState(null);
  const [query, setQuery] = useState("");
  const [previewQuote, setPreviewQuote] = useState(null);

  const selectedCustomer = customersById.get(form.customerId);
  const contactOptions = useMemo(() => {
    const contacts = selectedCustomer?.contacts?.length
      ? selectedCustomer.contacts.map((contact) => contact.name).filter(Boolean)
      : [selectedCustomer?.contactPerson].filter(Boolean);
    return Array.from(new Set(contacts));
  }, [selectedCustomer]);

  const totals = useMemo(() => calculateTotals(form.lineItems), [form.lineItems]);

  const filtered = data.quotes.filter((quote) => {
    const normalized = normalizeQuote(quote, customersById, firstCustomerId);
    return `${normalized.title} ${normalized.description} ${normalized.contactPerson} ${customersById.get(normalized.customerId)?.companyName || ""}`.toLowerCase().includes(query.toLowerCase());
  });

  const updateLine = (lineId, patch) => {
    setForm((current) => ({
      ...current,
      lineItems: current.lineItems.map((line) => line.id === lineId ? { ...line, ...patch } : line)
    }));
  };

  const addLine = () => setForm((current) => ({ ...current, lineItems: [...current.lineItems, blankLine()] }));

  const removeLine = (lineId) => {
    setForm((current) => ({
      ...current,
      lineItems: current.lineItems.length > 1 ? current.lineItems.filter((line) => line.id !== lineId) : current.lineItems
    }));
  };

  const save = (event) => {
    event.preventDefault();
    if (!form.title.trim()) return;
    upsert("quotes", prepareQuoteForSave(form, editingId), "tilbud");
    setForm({ ...blankQuote, customerId: firstCustomerId, contactPerson: data.customers[0]?.contactPerson || "", lineItems: [blankLine()] });
    setEditingId(null);
    setPreviewQuote(null);
  };

  const edit = (quote) => {
    const normalized = normalizeQuote(quote, customersById, firstCustomerId);
    setForm(normalized);
    setEditingId(quote.id);
    setPreviewQuote(normalized);
  };

  const duplicate = (quote) => {
    const normalized = normalizeQuote(quote, customersById, firstCustomerId);
    upsert("quotes", {
      ...prepareQuoteForSave(normalized, null),
      id: null,
      title: `${normalized.title} (kopi)`,
      status: "kladd"
    }, "tilbud");
  };

  const exportPdf = async (quote = form) => {
    const normalized = normalizeQuote(prepareQuoteForSave(quote, quote.id), customersById, firstCustomerId);
    const customer = customersById.get(normalized.customerId);
    const quoteTotals = calculateTotals(normalized.lineItems);
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Project Phoenix - Tilbud", 14, 18);
    doc.setFontSize(11);
    doc.text(`Kunde: ${customer?.companyName || "Ingen kunde"}`, 14, 30);
    doc.text(`Kontaktperson: ${normalized.contactPerson || "-"}`, 14, 37);
    doc.text(`Status: ${normalized.status}`, 14, 44);
    doc.text(`Gyldig til: ${normalized.validUntil || "-"}`, 14, 51);
    doc.setFontSize(14);
    doc.text(normalized.title || "Tilbud", 14, 64);
    doc.setFontSize(10);
    doc.text(doc.splitTextToSize(normalized.description || "", 180), 14, 72);

    let y = 92;
    doc.setFontSize(10);
    doc.text("Linje", 14, y);
    doc.text("Ant", 108, y);
    doc.text("Enhetspris", 126, y);
    doc.text("Rabatt", 155, y);
    doc.text("Eks. mva", 176, y);
    y += 6;
    doc.line(14, y, 196, y);
    y += 7;

    normalized.lineItems.forEach((line) => {
      const calculated = calculateLine(line);
      const descriptionLines = doc.splitTextToSize(line.description || "Tjeneste", 88);
      doc.text(descriptionLines, 14, y);
      doc.text(String(line.quantity || 0), 108, y);
      doc.text(formatCurrency(line.unitPrice).replace("NOK", "kr"), 126, y);
      doc.text(formatCurrency(line.discount).replace("NOK", "kr"), 155, y);
      doc.text(formatCurrency(calculated.net).replace("NOK", "kr"), 176, y);
      y += Math.max(8, descriptionLines.length * 5 + 3);
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
    });

    y += 5;
    doc.line(120, y, 196, y);
    y += 7;
    doc.text(`Total eks. mva: ${formatCurrency(quoteTotals.subtotalExVat).replace("NOK", "kr")}`, 126, y);
    y += 7;
    doc.text(`Mva: ${formatCurrency(quoteTotals.vatTotal).replace("NOK", "kr")}`, 126, y);
    y += 7;
    doc.text(`Total inkl. mva: ${formatCurrency(quoteTotals.totalIncVat).replace("NOK", "kr")}`, 126, y);

    if (normalized.customerNote) {
      y += 14;
      doc.text("Notat til kunde:", 14, y);
      y += 6;
      doc.text(doc.splitTextToSize(normalized.customerNote, 180), 14, y);
    }

    doc.save(`${(normalized.title || "tilbud").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`);
  };

  const preview = prepareQuoteForSave(previewQuote || form, editingId);
  const previewCustomer = customersById.get(preview.customerId);
  const previewTotals = calculateTotals(preview.lineItems);

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PhoenixPageHeader title="Tilbud" description="Lag, rediger, dupliser, forhåndsvis og eksporter tilbud. Fortsatt mock/localStorage - faktura kommer ikke inn i v1." />

      <div className="grid gap-6 2xl:grid-cols-[minmax(520px,0.95fr)_minmax(440px,0.75fr)]">
        <PhoenixPanel title={editingId ? "Rediger tilbud" : "Nytt tilbud"} description="Bygg tilbudet med kunde, kontaktperson, linjer, notater og gyldighet.">
          <form onSubmit={save} className="space-y-5">
            <div className="grid gap-3 lg:grid-cols-2">
              <Field label="Kunde">
                <SelectInput
                  value={form.customerId || firstCustomerId}
                  options={data.customers.map((customer) => ({ value: customer.id, label: customer.companyName }))}
                  onChange={(event) => {
                    const customer = customersById.get(event.target.value);
                    setForm({ ...form, customerId: event.target.value, contactPerson: customer?.contactPerson || "" });
                  }}
                />
              </Field>
              <Field label="Kontaktperson">
                {contactOptions.length ? (
                  <SelectInput value={form.contactPerson} options={contactOptions} onChange={(event) => setForm({ ...form, contactPerson: event.target.value })} />
                ) : (
                  <TextInput value={form.contactPerson} onChange={(event) => setForm({ ...form, contactPerson: event.target.value })} />
                )}
              </Field>
            </div>

            <Field label="Tittel"><TextInput value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></Field>
            <Field label="Beskrivelse"><TextArea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>

            <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-semibold text-white">Linjevarer / tjenester</h3>
                <SecondaryButton type="button" onClick={addLine}><Plus size={16} />Legg til linje</SecondaryButton>
              </div>

              <div className="space-y-3">
                {form.lineItems.map((line, index) => {
                  const calculated = calculateLine(line);
                  return (
                    <div key={line.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                      <div className="grid gap-3 xl:grid-cols-[1.5fr_90px_130px_110px_90px_120px_44px]">
                        <Field label={`Linje ${index + 1}`}><TextInput value={line.description} placeholder="Tjeneste eller vare" onChange={(event) => updateLine(line.id, { description: event.target.value })} /></Field>
                        <Field label="Antall"><TextInput type="number" min="0" step="0.01" value={line.quantity} onChange={(event) => updateLine(line.id, { quantity: event.target.value })} /></Field>
                        <Field label="Enhetspris"><TextInput type="number" min="0" step="0.01" value={line.unitPrice} onChange={(event) => updateLine(line.id, { unitPrice: event.target.value })} /></Field>
                        <Field label="Rabatt"><TextInput type="number" min="0" step="0.01" value={line.discount} onChange={(event) => updateLine(line.id, { discount: event.target.value })} /></Field>
                        <Field label="Mva %"><TextInput type="number" min="0" step="1" value={line.vatRate} onChange={(event) => updateLine(line.id, { vatRate: event.target.value })} /></Field>
                        <div className="text-sm text-slate-300">
                          <p className="text-slate-500">Eks. mva</p>
                          <p className="mt-2 font-semibold text-white">{formatCurrency(calculated.net)}</p>
                        </div>
                        <button type="button" onClick={() => removeLine(line.id)} className="mt-6 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-rose-400/30 text-rose-200 hover:bg-rose-500/10" title="Fjern linje">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 rounded-2xl border border-white/10 bg-cyan-400/10 p-4 md:grid-cols-3">
              <div><p className="text-xs text-slate-400">Total eks. mva</p><p className="mt-1 text-lg font-bold text-white">{formatCurrency(totals.subtotalExVat)}</p></div>
              <div><p className="text-xs text-slate-400">Mva</p><p className="mt-1 text-lg font-bold text-white">{formatCurrency(totals.vatTotal)}</p></div>
              <div><p className="text-xs text-slate-400">Total inkl. mva</p><p className="mt-1 text-lg font-bold text-white">{formatCurrency(totals.totalIncVat)}</p></div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <Field label="Status"><SelectInput value={form.status} options={quoteStatuses} onChange={(event) => setForm({ ...form, status: event.target.value })} /></Field>
              <Field label="Gyldig til"><TextInput type="date" value={form.validUntil} onChange={(event) => setForm({ ...form, validUntil: event.target.value })} /></Field>
            </div>
            <Field label="Interne notater"><TextArea value={form.internalNotes} onChange={(event) => setForm({ ...form, internalNotes: event.target.value })} /></Field>
            <Field label="Kunde-notat"><TextArea value={form.customerNote} onChange={(event) => setForm({ ...form, customerNote: event.target.value })} /></Field>

            <div className="flex flex-wrap gap-2">
              <FormActions editing={Boolean(editingId)} onCancel={() => { setForm({ ...blankQuote, customerId: firstCustomerId, contactPerson: data.customers[0]?.contactPerson || "", lineItems: [blankLine()] }); setEditingId(null); }} />
              <SecondaryButton type="button" onClick={() => setPreviewQuote(prepareQuoteForSave(form, editingId))}><Eye size={16} />Forhåndsvisning</SecondaryButton>
              <SecondaryButton type="button" onClick={() => exportPdf(form)}><FileDown size={16} />Eksporter PDF</SecondaryButton>
            </div>
          </form>
        </PhoenixPanel>

        <div className="space-y-6">
          <PhoenixPanel title="Forhåndsvisning" description="Slik ser tilbudet ut før du sender det.">
            <div className="rounded-2xl border border-white/10 bg-white p-5 text-slate-950">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Project Phoenix / Hansen IT</p>
                  <h2 className="mt-2 text-2xl font-bold">{preview.title || "Nytt tilbud"}</h2>
                  <p className="mt-1 text-sm text-slate-600">{previewCustomer?.companyName || "Ingen kunde"} - {preview.contactPerson || "Ingen kontaktperson"}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase text-slate-700">{preview.status}</span>
              </div>
              {preview.description ? <p className="mt-4 whitespace-pre-line text-sm text-slate-700">{preview.description}</p> : null}
              <div className="mt-5 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                    <tr><th className="py-2">Tjeneste</th><th>Antall</th><th>Pris</th><th>Rabatt</th><th className="text-right">Eks. mva</th></tr>
                  </thead>
                  <tbody>
                    {preview.lineItems.map((line) => {
                      const calculated = calculateLine(line);
                      return <tr key={line.id} className="border-b border-slate-100"><td className="py-2">{line.description || "Tjeneste"}</td><td>{line.quantity}</td><td>{formatCurrency(line.unitPrice)}</td><td>{formatCurrency(line.discount)}</td><td className="text-right font-semibold">{formatCurrency(calculated.net)}</td></tr>;
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-5 ml-auto max-w-xs space-y-2 text-sm">
                <div className="flex justify-between"><span>Total eks. mva</span><strong>{formatCurrency(previewTotals.subtotalExVat)}</strong></div>
                <div className="flex justify-between"><span>Mva</span><strong>{formatCurrency(previewTotals.vatTotal)}</strong></div>
                <div className="flex justify-between border-t border-slate-200 pt-2 text-base"><span>Total inkl. mva</span><strong>{formatCurrency(previewTotals.totalIncVat)}</strong></div>
              </div>
              {preview.customerNote ? <div className="mt-5 rounded-xl bg-slate-50 p-3 text-sm text-slate-700"><strong>Notat:</strong> {preview.customerNote}</div> : null}
              <p className="mt-4 text-xs text-slate-500">Gyldig til: {formatDate(preview.validUntil)}</p>
            </div>
          </PhoenixPanel>

          <PhoenixPanel title="Tilbudsliste" description="Søk, rediger, dupliser eller eksporter.">
            <TextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Søk tilbud, kunde eller kontakt..." className="mb-4" />
            <div className="space-y-3">
              {filtered.length ? filtered.map((quote) => {
                const normalized = normalizeQuote(quote, customersById, firstCustomerId);
                const quoteTotals = calculateTotals(normalized.lineItems);
                return (
                  <article key={quote.id} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-white">{normalized.title}</h3>
                        <p className="mt-1 text-sm text-slate-400">{customersById.get(normalized.customerId)?.companyName || "Ingen kunde"} - {normalized.contactPerson || "Ingen kontakt"} - {formatDate(normalized.validUntil)}</p>
                      </div>
                      <StatusBadge>{normalized.status}</StatusBadge>
                    </div>
                    <p className="mt-3 text-sm text-slate-300">{normalized.description}</p>
                    <div className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                      <span>Total eks. mva: <strong className="text-white">{formatCurrency(quoteTotals.subtotalExVat)}</strong></span>
                      <span>Total inkl. mva: <strong className="text-white">{formatCurrency(quoteTotals.totalIncVat)}</strong></span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <SecondaryButton type="button" onClick={() => edit(quote)}>Rediger</SecondaryButton>
                      <SecondaryButton type="button" onClick={() => duplicate(quote)}><Copy size={16} />Dupliser</SecondaryButton>
                      <SecondaryButton type="button" onClick={() => setPreviewQuote(normalized)}><Eye size={16} />Forhåndsvis</SecondaryButton>
                      <SecondaryButton type="button" onClick={() => exportPdf(normalized)}><FileDown size={16} />PDF</SecondaryButton>
                      <button type="button" onClick={() => remove("quotes", quote.id)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-rose-400/30 px-3 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-500/10"><Trash2 size={16} />Slett</button>
                    </div>
                  </article>
                );
              }) : <EmptyState text="Ingen tilbud funnet." />}
            </div>
          </PhoenixPanel>
        </div>
      </div>
    </div>
  );
}
