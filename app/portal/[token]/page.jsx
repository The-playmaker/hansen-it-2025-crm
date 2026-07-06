"use client";
export const dynamic = "force-dynamic";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AlertTriangle, Calendar, CheckCircle2, Clock, Download, FileText, MessageSquare, Paperclip, Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Textarea";

const vatRate = 0.25;

function formatCurrency(value) {
  return new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString("nb-NO") : "Ikke avtalt";
}

function quoteReference(quote) {
  return `Tilbud ${String(quote?.id || "").slice(0, 8).toUpperCase()}`;
}

function moneyValue(...values) {
  for (const value of values) {
    const number = Number(value || 0);
    if (Number.isFinite(number) && number > 0) return number;
  }
  return 0;
}

function lineTotalExVat(item) {
  const explicit = Number(item.line_total_ex_vat || 0);
  if (explicit > 0) return explicit;
  return Number(item.quantity || 0) * Number(item.unit_price || 0);
}

function normalizeStatus(status, portalStatus) {
  if (portalStatus === "approved" || status === "godkjent") return "Godkjent";
  if (portalStatus === "changes_requested" || status === "endringer ønsket") return "Endringer ønsket";
  if (status === "Fullført" || status === "ferdig") return "Ferdig";
  if (status === "Pågår" || status === "pågår") return "Arbeid pågår";
  if (status === "sendt") return "Tilbud sendt";
  return "Avventer godkjenning";
}

function statusBadge(status, portalStatus) {
  const label = normalizeStatus(status, portalStatus);
  const classes = label === "Godkjent"
    ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
    : label === "Endringer ønsket"
      ? "border-amber-400/40 bg-amber-500/10 text-amber-100"
      : "border-[#3FA1FF]/40 bg-[#1D6FE0]/10 text-sky-100";
  return <span className={`inline-flex rounded-full border px-3 py-1 text-sm ${classes}`}>{label}</span>;
}

function documentLabel(document) {
  if (document.title) return document.title;
  if (document.type === "scan_combined_pdf") return "Samlet sikkerhetsrapport";
  if (document.type === "scan_domain_pdf") return "Teknisk rapport per domene";
  if (document.type === "security_report_pdf") return "Sikkerhetsrapport PDF";
  if (document.type === "quote_pdf") return "Tilbud PDF";
  return document.filename || "Dokument";
}

export default function QuotePortal() {
  const { token } = useParams();
  const tokenStr = String(token || "");

  const [data, setData] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [quoteItems, setQuoteItems] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [receipt, setReceipt] = useState("");

  const totals = useMemo(() => {
    const hours = timeEntries.reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
    const timeSubtotal = timeEntries.reduce((sum, entry) => sum + Number(entry.hours || 0) * Number(entry.rate || 0), 0);
    const itemSubtotal = quoteItems.reduce((sum, item) => sum + lineTotalExVat(item), 0);
    const quote = data?.quote || {};
    const subtotal = moneyValue(itemSubtotal + timeSubtotal, quote.total_ex_vat, quote.subtotal, quote.price_ex_vat, quote.price);
    const vat = moneyValue(quote.total_vat, quote.vat_amount, subtotal * vatRate);
    const total = moneyValue(quote.total_inc_vat, quote.total, subtotal + vat);
    return { hours, subtotal, vat, total, averageRate: hours ? subtotal / hours : 0 };
  }, [timeEntries, quoteItems, data]);

  const quoteLines = useMemo(() => {
    if (quoteItems.length) {
      return quoteItems.map((item) => ({
        id: item.id,
        title: item.title || item.service_package?.name || item.description || "Tilbudslinje",
        description: item.description || item.service_package?.short_description || "Produktpakke fra Hansen IT",
        included: Array.isArray(item.service_package?.service_package_items)
          ? item.service_package.service_package_items.slice(0, 6)
          : Array.isArray(item.metadata?.included_items)
            ? item.metadata.included_items.slice(0, 6)
            : [],
        quantity: Number(item.quantity || 1),
        unit: item.unit || "pakke",
        unitPrice: Number(item.unit_price || 0),
        total: lineTotalExVat(item),
        isPackage: item.item_type === "package" || Boolean(item.service_package_id)
      }));
    }
    if (timeEntries.length) {
      return timeEntries.map((entry) => ({
        id: entry.id,
        title: entry.description || "Arbeid etter avtale",
        description: entry.description || "Arbeid etter avtale",
        included: [],
        quantity: Number(entry.hours || 0),
        unit: "timer",
        unitPrice: Number(entry.rate || 0),
        total: Number(entry.hours || 0) * Number(entry.rate || 0),
        isPackage: false
      }));
    }
    const quote = data?.quote || {};
    const subtotal = totals.subtotal || Number(quote.total_ex_vat || quote.subtotal || quote.price || 0);
    return subtotal ? [{
      id: "quote-summary",
      title: quote.title || quote.category || "Tilbud fra Hansen IT",
      description: quote.title || quote.category || "Tilbud fra Hansen IT",
      included: [],
      quantity: 1,
      unit: "pakke",
      unitPrice: subtotal,
      total: subtotal,
      isPackage: false
    }] : [];
  }, [quoteItems, timeEntries, data, totals.subtotal]);

  const load = async () => {
    if (!tokenStr) return;
    try {
      setLoading(true);
      setInvalid(false);
      const response = await fetch(`/api/portal/${encodeURIComponent(tokenStr)}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) {
        setInvalid(true);
        return;
      }
      setTimeEntries(json.timeEntries || []);
      setQuoteItems(json.quoteItems || []);
      setAttachments(json.attachments || []);
      setDocuments(json.documents || []);
      setData({ quote: json.quote, employee: json.employee, token: json.token });

      const messagesResponse = await fetch(`/api/portal/${encodeURIComponent(tokenStr)}/messages`, { cache: "no-store" });
      const messagesJson = await messagesResponse.json();
      if (messagesResponse.ok) setMessages(messagesJson.data || []);
    } catch (error) {
      console.error(error);
      setInvalid(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenStr]);

  const postPortalMessage = async () => {
    if (!message.trim()) return;
    try {
      setSending(true);
      const response = await fetch(`/api/portal/${encodeURIComponent(tokenStr)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || "Kunne ikke sende melding.");
      setMessages((current) => [json.data, ...current]);
      setMessage("");
    } catch (error) {
      console.error(error);
      alert("Kunne ikke sende melding. Prøv igjen eller kontakt Hansen IT.");
    } finally {
      setSending(false);
    }
  };

  const portalAction = async (type) => {
    if (type === "changes_requested" && !message.trim()) {
      alert("Skriv kort hva du ønsker endret før du sender.");
      return;
    }

    try {
      setActionBusy(true);
      const response = await fetch("/api/portal/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenStr, type, message: message.trim() })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || "Kunne ikke oppdatere status.");
      setReceipt(type === "approved"
        ? "Tilbudet er godkjent. Hansen IT tar kontakt for videre fremdrift."
        : "Endringsønsket er sendt. Hansen IT følger opp tilbudet.");
      setMessage("");
      await load();
    } catch (error) {
      console.error(error);
      alert(error.message || "Kunne ikke oppdatere status.");
    } finally {
      setActionBusy(false);
    }
  };

  const downloadAttachment = async (filePath) => {
    try {
      const response = await fetch("/api/portal/attachments/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenStr, file_path: filePath })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || "Kunne ikke laste ned.");
      window.open(json.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error(error);
      alert("Kunne ikke laste ned dokumentet.");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#152149]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#3FA1FF] border-t-transparent" />
      </div>
    );
  }

  if (invalid || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#152149] px-4">
        <Card className="max-w-md border-red-500 bg-red-500/10 text-center">
          <div className="flex flex-col items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-red-300" />
            <h1 className="text-xl font-bold text-white">Lenken er ikke gyldig</h1>
            <p className="text-sm text-red-100">Portal-lenken er ugyldig eller utløpt. Kontakt Hansen IT for ny lenke.</p>
          </div>
        </Card>
      </div>
    );
  }

  const { quote, employee } = data;
  const timeline = [
    { label: "Henvendelse mottatt", done: true },
    { label: "Tilbud sendt", done: true },
    { label: "Avventer godkjenning", done: !["approved"].includes(quote.portal_status) },
    { label: "Godkjent", done: quote.portal_status === "approved" },
    { label: "Arbeid pågår", done: normalizeStatus(quote.status, quote.portal_status) === "Arbeid pågår" },
    { label: "Ferdig", done: normalizeStatus(quote.status, quote.portal_status) === "Ferdig" }
  ];

  return (
    <div className="min-h-screen bg-[#152149] text-white">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <Image src="/brand/hansen-it/logo/logo-horizontal-dark.svg" alt="Hansen IT" width={220} height={70} priority />
          <div className="text-right text-sm text-slate-300">
            <p>{quoteReference(quote)}</p>
            <p>post@hansen-it.com</p>
          </div>
        </header>

        <Card className="border-[#3FA1FF]/30 bg-[#1B2A52]/90">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-start">
            <div>
              <p className="mb-2 text-sm uppercase tracking-[0.18em] text-[#3FA1FF]">Hansen IT kundeportal</p>
              <h1 className="text-3xl font-bold">Ditt tilbud fra Hansen IT</h1>
              <p className="mt-3 max-w-3xl text-slate-200">
                Her kan du se tilbudet, laste ned dokumenter, stille spørsmål og godkjenne eller be om endringer.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {statusBadge(quote.status, quote.portal_status)}
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-200">{quoteReference(quote)}</span>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#152149]/80 p-4 text-sm text-slate-200">
              <p className="font-semibold text-white">Kontakt hos Hansen IT</p>
              <p className="mt-1">{employee?.name || "Ikke tildelt ennå"}</p>
              {employee?.email ? <p>{employee.email}</p> : null}
              {employee?.phone ? <p>{employee.phone}</p> : null}
            </div>
          </div>
        </Card>

        {receipt ? (
          <div className="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-emerald-100">{receipt}</div>
        ) : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <main className="space-y-6">
            <Card className="bg-[#1B2A52]/75">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold"><Calendar className="h-4 w-4 text-[#3FA1FF]" />Status og plan</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {timeline.map((step) => (
                  <div key={step.label} className={`rounded-xl border p-3 ${step.done ? "border-[#3FA1FF]/40 bg-[#1D6FE0]/10" : "border-white/10 bg-white/5"}`}>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className={`h-4 w-4 ${step.done ? "text-[#3FA1FF]" : "text-slate-500"}`} />
                      <span>{step.label}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div><p className="text-xs uppercase text-slate-400">Befaring</p><p>{formatDate(quote.inspection_date)}</p></div>
                <div><p className="text-xs uppercase text-slate-400">Planlagt start</p><p>{formatDate(quote.start_date)}</p></div>
                <div><p className="text-xs uppercase text-slate-400">Frist</p><p>{formatDate(quote.due_date)}</p></div>
              </div>
            </Card>

            <Card className="bg-[#1B2A52]/75">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold"><FileText className="h-4 w-4 text-[#3FA1FF]" />Tilbudsoppsummering</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-400">Tittel</p>
                  <p className="text-lg font-semibold">{quote.title || quote.category || "Tilbud fra Hansen IT"}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Beskrivelse</p>
                  <p className="whitespace-pre-wrap text-slate-100">{quote.description || quote.message || "Tilbudet er basert på dialogen med Hansen IT."}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl bg-white/5 p-3"><p className="text-xs text-slate-400">Estimert tid</p><p className="text-lg font-semibold">{totals.hours.toFixed(1)} timer</p></div>
                  <div className="rounded-xl bg-white/5 p-3"><p className="text-xs text-slate-400">Timepris</p><p className="text-lg font-semibold">{totals.averageRate ? formatCurrency(totals.averageRate) : "Etter avtale"}</p></div>
                  <div className="rounded-xl bg-white/5 p-3"><p className="text-xs text-slate-400">Subtotal</p><p className="text-lg font-semibold">{formatCurrency(totals.subtotal)}</p></div>
                  <div className="rounded-xl bg-white/5 p-3"><p className="text-xs text-slate-400">Total inkl. mva</p><p className="text-lg font-semibold">{formatCurrency(totals.total)}</p></div>
                </div>
                <div className="overflow-x-auto rounded-xl border border-white/10">
                  <table className="w-full text-sm">
                    <thead className="bg-white/5 text-left text-slate-300">
                      <tr>
                        <th className="px-3 py-2">Tilbudslinje</th>
                        <th className="px-3 py-2">Timer/antall</th>
                        <th className="px-3 py-2">Pris</th>
                        <th className="px-3 py-2 text-right">Sum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quoteLines.length ? quoteLines.map((line) => (
                        <tr key={line.id} className="border-t border-white/10">
                          <td className="px-3 py-3">
                            <div className="font-semibold text-white">{line.title || line.description}</div>
                            {line.description && line.description !== line.title ? <div className="mt-1 text-xs text-slate-300">{line.description}</div> : null}
                            {line.included?.length ? (
                              <ul className="mt-2 space-y-1 text-xs text-slate-400">
                                {line.included.map((includedItem) => <li key={includedItem.id || includedItem.title}>- {includedItem.title}</li>)}
                              </ul>
                            ) : null}
                          </td>
                          <td className="px-3 py-2">{line.quantity} {line.unit}</td>
                          <td className="px-3 py-2">{line.unitPrice ? formatCurrency(line.unitPrice) : "Etter avtale"}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(line.total)}</td>
                        </tr>
                      )) : (
                        <tr><td colSpan={4} className="px-3 py-4 text-slate-400">Ingen tilbudslinjer er publisert ennå.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-300">
                  MVA: {formatCurrency(totals.vat)}. Endelig fakturagrunnlag avklares før eventuell fakturering.
                </div>
              </div>
            </Card>

            <Card className="bg-[#1B2A52]/75">
              <h2 className="mb-3 text-lg font-semibold">Din henvendelse</h2>
              <p className="whitespace-pre-wrap text-slate-200">{quote.message || "Ingen henvendelsestekst registrert."}</p>
            </Card>

            <Card className="bg-[#1B2A52]/75">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold"><MessageSquare className="h-4 w-4 text-[#3FA1FF]" />Meldinger</h2>
              <Textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Skriv melding eller endringsønske..." />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={postPortalMessage} disabled={sending || !message.trim()}><Send size={16} />{sending ? "Sender..." : "Send melding"}</Button>
              </div>
              <div className="mt-5 space-y-3">
                {messages.length ? messages.map((item) => (
                  <div key={item.id} className="rounded-xl border border-white/10 bg-[#152149]/70 p-3">
                    <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-400">
                      <span>{item.author_type === "customer" ? "Kunde" : item.author_name || "Hansen IT"}</span>
                      <span>{item.created_at ? new Date(item.created_at).toLocaleString("nb-NO") : ""}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-100">{item.message}</p>
                  </div>
                )) : <p className="text-sm text-slate-400">Ingen meldinger ennå.</p>}
              </div>
            </Card>
          </main>

          <aside className="space-y-6">
            <Card className="bg-[#1B2A52]/75">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold"><Paperclip className="h-4 w-4 text-[#3FA1FF]" />Dokumenter</h2>
              <div className="space-y-3">
                {documents.length ? documents.map((document) => (
                  <a
                    key={document.id}
                    href={`/api/portal/quote/${encodeURIComponent(tokenStr)}/documents/${document.id}/download`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-left hover:border-[#3FA1FF]/50"
                  >
                    <span>
                      <span className="block text-sm font-semibold">{documentLabel(document)}</span>
                      <span className="block text-xs text-slate-400">{document.filename}</span>
                    </span>
                    <Download className="h-4 w-4 text-[#3FA1FF]" />
                  </a>
                )) : <p className="text-sm text-slate-400">Dokumenter blir tilgjengelige her når de er klargjort av Hansen IT.</p>}

                {!documents.length && attachments.length ? (
                  <div className="border-t border-white/10 pt-3">
                    <p className="mb-2 text-xs uppercase text-slate-400">Vedlegg</p>
                    {attachments.map((attachment) => (
                      <button key={attachment.id} type="button" onClick={() => downloadAttachment(attachment.file_path)} className="mb-2 w-full rounded-xl border border-white/10 bg-white/5 p-3 text-left text-sm hover:border-[#3FA1FF]/50">
                        {attachment.file_name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </Card>

            <Card className="border-[#3FA1FF]/30 bg-[#1B2A52]/90">
              <h2 className="mb-2 text-lg font-semibold">Neste steg</h2>
              <p className="text-sm text-slate-200">Godkjenn tilbudet hvis alt ser riktig ut, eller skriv en melding og be om endringer.</p>
              <div className="mt-4 space-y-2">
                <Button onClick={() => portalAction("approved")} disabled={actionBusy} className="w-full"><CheckCircle2 size={16} />Godkjenn tilbud</Button>
                <Button variant="outline" onClick={() => portalAction("changes_requested")} disabled={actionBusy} className="w-full"><XCircle size={16} />Be om endringer</Button>
              </div>
            </Card>

            <Card className="bg-[#1B2A52]/75">
              <h2 className="mb-2 text-lg font-semibold">Dine opplysninger</h2>
              <div className="space-y-2 text-sm text-slate-200">
                <p><span className="text-slate-400">Navn:</span> {quote.name || "-"}</p>
                <p><span className="text-slate-400">E-post:</span> {quote.email || "-"}</p>
                <p><span className="text-slate-400">Telefon:</span> {quote.phone || "-"}</p>
                <p><span className="text-slate-400">Adresse:</span> {quote.address || "-"}</p>
              </div>
            </Card>

            <div className="text-center text-xs text-slate-400">Infrastruktur · Nettverk · Support · Cybersikkerhet</div>
          </aside>
        </div>
      </div>
    </div>
  );
}
