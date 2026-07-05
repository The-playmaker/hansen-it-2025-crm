"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Input } from "@/components/ui/Input";
import {
  ArrowLeft,
  Clock,
  User,
  Paperclip,
  Plus,
  Calendar as CalendarIcon,
  FileText,
  Link as LinkIcon,
  Download,
} from "lucide-react";
import { jsPDF } from "jspdf";
import { supabase } from "@/lib/supabaseClient";

export default function QuoteDetailsPage() {
  const { id } = useParams();
  const quoteId = String(id || "");
  const router = useRouter();

  const [me, setMe] = useState(null);

  const [quote, setQuote] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [notes, setNotes] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [documents, setDocuments] = useState([]);

  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingText, setEditingText] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [newNote, setNewNote] = useState("");
  const [hours, setHours] = useState("");
  const [rate, setRate] = useState("");
  const [timeDescription, setTimeDescription] = useState("");

  const [inspectionDate, setInspectionDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");

  const [file, setFile] = useState(null);

  const [portalUrl, setPortalUrl] = useState(null);
  const [busyPortal, setBusyPortal] = useState(false);
  const [busyPdf, setBusyPdf] = useState(false);
  const [busyUpload, setBusyUpload] = useState(false);
  const [busyInvoice, setBusyInvoice] = useState(false);
  const [pdfStatus, setPdfStatus] = useState("");
  const [invoiceMessage, setInvoiceMessage] = useState("");

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [hasNewMessage, setHasNewMessage] = useState(false);

  const assignedEmployee = useMemo(
    () => employees.find((e) => e.id === quote?.employee_id) || null,
    [employees, quote]
  );

  const totalCost = useMemo(
    () => timeEntries.reduce((sum, t) => sum + Number(t.hours || 0) * Number(t.rate || 0), 0),
    [timeEntries]
  );

  const quoteNumber = useMemo(() => `Tilbud ${String(quoteId || "").slice(0, 8).toUpperCase()}`, [quoteId]);

  // ---- load me ----
  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMe(d))
      .catch(() => setMe(null));
  }, []);

  // ---- loaders ----
  const loadEmployees = async () => {
    const res = await fetch("/api/admin/employees", { cache: "no-store" });
    const json = await res.json();
    setEmployees(json.data || []);

  };

  const loadNotes = async () => {
    const res = await fetch(`/api/admin/quotes/${quoteId}/notes`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || "Failed notes");
    setNotes(json.data || []);
  };

  const loadQuote = async () => {
    const res = await fetch(`/api/admin/quotes/${quoteId}`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || "Failed quote");
    setQuote(json.data);

    const q = json.data;
    if (q?.inspection_date) setInspectionDate(String(q.inspection_date).slice(0, 10));
    if (q?.start_date) setStartDate(String(q.start_date).slice(0, 10));
    if (q?.due_date) setDueDate(String(q.due_date).slice(0, 10));
  };

  const loadTime = async () => {
    const res = await fetch(`/api/admin/quotes/${quoteId}/time`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || "Failed time");
    setTimeEntries(json.data || []);
  };

  const loadAttachments = async () => {
    const res = await fetch(`/api/admin/quotes/${quoteId}/attachments`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || "Failed attachments");
    setAttachments(json.data || []);
    setDocuments(json.documents || []);
  };

  const loadPortalLink = async () => {
    const res = await fetch(`/api/admin/quotes/${quoteId}/portal-link`, { cache: "no-store" });
    const json = await res.json();
    if (res.ok && json.data?.token && typeof window !== "undefined") {
      setPortalUrl(`${window.location.origin}/portal/${json.data.token}`);
    }
  };

  const loadMessages = async () => {
    const res = await fetch(`/api/admin/quotes/${quoteId}/messages`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || "Failed messages");
    setMessages(json.data || []);
  };

  useEffect(() => {
    if (!quoteId) return;

    const loadAll = async () => {
      setLoading(true);
      try {
        await Promise.all([loadEmployees(), loadQuote()]);
        await Promise.all([loadNotes(), loadTime(), loadAttachments(), loadMessages(), loadPortalLink()]);
      } catch (e) {
        console.error(e);
        router.push("/admin/quotes");
      } finally {
        setLoading(false);
      }
    };

    loadAll();

    const channel = supabase
      .channel(`quotes-messages-${quoteId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "quote_messages", filter: `quote_id=eq.${quoteId}` }, (payload) => {
        setMessages((prev) => [payload.new, ...prev]);
        setHasNewMessage(true);
        new Audio("/notification.mp3").play();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteId]);

  // ---- actions (quote update) ----
  const patchQuote = async (payload) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/quotes/${quoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed");
      setQuote(json.data);
    } catch (e) {
      console.error(e);
      alert(e.message || "Kunne ikke lagre.");
    } finally {
      setSaving(false);
    }
  };

  const handleAssignChange = (employeeId) => {
    const val = employeeId ? Number(employeeId) : null;
    patchQuote({ employee_id: val });
  };

  const handleStatusChange = (status) => patchQuote({ status });

  const handleDatesSave = () =>
    patchQuote({
      inspection_date: inspectionDate ? new Date(inspectionDate).toISOString() : null,
      start_date: startDate ? new Date(startDate).toISOString() : null,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
    });

  // ---- notes ----
  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    try {
      const authorId = employees.find((x) => x.email === me?.email)?.auth_user_id ?? null;

      const res = await fetch(`/api/admin/quotes/${quoteId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: newNote.trim(), author_id: authorId }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed");

      setNotes((prev) => [json.data, ...prev]);
      setNewNote("");
    } catch (err) {
      console.error(err);
      alert(err.message || "Kunne ikke legge til notat.");
    }
  };

  const startEditNote = (n) => {
    setEditingNoteId(n.id);
    setEditingText(n.note || "");
  };

  const cancelEditNote = () => {
    setEditingNoteId(null);
    setEditingText("");
  };

  const saveEditNote = async () => {
    if (!editingNoteId) return;
    const trimmed = editingText.trim();
    if (!trimmed) return;

    try {
      const editorId = employees.find((x) => x.email === me?.email)?.auth_user_id ?? null;

      const res = await fetch(`/api/admin/quotes/${quoteId}/notes/${editingNoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: trimmed, updated_by: editorId }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed");

      setNotes((prev) => prev.map((n) => (n.id === editingNoteId ? json.data : n)));
      cancelEditNote();
    } catch (e) {
      console.error(e);
      alert(e.message || "Could not edit note");
    }
  };

  // ---- time ----
  const handleAddTime = async (e) => {
    e.preventDefault();
    if (!hours.trim()) return;

    const h = Number(hours);
    if (Number.isNaN(h) || h <= 0) return;

    const r = Number(rate);
    if (Number.isNaN(r) || r < 0) return;

    try {
      const res = await fetch(`/api/admin/quotes/${quoteId}/time`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hours: h,
          rate: r,
          description: timeDescription || null,
          employee_id: quote?.employee_id ?? null,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed");

      setTimeEntries((prev) => [json.data, ...prev]);
      setHours("");
      setRate("");
      setTimeDescription("");
    } catch (e) {
      console.error(e);
      alert(e.message || "Kunne ikke legge til timeføring.");
    }
  };

  // ---- attachments upload via API ----
  const uploadViaApi = async (fileObj, fileNameOverride) => {
    const form = new FormData();
    form.append("file", fileObj, fileNameOverride || fileObj.name);

    const res = await fetch(`/api/admin/quotes/${quoteId}/attachments`, {
      method: "POST",
      body: form,
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || "Opplasting feilet");

    setAttachments((prev) => [json.data, ...prev]);
    if (json.document) setDocuments((prev) => [json.document, ...prev]);
    return json;
  };

  const handleUpload = async () => {
    if (!file) return;
    try {
      setBusyUpload(true);
      await uploadViaApi(file);
      setFile(null);
    } catch (e) {
      console.error(e);
      alert(e.message || "Opplasting feilet");
    } finally {
      setBusyUpload(false);
    }
  };

  const downloadAttachment = async (file_path) => {
  try {
    const res = await fetch(`/api/admin/quotes/${quoteId}/sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_path }),
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || "Kunne ikke lage nedlastingslenke");

    window.open(json.url, "_blank", "noopener,noreferrer");
  } catch (e) {
    console.error(e);
    alert("Kunne ikke laste ned.");
  }
};

  const openDocument = (documentId) => {
    window.open(`/api/admin/quotes/${quoteId}/documents/${documentId}/download`, "_blank", "noopener,noreferrer");
  };

  // ---- portal link ----
const handleCreatePortalLink = async () => {
  if (!quoteId) return;
  setBusyPortal(true);
  try {
    const res = await fetch(`/api/admin/quotes/${quoteId}/portal-link`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || "Failed");

    setPortalUrl(`${window.location.origin}/portal/${json.data.token}`);
  } catch (e) {
    console.error(e);
    alert(e.message);
  } finally {
    setBusyPortal(false);
  }
};
  // ---- PDF (generate + upload) ----
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      const authorId = employees.find((x) => x.email === me?.email)?.auth_user_id ?? null;

      const res = await fetch(`/api/admin/quotes/${quoteId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: newMessage.trim(), author_id: authorId, author_type: "admin", author_name: me?.name || me?.email || "Hansen IT" }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed");

      setMessages((prev) => [json.data, ...prev]);
      setNewMessage("");
    } catch (err) {
      console.error(err);
      alert(err.message || "Could not send message");
    }
  };

  const handleGenerateOfferPdf = async () => {
    if (!quote) return;

    try {
      setBusyPdf(true);

      const doc = new jsPDF();
      const margin = 18;
      let y = 22;
      const totalHours = timeEntries.reduce((sum, t) => sum + Number(t.hours || 0), 0);
      const subtotal = totalCost || Number(quote.total_ex_vat || quote.subtotal || quote.price || 0);
      const vat = Number(quote.total_vat || Math.round(subtotal * 0.25));
      const total = Number(quote.total_inc_vat || quote.total || subtotal + vat);

      const addWrapped = (text, x = margin, width = 174, lineHeight = 5.5) => {
        const lines = doc.splitTextToSize(String(text || ""), width);
        doc.text(lines, x, y);
        y += lines.length * lineHeight;
      };
      const addLabel = (label, value) => {
        doc.setFont(undefined, "bold");
        doc.text(label, margin, y);
        doc.setFont(undefined, "normal");
        doc.text(String(value || "-"), 68, y);
        y += 7;
      };

      doc.setFillColor(21, 33, 73);
      doc.rect(0, 0, 210, 42, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont(undefined, "bold");
      doc.text("Hansen IT", margin, 18);
      doc.setFontSize(12);
      doc.setFont(undefined, "normal");
      doc.text("Infrastruktur · Nettverk · Support · Cybersikkerhet", margin, 29);

      y = 58;
      doc.setTextColor(21, 33, 73);
      doc.setFontSize(22);
      doc.setFont(undefined, "bold");
      doc.text("Tilbud fra Hansen IT", margin, y);
      y += 10;
      doc.setFontSize(11);
      doc.setFont(undefined, "normal");
      addLabel("Tilbudsnummer", quoteNumber);
      addLabel("Kunde", quote.customer_name || quote.company || quote.name || "Ristesund AS");
      addLabel("Kontakt", quote.name || "-");
      addLabel("E-post", quote.email || "-");
      addLabel("Telefon", quote.phone || "-");
      addLabel("Status", quote.status || "kladd");

      y += 4;
      doc.setFont(undefined, "bold");
      doc.setFontSize(14);
      doc.text(quote.title || quote.category || "Tilbudssammendrag", margin, y);
      y += 8;
      doc.setFont(undefined, "normal");
      doc.setFontSize(10);
      addWrapped(quote.description || quote.message || "Tilbudet er basert på henvendelse og dialog med Hansen IT.");

      y += 6;
      doc.setDrawColor(218, 226, 240);
      doc.line(margin, y, 192, y);
      y += 9;
      addLabel("Estimert tid", totalHours ? `${totalHours.toFixed(1)} timer` : "Etter avtale");
      addLabel("Subtotal eks. mva", `${subtotal.toLocaleString("nb-NO")} kr`);
      addLabel("MVA", `${vat.toLocaleString("nb-NO")} kr`);
      addLabel("Total inkl. mva", `${total.toLocaleString("nb-NO")} kr`);

      y += 6;
      doc.setFillColor(245, 248, 253);
      doc.roundedRect(margin, y, 174, 28, 3, 3, "F");
      y += 9;
      doc.setFont(undefined, "bold");
      doc.text("Neste steg", margin + 6, y);
      y += 6;
      doc.setFont(undefined, "normal");
      addWrapped("Kunden kan lese tilbudet, laste ned dokumenter, sende melding og godkjenne eller be om endringer i kundeportalen.", margin + 6, 160, 5);

      const blob = doc.output("blob");
      const fileName = `tilbud-${String(quote.id).slice(0, 8)}.pdf`;

      // Upload via API
      const pdfFile = new File([blob], fileName, { type: "application/pdf" });
      const uploaded = await uploadViaApi(pdfFile, fileName);
      if (!uploaded.document) throw new Error("PDF ble lastet opp, men ble ikke registrert som portaldokument.");
      setPdfStatus("PDF generert, lagret og synlig i portal.");
    } catch (e) {
      console.error(e);
      setPdfStatus(e.message || "PDF-generering eller lagring feilet.");
      alert(e.message || "Kunne ikke generere eller lagre PDF.");
    } finally {
      setBusyPdf(false);
    }
  };

  const handleCreateInvoiceDraft = async () => {
    try {
      setBusyInvoice(true);
      setInvoiceMessage("");
      const res = await fetch(`/api/admin/quotes/${quoteId}/invoice-draft`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Kunne ikke lage fakturautkast.");
      setInvoiceMessage(json.reused ? "Eksisterende fakturautkast funnet." : "Fakturautkast opprettet.");
      router.push(`/admin/invoices/${json.data.id}`);
    } catch (e) {
      console.error(e);
      setInvoiceMessage(e.message || "Kunne ikke lage fakturautkast.");
    } finally {
      setBusyInvoice(false);
    }
  };

  if (loading || !quote) {
    return (
      <div className="min-h-screen bg-brand-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-accent-blue border-t-transparent animate-spin" />
      </div>
    );
  }

  const visibleDocuments = documents.filter((document) => document.is_portal_visible !== false && document.visible_in_portal !== false);
  const hasQuotePdf = visibleDocuments.some((document) => document.type === "quote_pdf" || /tilbud|quote|offer/i.test(document.filename || ""));
  const hasScanPdf = visibleDocuments.some((document) => document.type === "security_report_pdf" || /scan|security|sikkerhet/i.test(document.filename || ""));
  const quoteTotal = Number(quote.total_inc_vat || quote.total || quote.total_ex_vat || totalCost || 0);
  const readiness = [
    { label: "Quote har minst én linje/timeføring", ok: timeEntries.length > 0 || quoteTotal > 0 },
    { label: "Quote total er større enn 0", ok: quoteTotal > 0 },
    { label: "Portal token finnes", ok: Boolean(portalUrl) },
    { label: "Quote PDF finnes", ok: hasQuotePdf },
    { label: "Scan PDF finnes hvis scan er koblet", ok: hasScanPdf || !quote.security_report_id },
    { label: "Dokumenter er synlige i portal", ok: visibleDocuments.length > 0 },
    { label: "Approval actions er tilgjengelig", ok: Boolean(portalUrl) },
    { label: "Meldingsskjema er tilgjengelig", ok: Boolean(portalUrl) }
  ];
  const portalReady = readiness.every((item) => item.ok);

  return (
    <div className="p-6 space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => router.push("/admin/quotes")} className="gap-2">
            <ArrowLeft size={16} /> Back
          </Button>

          <div>
            <div className="text-white text-xl font-bold">
              Quote · {quote.name || "No name"}
            </div>
            <div className="text-brand-300 text-sm">
              {quote.email || "-"} · {quote.phone || "-"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={handleGenerateOfferPdf}
            className="gap-2"
            disabled={busyPdf}
          >
            <FileText size={16} />
            {busyPdf ? "Jobber..." : "Generer PDF"}
          </Button>

          <Button onClick={handleCreatePortalLink} className="gap-2" disabled={busyPortal}>
            <LinkIcon size={16} />
            {busyPortal ? "Oppretter..." : "Lag portal-lenke"}
          </Button>

          <Button variant="outline" onClick={handleCreateInvoiceDraft} className="gap-2" disabled={busyInvoice}>
            <FileText size={16} />
            {busyInvoice ? "Lager..." : "Lag fakturautkast"}
          </Button>
        </div>
      </div>

      {portalUrl ? (
        <Card>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-white font-semibold">Kundeportal-lenke</div>
              <div className="text-brand-300 text-sm break-all">{portalUrl}</div>
            </div>
            <Button variant="outline" onClick={() => navigator.clipboard.writeText(portalUrl)}>
              Kopier
            </Button>
          </div>
        </Card>
      ) : null}

      <Card className={portalReady ? "border-emerald-500/40 bg-emerald-500/10" : "border-amber-500/40 bg-amber-500/10"}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-white font-semibold">Klar for kundeinvitasjon</div>
            <div className={portalReady ? "mt-1 text-sm text-emerald-100" : "mt-1 text-sm text-amber-100"}>
              {portalReady ? "Portalen ser klar ut for kunde." : "Portalen er ikke klar for kunde ennå."}
            </div>
          </div>
          <div className="text-sm text-white">{readiness.filter((item) => item.ok).length}/{readiness.length}</div>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {readiness.map((item) => (
            <div key={item.label} className="flex items-center gap-2 rounded-xl border border-white/10 bg-brand-950/40 px-3 py-2 text-sm">
              <span className={item.ok ? "text-emerald-300" : "text-amber-300"}>{item.ok ? "✓" : "!"}</span>
              <span className="text-brand-100">{item.label}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <div className="text-xs uppercase text-brand-400">Tilbudsstatus</div>
            <div className="mt-1 text-white font-semibold">{quote.portal_status || quote.status || "Ny"}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-brand-400">Dokumentstatus</div>
            <div className="mt-1 text-white font-semibold">
              {documents.length ? "PDF lagret og synlig i portal" : "PDF mangler eller er ikke registrert"}
            </div>
            {pdfStatus ? <div className="mt-1 text-xs text-brand-300">{pdfStatus}</div> : null}
          </div>
          <div>
            <div className="text-xs uppercase text-brand-400">Faktura</div>
            <div className="mt-1 text-white font-semibold">Utkast kan lages fra godkjent tilbud</div>
            {invoiceMessage ? <div className="mt-1 text-xs text-brand-300">{invoiceMessage}</div> : null}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-1">
                <div className="text-white font-semibold flex items-center gap-2">
                  <User size={16} /> Customer
                </div>
                <div className="text-brand-300 text-sm">{quote.customer_name || quote.name}</div>
                <div className="text-brand-300 text-sm">{quote.address || "-"}</div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <div className="space-y-1">
                  <div className="text-xs text-brand-400">Assigned</div>
                  <select
                    value={quote.employee_id ?? ""}
                    onChange={(e) => handleAssignChange(e.target.value)}
                    className="bg-brand-900 border border-brand-700 rounded-lg px-3 py-2 text-white text-sm"
                    disabled={saving}
                  >
                    <option value="">Unassigned</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-brand-400">Status</div>
                  <select
                    value={quote.status || "Ny"}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className="bg-brand-900 border border-brand-700 rounded-lg px-3 py-2 text-white text-sm"
                    disabled={saving}
                  >
                    <option value="Ny">Ny</option>
                    <option value="Pågår">Pågår</option>
                    <option value="Fullført">Fullført</option>
                    <option value="sendt">Sendt</option>
                    <option value="godkjent">Godkjent</option>
                    <option value="endringer ønsket">Endringer ønsket</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="text-xs text-brand-400 flex items-center gap-2">
                  <CalendarIcon size={14} /> Inspection
                </div>
                <Input type="date" value={inspectionDate} onChange={(e) => setInspectionDate(e.target.value)} />
              </div>

              <div className="space-y-2">
                <div className="text-xs text-brand-400 flex items-center gap-2">
                  <CalendarIcon size={14} /> Start
                </div>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>

              <div className="space-y-2">
                <div className="text-xs text-brand-400 flex items-center gap-2">
                  <CalendarIcon size={14} /> Due
                </div>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>

            <div className="mt-4">
              <Button onClick={handleDatesSave} disabled={saving} variant="outline">
                {saving ? "Saving…" : "Save dates"}
              </Button>
            </div>

            <div className="mt-6">
              <div className="text-white font-semibold mb-2">Customer message</div>
              <div className="text-brand-300 text-sm whitespace-pre-wrap">
                {quote.message || "-"}
              </div>
            </div>
          </Card>

          {/* Notes */}
          <Card>
            <div className="flex items-center justify-between">
              <div className="text-white font-semibold">Notes</div>
              <div className="text-xs text-brand-400">{notes.length}</div>
            </div>

            <form onSubmit={handleAddNote} className="mt-4 space-y-3">
              <Textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Write internal note…"
              />
              <Button type="submit" className="gap-2">
                <Plus size={16} /> Add note
              </Button>
            </form>

            <div className="mt-5 space-y-3">
              {notes.length === 0 ? (
                <div className="text-brand-400 text-sm">No notes yet.</div>
              ) : (
                notes.map((n) => (
                  <div key={n.id} className="border border-brand-800 rounded-lg p-3 bg-brand-900/30">
                    {editingNoteId === n.id ? (
                      <div className="space-y-2">
                        <Textarea value={editingText} onChange={(e) => setEditingText(e.target.value)} />
                        <div className="flex gap-2">
                          <Button type="button" onClick={saveEditNote}>Save</Button>
                          <Button type="button" variant="outline" onClick={cancelEditNote}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="text-brand-200 text-sm whitespace-pre-wrap">{n.note}</div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="text-xs text-brand-500">
                            {n.created_at ? new Date(n.created_at).toLocaleString() : ""}
                          </div>
                          <Button type="button" variant="outline" onClick={() => startEditNote(n)}>
                            Edit
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div className="text-white font-semibold">Messages</div>
              {hasNewMessage && <div className="text-xs text-white bg-red-500 px-2 py-1 rounded-full">New Message</div>}
            </div>
            <form onSubmit={handleSendMessage} className="mt-4 space-y-3">
              <Textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Write a message to the customer…"
              />
              <Button type="submit" className="gap-2">
                <Plus size={16} /> Send message
              </Button>
            </form>

            <div className="mt-5 space-y-3">
              {messages.length === 0 ? (
                <div className="text-brand-400 text-sm">No messages yet.</div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className="border border-brand-800 rounded-lg p-3 bg-brand-900/30">
                    <div className="text-brand-200 text-sm whitespace-pre-wrap">{m.message}</div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="text-xs text-brand-500">
                        {m.created_at ? new Date(m.created_at).toLocaleString() : ""}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Right */}
        <div className="space-y-6">
          <Card>
            <div className="flex items-center justify-between">
              <div className="text-white font-semibold flex items-center gap-2">
                <Clock size={16} /> Time
              </div>
              <div className="text-sm text-white">{totalCost.toFixed(2)} kr</div>
            </div>

            <form onSubmit={handleAddTime} className="mt-4 space-y-3">
              <Input value={hours} onChange={(e) => setHours(e.target.value)} placeholder="Hours (e.g. 1.5)" />
              <Input value={rate} onChange={(e) => setRate(e.target.value)} placeholder="Rate (e.g. 100)" />
              <Input value={timeDescription} onChange={(e) => setTimeDescription(e.target.value)} placeholder="Description (optional)" />
              <Button type="submit" className="gap-2">
                <Plus size={16} /> Legg til tid
              </Button>
            </form>

            <div className="mt-4 space-y-2">
              {timeEntries.length === 0 ? (
                <div className="text-brand-400 text-sm">Ingen timeføringer ennå.</div>
              ) : (
                timeEntries.map((t) => (
                  <div key={t.id} className="border border-brand-800 rounded-lg p-3 bg-brand-900/30">
                    <div className="text-white text-sm font-medium">
                      {Number(t.hours).toFixed(2)}h @ {Number(t.rate).toFixed(2)} kr/h
                    </div>
                    <div className="text-brand-300 text-xs">{t.description || "-"}</div>
                    <div className="text-brand-500 text-[11px] mt-1">
                      {t.created_at ? new Date(t.created_at).toLocaleString() : ""}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div className="text-white font-semibold flex items-center gap-2">
                <Paperclip size={16} /> Dokumenter og vedlegg
              </div>
              <div className="text-xs text-brand-400">{documents.length} dokumenter · {attachments.length} vedlegg</div>
            </div>

            <div className="mt-4 rounded-xl border border-brand-700 bg-brand-900/40 p-3 text-sm">
              <div className="text-white font-semibold">Portal-dokumentstatus</div>
              <div className="mt-1 text-brand-300">
                {documents.length ? "PDF er registrert og synlig i kundeportalen." : "Ingen PDF er registrert som portaldokument ennå."}
              </div>
            </div>

            {documents.length ? (
              <div className="mt-4 space-y-2">
                {documents.map((document) => (
                  <div key={document.id} className="rounded-lg border border-brand-800 bg-brand-900/30 p-3">
                    <div className="text-white text-sm font-medium flex items-center gap-2">
                      <FileText size={14} /> {document.filename}
                    </div>
                    <div className="text-brand-500 text-[11px] mt-1">
                      {document.type} · {document.visible_in_portal ? "Synlig i portal" : "Skjult"}
                    </div>
                    <Button
                      variant="outline"
                      className="mt-2 gap-2"
                      onClick={() => openDocument(document.id)}
                    >
                      <Download size={16} /> Åpne
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mt-4 space-y-3">
              <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <Button onClick={handleUpload} disabled={busyUpload || !file} className="gap-2">
                <Plus size={16} /> {busyUpload ? "Laster opp..." : "Last opp"}
              </Button>
            </div>

            <div className="mt-4 space-y-2">
              {attachments.length === 0 ? (
                <div className="text-brand-400 text-sm">Ingen vedlegg.</div>
              ) : (
                attachments.map((a) => (
                  <div key={a.id} className="border border-brand-800 rounded-lg p-3 bg-brand-900/30">
                    <div className="text-white text-sm font-medium flex items-center gap-2">
                      <Paperclip size={14} /> {a.file_name}
                    </div>
                    <div className="text-brand-500 text-[11px] mt-1">
                      {a.created_at ? new Date(a.created_at).toLocaleString() : ""}
                    </div>
                    <Button
                      variant="outline"
                      className="mt-2 gap-2"
                      onClick={() => downloadAttachment(a.file_path)}
                    >
                      <Download size={16} /> Åpne
                    </Button>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card>
            <div className="text-white font-semibold">Assigned employee</div>
            <div className="text-brand-300 text-sm mt-1">
              {assignedEmployee ? assignedEmployee.name : "Unassigned"}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
