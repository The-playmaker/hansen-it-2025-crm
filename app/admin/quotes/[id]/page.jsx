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
  Package as PackageIcon,
  Trash2,
} from "lucide-react";
import { jsPDF } from "jspdf";

function formatCurrency(value) {
  return new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function lineTotalExVat(item) {
  const explicit = Number(item.line_total_ex_vat || 0);
  if (explicit > 0) return explicit;
  return Number(item.quantity || 0) * Number(item.unit_price || 0);
}

function packageEstimate(pkg = {}) {
  const min = Number(pkg.hourly_estimate_min || 0);
  const max = Number(pkg.hourly_estimate_max || 0);
  if (min && max) return `${min}-${max} timer`;
  if (min) return `fra ${min} timer`;
  return "Etter avtale";
}

const documentTypeLabels = {
  quote_pdf: "Tilbud PDF",
  scan_combined_pdf: "Samlet sikkerhetsrapport",
  scan_domain_pdf: "Teknisk rapport",
  attachment: "Vedlegg"
};

function documentLabel(document = {}) {
  return document.display_name || document.title || document.filename || documentTypeLabels[document.type] || "Uten navn";
}

function documentTypeLabel(type) {
  return documentTypeLabels[type] || "Vedlegg";
}

function isDocumentVisible(document = {}) {
  return (document.is_portal_visible ?? document.visible_in_portal) === true;
}

const QUOTE_STATUS_SELECT_OPTIONS = [
  { value: "kladd", label: "Kladd" },
  { value: "Ny", label: "Ny" },
  { value: "pågår", label: "Pågår" },
  { value: "Pågår", label: "Pågår" },
  { value: "sendt", label: "Sendt" },
  { value: "godkjent", label: "Godkjent" },
  { value: "avslått", label: "Avslått" },
  { value: "avslatt", label: "Avslått" },
  { value: "Fullført", label: "Fullført" },
  { value: "endringer ønsket", label: "Endringer ønsket" },
  { value: "endringer onsket", label: "Endringer ønsket" },
];

function quoteStatusLabel(status) {
  if (!status) return "Ny";
  const portalLabels = {
    approved: "Godkjent",
    changes_requested: "Endringer ønsket",
    declined: "Avslått",
  };
  if (portalLabels[status]) return portalLabels[status];
  const match = QUOTE_STATUS_SELECT_OPTIONS.find((opt) => opt.value === status);
  if (match) return match.label;
  const lower = String(status).toLowerCase();
  const lowerMatch = QUOTE_STATUS_SELECT_OPTIONS.find((opt) => opt.value.toLowerCase() === lower);
  if (lowerMatch) return lowerMatch.label;
  return status;
}

function quoteStatusSelectOptions(currentStatus) {
  const options = [...QUOTE_STATUS_SELECT_OPTIONS];
  if (currentStatus && !options.some((opt) => opt.value === currentStatus)) {
    options.unshift({ value: currentStatus, label: quoteStatusLabel(currentStatus) });
  }
  return options;
}

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
  const [quoteItems, setQuoteItems] = useState([]);
  const [servicePackages, setServicePackages] = useState([]);

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
  const [busyPackage, setBusyPackage] = useState(false);
  const [busyPreparePortal, setBusyPreparePortal] = useState(false);
  const [prepareChecks, setPrepareChecks] = useState(null);
  const [pdfStatus, setPdfStatus] = useState("");
  const [invoiceMessage, setInvoiceMessage] = useState("");
  const [selectedPackageId, setSelectedPackageId] = useState("");

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

  const quoteItemsSubtotal = useMemo(
    () => quoteItems.reduce((sum, item) => sum + lineTotalExVat(item), 0),
    [quoteItems]
  );

  const overallSubtotal = useMemo(
    () => quoteItemsSubtotal + totalCost,
    [quoteItemsSubtotal, totalCost]
  );

  const documentStoragePaths = useMemo(
    () => new Set(documents.map((document) => document.storage_path).filter(Boolean)),
    [documents]
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

  const loadQuoteItems = async () => {
    const res = await fetch(`/api/admin/quotes/${quoteId}/items`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) {
      console.warn(json?.error || "Quote items not configured");
      setQuoteItems([]);
      return;
    }
    setQuoteItems(json.data || []);
  };

  const loadServicePackages = async () => {
    const res = await fetch("/api/admin/service-packages", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) {
      console.warn(json?.error || "Service packages not configured");
      setServicePackages([]);
      return;
    }
    setServicePackages((json.data || []).filter((pkg) => pkg.is_active !== false));
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
        await Promise.all([loadNotes(), loadTime(), loadAttachments(), loadMessages(), loadPortalLink(), loadQuoteItems(), loadServicePackages()]);
      } catch (e) {
        console.error(e);
        router.push("/admin/quotes");
      } finally {
        setLoading(false);
      }
    };

    loadAll();

    // Poll for new messages (cookie-auth via /api/admin — no browser Supabase client)
    let cancelled = false;
    let knownCount = null;
    const pollMessages = async () => {
      try {
        const res = await fetch(`/api/admin/quotes/${quoteId}/messages`, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || cancelled) return;
        const next = json.data || [];
        if (knownCount !== null && next.length > knownCount) {
          setHasNewMessage(true);
          try {
            new Audio("/notification.mp3").play();
          } catch {
            /* ignore autoplay errors */
          }
        }
        knownCount = next.length;
        setMessages(next);
      } catch (e) {
        console.error(e);
      }
    };
    const intervalId = setInterval(pollMessages, 5000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
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
      alert(e.message || "Kunne ikke redigere notat.");
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

  const openDocument = async (documentId) => {
    try {
      const res = await fetch(`/api/admin/quotes/${quoteId}/documents/${documentId}/download?json=1`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Kunne ikke åpne dokumentet.");
      window.open(json.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error(error);
      alert(error.message || "Kunne ikke åpne dokumentet. Sjekk at PDF-en er lagret i Supabase Storage.");
    }
  };

  const testPortalDocumentDownload = async (document) => {
    const token = portalUrl?.split("/").filter(Boolean).pop();
    if (!token) {
      alert("Portal-token finnes ikke. Lag portal-lenke for tilbudet først.");
      return;
    }

    try {
      const res = await fetch(`/api/portal/quote/${encodeURIComponent(token)}/documents/${document.id}/download?json=1`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert([
          "Portal-nedlasting feilet.",
          `Token finnes: ja`,
          `Dokument-ID: ${document.id}`,
          `Tilbuds-ID: ${document.quote_id || quoteId}`,
          `Lagringsobjekt: ${document.storage_path ? "registrert" : "mangler storage_path"}`,
          `Feil: ${json?.error || res.statusText}`,
        ].join("\n"));
        return;
      }
      window.open(json.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error(error);
      alert([
        "Portal-nedlastingstest feilet.",
        `Token finnes: ja`,
        `Dokument-ID: ${document.id}`,
        `Tilbuds-ID: ${document.quote_id || quoteId}`,
        `Lagringsobjekt: ${document.storage_path ? "registrert" : "mangler storage_path"}`,
      ].join("\n"));
    }
  };

  const handleAddPackage = async () => {
    if (!selectedPackageId) return;
    try {
      setBusyPackage(true);
      const res = await fetch(`/api/admin/quotes/${quoteId}/add-service-package`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service_package_id: selectedPackageId, source: "quote_admin" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Kunne ikke legge pakken til tilbudet.");
      setQuoteItems((prev) => [...prev, json.data]);
      setSelectedPackageId("");
    } catch (error) {
      console.error(error);
      alert(error.message || "Kunne ikke legge pakken til tilbudet.");
    } finally {
      setBusyPackage(false);
    }
  };

  const handleDeleteQuoteItem = async (itemId) => {
    try {
      const res = await fetch(`/api/admin/quotes/${quoteId}/items/${itemId}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Kunne ikke slette tilbudslinjen.");
      setQuoteItems((prev) => prev.filter((item) => item.id !== itemId));
    } catch (error) {
      console.error(error);
      alert(error.message || "Kunne ikke slette tilbudslinjen.");
    }
  };

  const handleToggleDocumentVisibility = async (documentId, visible) => {
    try {
      const res = await fetch(`/api/admin/quotes/${quoteId}/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_portal_visible: visible }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Kunne ikke oppdatere dokumentet.");
      setDocuments((prev) => prev.map((document) => (
        document.id === documentId
          ? { ...document, ...json.data, is_portal_visible: visible }
          : document
      )));
    } catch (error) {
      console.error(error);
      alert(error.message || "Kunne ikke oppdatere dokumentet.");
    }
  };

  const handleRenameDocument = async (document) => {
    const nextName = window.prompt("Nytt visningsnavn", document.display_name || document.title || document.filename || "");
    if (nextName === null) return;

    try {
      const res = await fetch(`/api/admin/quotes/${quoteId}/documents/${document.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: nextName }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Kunne ikke navngi dokumentet.");
      setDocuments((prev) => prev.map((item) => item.id === document.id ? json.data : item));
    } catch (error) {
      console.error(error);
      alert(error.message || "Kunne ikke navngi dokumentet.");
    }
  };

  const handleChangeDocumentType = async (document, type) => {
    try {
      const res = await fetch(`/api/admin/quotes/${quoteId}/documents/${document.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Kunne ikke endre dokumenttype.");
      setDocuments((prev) => prev.map((item) => item.id === document.id ? json.data : item));
    } catch (error) {
      console.error(error);
      alert(error.message || "Kunne ikke endre dokumenttype.");
    }
  };

  const handleDeleteDocumentLink = async (document) => {
    if (!window.confirm(`Slette dokumentkoblingen "${documentLabel(document)}"? Dokumentet fjernes fra portalen.`)) return;
    const deleteStorageFile = window.confirm("Vil du også slette selve PDF-filen fra Supabase Storage? Velg Avbryt for å bare slette koblingen.");

    try {
      const res = await fetch(`/api/admin/quotes/${quoteId}/documents/${document.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteStorageFile }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Kunne ikke slette dokumentkoblingen.");
      setDocuments((prev) => prev.filter((item) => item.id !== document.id));
    } catch (error) {
      console.error(error);
      alert(error.message || "Kunne ikke slette dokumentkoblingen.");
    }
  };

  const handleLinkAttachmentToPortal = async (attachmentId, visible = false) => {
    try {
      const res = await fetch(`/api/admin/quotes/${quoteId}/attachments/${attachmentId}/portal-document`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_portal_visible: visible }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Kunne ikke koble vedlegget til portalen.");
      if (json.portalToken?.token && typeof window !== "undefined") {
        setPortalUrl(`${window.location.origin}/portal/${json.portalToken.token}`);
      }
      setDocuments((prev) => {
        const exists = prev.some((document) => document.id === json.data.id);
        return exists ? prev.map((document) => (document.id === json.data.id ? json.data : document)) : [json.data, ...prev];
      });
    } catch (error) {
      console.error(error);
      alert(error.message || "Kunne ikke koble vedlegget til portalen.");
    }
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

  const handlePreparePortal = async () => {
    if (!quoteId) return;
    setBusyPreparePortal(true);
    try {
      const res = await fetch(`/api/admin/quotes/${quoteId}/prepare-portal`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Kunne ikke klargjøre kundeportalen.");
      setPrepareChecks(json.checks || []);
      if (json.portalUrl) setPortalUrl(json.portalUrl);
      await Promise.all([loadQuote(), loadAttachments(), loadQuoteItems(), loadPortalLink()]);
    } catch (error) {
      console.error(error);
      alert(error.message || "Kunne ikke klargjøre kundeportalen.");
    } finally {
      setBusyPreparePortal(false);
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
      alert(err.message || "Kunne ikke sende melding.");
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
      const subtotal = overallSubtotal || Number(quote.total_ex_vat || quote.subtotal || quote.price || 0);
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

      if (quoteItems.length) {
        y += 6;
        doc.setFont(undefined, "bold");
        doc.setFontSize(14);
        doc.text("Produktpakker og tilbudslinjer", margin, y);
        y += 8;
        doc.setFont(undefined, "normal");
        doc.setFontSize(10);

        quoteItems.forEach((item, index) => {
          if (y > 246) {
            doc.addPage();
            y = 22;
          }
          const pkg = item.service_package || {};
          const title = item.title || pkg.name || item.description || `Tilbudslinje ${index + 1}`;
          const amount = lineTotalExVat(item);
          doc.setFillColor(245, 248, 253);
          doc.roundedRect(margin, y, 174, 24, 3, 3, "F");
          y += 7;
          doc.setFont(undefined, "bold");
          doc.text(title, margin + 5, y);
          doc.text(`${amount.toLocaleString("nb-NO")} kr eks. mva`, 142, y);
          y += 5;
          doc.setFont(undefined, "normal");
          addWrapped(item.description || pkg.short_description || "Produktpakke fra Hansen IT", margin + 5, 155, 4.8);
          const included = Array.isArray(pkg.service_package_items) ? pkg.service_package_items.slice(0, 4) : [];
          if (included.length) addWrapped(`Inkludert: ${included.map((includedItem) => includedItem.title).join(", ")}`, margin + 5, 155, 4.8);
          y += 4;
        });

        if (quote.security_report_id || quote.scan_report_id) {
          addWrapped("Basert pÃ¥ Phoenix Security Assessment og anbefalte tiltak fra sikkerhetsrapporten.", margin, 174, 5);
        }
      }

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
      setPdfStatus("PDF generert og lagret. Gjør dokumentet synlig i portal når det er klart for kunde.");
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

  const visibleDocuments = documents.filter((document) => (document.is_portal_visible ?? document.visible_in_portal) !== false);
  const hasQuotePdf = visibleDocuments.some((document) => document.type === "quote_pdf" || /tilbud|quote|offer/i.test(document.filename || ""));
  const hasScanPdf = visibleDocuments.some((document) => document.type === "security_report_pdf" || /scan|security|sikkerhet/i.test(document.filename || ""));
  const quoteTotal = Number(quote.total_inc_vat || quote.total || quote.total_ex_vat || overallSubtotal || 0);
  const localReadiness = [
    { label: "Tilbudet har minst én linje eller timeføring", ok: timeEntries.length > 0 || quoteTotal > 0 },
    { label: "Tilbudssum er større enn 0", ok: quoteTotal > 0 },
    { label: "Portal-token finnes", ok: Boolean(portalUrl) },
    { label: "Tilbud-PDF finnes", ok: hasQuotePdf },
    { label: "Skann-PDF finnes hvis skann er koblet", ok: hasScanPdf || !(quote.security_report_id || quote.scan_report_id) },
    { label: "Dokumenter er synlige i portal", ok: visibleDocuments.length > 0 },
    { label: "Godkjenningshandlinger er tilgjengelige", ok: Boolean(portalUrl) },
    { label: "Meldingsskjema er tilgjengelig", ok: Boolean(portalUrl) }
  ];
  const readiness = Array.isArray(prepareChecks) && prepareChecks.length
    ? prepareChecks.map((item) => ({ label: item.label || item.key, ok: Boolean(item.ok), details: item.details || "" }))
    : localReadiness;
  const portalReady = readiness.every((item) => item.ok);
  const quoteApproved = ["approved", "godkjent"].includes(String(quote.portal_status || quote.status || "").toLowerCase());

  return (
    <div className="p-6 space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => router.push("/admin/quotes")} className="gap-2">
            <ArrowLeft size={16} /> Tilbake
          </Button>

          <div>
            <div className="text-white text-xl font-bold">
              Tilbud · {quote.display_name || quote.title || quote.customer_name || quote.company || quote.name || "Uten navn"}
            </div>
            <div className="text-brand-300 text-sm">
              {quote.email || "-"} · {quote.phone || "-"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={handlePreparePortal}
            className="gap-2"
            disabled={busyPreparePortal}
          >
            <LinkIcon size={16} />
            {busyPreparePortal ? "Klargjør..." : "Klargjør kundeportal"}
          </Button>

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

          <Button variant="outline" onClick={handleCreateInvoiceDraft} className="gap-2" disabled={busyInvoice || !quoteApproved}>
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
              <span className="text-brand-100">
                {item.label}
                {item.details ? <span className="ml-1 text-brand-400">- {item.details}</span> : null}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <div className="text-xs uppercase text-brand-400">Tilbudsstatus</div>
            <div className="mt-1 text-white font-semibold">{quoteStatusLabel(quote.portal_status || quote.status)}</div>
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
            <div className="mt-1 text-white font-semibold">{quoteApproved ? "Klar for fakturautkast" : "Fakturautkast kan lages når tilbudet er godkjent."}</div>
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
                  <User size={16} /> Kunde
                </div>
                <div className="text-brand-300 text-sm">{quote.customer_name || quote.name}</div>
                <div className="text-brand-300 text-sm">{quote.address || "-"}</div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <div className="space-y-1">
                  <div className="text-xs text-brand-400">Tildelt</div>
                  <select
                    value={quote.employee_id ?? ""}
                    onChange={(e) => handleAssignChange(e.target.value)}
                    className="bg-brand-900 border border-brand-700 rounded-lg px-3 py-2 text-white text-sm"
                    disabled={saving}
                  >
                    <option value="">Ikke tildelt</option>
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
                    value={quote.status || "kladd"}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className="bg-brand-900 border border-brand-700 rounded-lg px-3 py-2 text-white text-sm"
                    disabled={saving}
                  >
                    {quoteStatusSelectOptions(quote.status).map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="text-xs text-brand-400 flex items-center gap-2">
                  <CalendarIcon size={14} /> Befaring
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
                  <CalendarIcon size={14} /> Frist
                </div>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>

            <div className="mt-4">
              <Button onClick={handleDatesSave} disabled={saving} variant="outline">
                {saving ? "Lagrer..." : "Lagre datoer"}
              </Button>
            </div>

            <div className="mt-6">
              <div className="text-white font-semibold mb-2">Melding fra kunde</div>
              <div className="text-brand-300 text-sm whitespace-pre-wrap">
                {quote.message || "-"}
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-white font-semibold flex items-center gap-2">
                  <PackageIcon size={16} /> Produktpakker og tilbudslinjer
                </div>
                <div className="text-brand-400 text-sm">Pakker blir synlige i tilbud, PDF og kundeportal.</div>
              </div>
              <div className="text-sm text-white">{formatCurrency(quoteItemsSubtotal)} eks. mva</div>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <select
                value={selectedPackageId}
                onChange={(event) => setSelectedPackageId(event.target.value)}
                className="min-h-10 flex-1 rounded-lg border border-brand-700 bg-brand-900 px-3 py-2 text-sm text-white"
              >
                <option value="">Velg aktiv produktpakke</option>
                {servicePackages.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>
                    {pkg.name} · fra {formatCurrency(pkg.fixed_price || pkg.price_from)}
                  </option>
                ))}
              </select>
              <Button type="button" onClick={handleAddPackage} disabled={busyPackage || !selectedPackageId} className="gap-2">
                <Plus size={16} /> {busyPackage ? "Legger til..." : "Legg til pakke"}
              </Button>
            </div>

            <div className="mt-5 space-y-3">
              {quoteItems.length ? quoteItems.map((item) => {
                const pkg = item.service_package || {};
                const included = Array.isArray(pkg.service_package_items)
                  ? pkg.service_package_items.slice(0, 5)
                  : Array.isArray(item.metadata?.included_items)
                    ? item.metadata.included_items.slice(0, 5)
                    : [];
                return (
                  <div key={item.id} className="rounded-xl border border-brand-800 bg-brand-900/30 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-white font-semibold">{item.title || pkg.name || item.description}</span>
                          {item.item_type === "package" || item.service_package_id ? (
                            <span className="rounded-full border border-accent-blue/40 bg-accent-blue/10 px-2 py-0.5 text-xs text-sky-100">Pakke</span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm text-brand-300">{item.description || pkg.short_description || "Tilbudslinje"}</p>
                        {included.length ? (
                          <div className="mt-3 rounded-lg border border-brand-800 bg-brand-950/40 p-3">
                            <div className="mb-1 text-xs uppercase text-brand-400">Hva er inkludert</div>
                            <ul className="space-y-1 text-sm text-brand-200">
                              {included.map((includedItem) => <li key={includedItem.id || includedItem.title}>- {includedItem.title}</li>)}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                      <div className="text-right">
                        <div className="text-white font-semibold">{formatCurrency(lineTotalExVat(item))}</div>
                        <div className="text-xs text-brand-400">{Number(item.quantity || 1)} {item.unit || "stk"} · {packageEstimate(pkg)}</div>
                        <Button type="button" variant="outline" className="mt-3 gap-2" onClick={() => handleDeleteQuoteItem(item.id)}>
                          <Trash2 size={14} /> Fjern
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              }) : (
                <div className="rounded-xl border border-dashed border-brand-700 p-4 text-sm text-brand-400">
                  Ingen produktpakker eller tilbudslinjer er lagt til ennå.
                </div>
              )}
            </div>
          </Card>

          {/* Notes */}
          <Card>
            <div className="flex items-center justify-between">
              <div className="text-white font-semibold">Notater</div>
              <div className="text-xs text-brand-400">{notes.length}</div>
            </div>

            <form onSubmit={handleAddNote} className="mt-4 space-y-3">
              <Textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Skriv internt notat…"
              />
              <Button type="submit" className="gap-2">
                <Plus size={16} /> Legg til notat
              </Button>
            </form>

            <div className="mt-5 space-y-3">
              {notes.length === 0 ? (
                <div className="text-brand-400 text-sm">Ingen notater ennå.</div>
              ) : (
                notes.map((n) => (
                  <div key={n.id} className="border border-brand-800 rounded-lg p-3 bg-brand-900/30">
                    {editingNoteId === n.id ? (
                      <div className="space-y-2">
                        <Textarea value={editingText} onChange={(e) => setEditingText(e.target.value)} />
                        <div className="flex gap-2">
                          <Button type="button" onClick={saveEditNote}>Lagre</Button>
                          <Button type="button" variant="outline" onClick={cancelEditNote}>Avbryt</Button>
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
                            Rediger
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
              <div className="text-white font-semibold">Meldinger</div>
              {hasNewMessage && <div className="text-xs text-white bg-red-500 px-2 py-1 rounded-full">Ny melding</div>}
            </div>
            <form onSubmit={handleSendMessage} className="mt-4 space-y-3">
              <Textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Skriv en melding til kunden…"
              />
              <Button type="submit" className="gap-2">
                <Plus size={16} /> Send melding
              </Button>
            </form>

            <div className="mt-5 space-y-3">
              {messages.length === 0 ? (
                <div className="text-brand-400 text-sm">Ingen meldinger ennå.</div>
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
                <Clock size={16} /> Timeføring
              </div>
              <div className="text-sm text-white">{totalCost.toFixed(2)} kr</div>
            </div>

            <form onSubmit={handleAddTime} className="mt-4 space-y-3">
              <Input value={hours} onChange={(e) => setHours(e.target.value)} placeholder="Timer (f.eks. 1,5)" />
              <Input value={rate} onChange={(e) => setRate(e.target.value)} placeholder="Timepris (f.eks. 1050)" />
              <Input value={timeDescription} onChange={(e) => setTimeDescription(e.target.value)} placeholder="Beskrivelse (valgfritt)" />
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
                <Paperclip size={16} /> Dokumenter
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
                      <FileText size={14} /> {documentLabel(document)}
                    </div>
                    <div className="text-brand-500 text-[11px] mt-1">
                      {documentTypeLabel(document.type)} · {(document.is_portal_visible ?? document.visible_in_portal) ? "Synlig i portal" : "Skjult"}
                    </div>
                    <Button
                      variant="outline"
                      className="mt-2 gap-2"
                      onClick={() => openDocument(document.id)}
                    >
                      <Download size={16} /> Åpne
                    </Button>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleRenameDocument(document)}>Navngi</Button>
                      <Button variant="outline" size="sm" onClick={() => handleToggleDocumentVisibility(document.id, !isDocumentVisible(document))}>
                        {isDocumentVisible(document) ? "Fjern fra portal" : "Gjør synlig"}
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => handleDeleteDocumentLink(document)}>Slett kobling</Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {documents.length ? (
              <div className="mt-4 rounded-xl border border-brand-700 bg-brand-950/40 p-3">
                <div className="text-white font-semibold">Dokumentkontroll</div>
                <div className="mt-3 space-y-2">
                  {documents.map((document) => (
                    <div key={`control-${document.id}`} className="rounded-lg border border-brand-800 bg-brand-900/40 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-white">{documentLabel(document)}</div>
                          <div className="mt-1 text-xs text-brand-400">{documentTypeLabel(document.type)} · {document.storage_path ? "lagring OK" : document.external_url ? "ekstern URL" : "mangler fil/URL"}</div>
                          <div className="mt-1 text-xs text-brand-400">{(document.is_portal_visible ?? document.visible_in_portal) !== false ? "Synlig i portal" : "Skjult i portal"}</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <select value={document.type || "attachment"} onChange={(event) => handleChangeDocumentType(document, event.target.value)} className="rounded-lg border border-brand-700 bg-brand-950 px-2 py-1 text-xs text-white">
                            {Object.entries(documentTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                          <Button variant="outline" className="gap-2" onClick={() => handleRenameDocument(document)}>
                            Navngi
                          </Button>
                          <Button variant="outline" className="gap-2" onClick={() => openDocument(document.id)}>
                            Test nedlasting
                          </Button>
                          <Button variant="outline" className="gap-2" onClick={() => testPortalDocumentDownload(document)}>
                            Test portal-nedlasting
                          </Button>
                          <Button
                            variant="outline"
                            className="gap-2"
                            onClick={() => handleToggleDocumentVisibility(document.id, !isDocumentVisible(document))}
                          >
                            {(document.is_portal_visible ?? document.visible_in_portal) !== false ? "Skjul i portal" : "Gjør synlig i portal"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  id="quote-attachment-file"
                  type="file"
                  className="sr-only"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <label
                  htmlFor="quote-attachment-file"
                  className="inline-flex cursor-pointer items-center rounded-lg border border-brand-700 bg-brand-900 px-3 py-2 text-sm text-white hover:bg-brand-800"
                >
                  Velg fil
                </label>
                <span className="text-sm text-brand-300">{file ? file.name : "Ingen fil valgt"}</span>
              </div>
              <Button onClick={handleUpload} disabled={busyUpload || !file} className="gap-2">
                <Plus size={16} /> {busyUpload ? "Laster opp..." : "Last opp"}
              </Button>
            </div>

            {attachments.some((attachment) => !documentStoragePaths.has(attachment.file_path)) ? (
              <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                <div className="font-semibold">Vedlegg mangler portal-kobling</div>
                <div className="mt-1">Disse ligger i gammel vedleggstabell. Koble dem til portaldokumenter for kundeportalen.</div>
                <div className="mt-3 space-y-2">
                  {attachments.filter((attachment) => !documentStoragePaths.has(attachment.file_path)).map((attachment) => (
                    <div key={`legacy-${attachment.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-400/20 bg-brand-950/40 p-2">
                      <span>{attachment.file_name}</span>
                      <Button variant="outline" className="gap-2" onClick={() => handleLinkAttachmentToPortal(attachment.id, true)}>
                        Koble til portal
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

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
                    {documentStoragePaths.has(a.file_path) ? (
                      <div className="mt-2 inline-flex rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-100">
                        Allerede koblet til portal
                      </div>
                    ) : null}
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
            <div className="text-white font-semibold">Ansvarlig</div>
            <div className="text-brand-300 text-sm mt-1">
              {assignedEmployee ? assignedEmployee.name : "Ikke tildelt"}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
