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

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");

  const assignedEmployee = useMemo(
    () => employees.find((e) => e.id === quote?.employee_id) || null,
    [employees, quote]
  );

  const totalCost = useMemo(
    () => timeEntries.reduce((sum, t) => sum + Number(t.hours || 0) * Number(t.rate || 0), 0),
    [timeEntries]
  );

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
        await Promise.all([loadNotes(), loadTime(), loadAttachments(), loadMessages()]);
      } catch (e) {
        console.error(e);
        router.push("/admin/quotes");
      } finally {
        setLoading(false);
      }
    };

    loadAll();
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
      alert(e.message || "Could not save");
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
      const authorId = employees.find((x) => x.email === me?.email)?.id ?? null;

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
      alert(err.message || "Could not add note");
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
      const editorId = employees.find((x) => x.email === me?.email)?.id ?? null;

      const res = await fetch(`/api/admin/quotes/${quoteId}/notes/${editingNoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: trimmed, editor_id: editorId }),
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
      alert(e.message || "Could not add time entry");
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
    if (!res.ok) throw new Error(json?.error || "Upload failed");

    setAttachments((prev) => [json.data, ...prev]);
  };

  const handleUpload = async () => {
    if (!file) return;
    try {
      setBusyUpload(true);
      await uploadViaApi(file);
      setFile(null);
    } catch (e) {
      console.error(e);
      alert(e.message || "Upload failed");
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
    if (!res.ok) throw new Error(json?.error || "Failed to sign URL");

    window.open(json.url, "_blank", "noopener,noreferrer");
  } catch (e) {
    console.error(e);
    alert("Could not download.");
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
  // ---- PDF (generate + upload) ----
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      const authorId = employees.find((x) => x.email === me?.email)?.id ?? null;

      const res = await fetch(`/api/admin/quotes/${quoteId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: newMessage.trim(), author_id: authorId }),
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
      doc.setFontSize(16);
      doc.text("Offer / Project Summary", 20, 20);

      doc.setFontSize(11);
      let y = 30;

      const addLine = (t) => {
        doc.text(String(t), 20, y);
        y += 6;
      };

      addLine(`Project ID: ${quote.id}`);
      addLine(`Customer: ${quote.name || ""}`);
      if (quote.email) addLine(`Email: ${quote.email}`);
      if (quote.phone) addLine(`Phone: ${quote.phone}`);
      if (quote.address) addLine(`Address: ${quote.address}`);

      y += 4;
      addLine(`Status: ${quote.status || "Ny"}`);
      const totalHours = timeEntries.reduce((sum, t) => sum + Number(t.hours || 0), 0);
      addLine(`Logged hours: ${totalHours.toFixed(2)}h`);

      y += 4;
      addLine("---");
      addLine("Customer message:");
      const msg = quote.message || "";
      const split = doc.splitTextToSize(msg, 170);
      doc.text(split, 20, y);

      const blob = doc.output("blob");
      const fileName = `offer_quote_${quote.id}.pdf`;

      // Upload via API
      const pdfFile = new File([blob], fileName, { type: "application/pdf" });
      await uploadViaApi(pdfFile, fileName);
    } catch (e) {
      console.error(e);
      alert(e.message || "Could not generate/upload PDF");
    } finally {
      setBusyPdf(false);
    }
  };

  if (loading || !quote) {
    return (
      <div className="min-h-screen bg-brand-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-accent-blue border-t-transparent animate-spin" />
      </div>
    );
  }

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
            {busyPdf ? "Working…" : "Generate PDF"}
          </Button>

          <Button onClick={handleCreatePortalLink} className="gap-2" disabled={busyPortal}>
            <LinkIcon size={16} />
            {busyPortal ? "Creating…" : "Create portal link"}
          </Button>
        </div>
      </div>

      {portalUrl ? (
        <Card>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-white font-semibold">Customer portal link</div>
              <div className="text-brand-300 text-sm break-all">{portalUrl}</div>
            </div>
            <Button variant="outline" onClick={() => navigator.clipboard.writeText(portalUrl)}>
              Copy
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-1">
                <div className="text-white font-semibold flex items-center gap-2">
                  <User size={16} /> Customer
                </div>
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
                <Plus size={16} /> Add time
              </Button>
            </form>

            <div className="mt-4 space-y-2">
              {timeEntries.length === 0 ? (
                <div className="text-brand-400 text-sm">No time entries.</div>
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
                <Paperclip size={16} /> Attachments
              </div>
              <div className="text-xs text-brand-400">{attachments.length}</div>
            </div>

            <div className="mt-4 space-y-3">
              <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <Button onClick={handleUpload} disabled={busyUpload || !file} className="gap-2">
                <Plus size={16} /> {busyUpload ? "Uploading…" : "Upload"}
              </Button>
            </div>

            <div className="mt-4 space-y-2">
              {attachments.length === 0 ? (
                <div className="text-brand-400 text-sm">No attachments.</div>
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
                      <Download size={16} /> Open
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

          <Card>
            <div className="text-white font-semibold">Messages</div>
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
      </div>
    </div>
  );
}
