"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
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
} from "lucide-react";
import { jsPDF } from "jspdf";

export default function QuoteDetails() {
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

  // Notat
  const [newNote, setNewNote] = useState("");

  // Time-entry
  const [hours, setHours] = useState("");
  const [timeDescription, setTimeDescription] = useState("");

  // Datoer
  const [inspectionDate, setInspectionDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");

  // Vedlegg
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Portal-link
  const [portalUrl, setPortalUrl] = useState(null);
  const [creatingPortal, setCreatingPortal] = useState(false);

  // PDF
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // --- helpers ---
  const assignedEmployee = useMemo(
    () => employees.find((e) => e.id === quote?.employee_id) || null,
    [employees, quote]
  );

  const totalHours = useMemo(
    () => timeEntries.reduce((sum, t) => sum + Number(t.hours || 0), 0),
    [timeEntries]
  );

  const canManageNotes = true; // du kan senere bytte til permission-check via me.permissions

  // --- auth/me (Casdoor cookie) ---
  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMe(d))
      .catch(() => setMe(null));
  }, []);

  // --- load quote + related ---
  useEffect(() => {
    if (!quoteId) return;

    const load = async () => {
      try {
        setLoading(true);

        const { data: quoteData, error: quoteError } = await supabase
          .from("requests")
          .select("*")
          .eq("id", quoteId)
          .maybeSingle();

        if (quoteError || !quoteData) {
          router.push("/admin/dashboard");
          return;
        }

        setQuote(quoteData);

        if (quoteData.inspection_date) setInspectionDate(String(quoteData.inspection_date).slice(0, 10));
        if (quoteData.start_date) setStartDate(String(quoteData.start_date).slice(0, 10));
        if (quoteData.due_date) setDueDate(String(quoteData.due_date).slice(0, 10));

        const { data: empData } = await supabase
          .from("employees")
          .select("*")
          .eq("active", true)
          .order("name", { ascending: true });

        setEmployees(empData || []);

        const { data: notesData } = await supabase
          .from("quote_notes")
          .select("*")
          .eq("quote_id", quoteId)
          .order("created_at", { ascending: false });

        setNotes(notesData || []);

        const { data: timeData } = await supabase
          .from("quote_time_entries")
          .select("*")
          .eq("quote_id", quoteId)
          .order("created_at", { ascending: false });

        setTimeEntries(timeData || []);

        const { data: attachData } = await supabase
          .from("quote_attachments")
          .select("*")
          .eq("quote_id", quoteId)
          .order("created_at", { ascending: false });

        setAttachments(attachData || []);
      } catch (err) {
        console.error("Error loading quote details:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [quoteId, router]);

  // --- actions ---
  const handleAssignChange = async (employeeId) => {
    if (!quoteId) return;
    setSaving(true);
    try {
      const value = employeeId ? Number(employeeId) : null;

      const { error } = await supabase
        .from("requests")
        .update({ employee_id: value })
        .eq("id", quoteId);

      if (error) throw error;
      setQuote((prev) => (prev ? { ...prev, employee_id: value } : prev));
    } catch (err) {
      console.error("Error assigning employee:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (status) => {
    if (!quoteId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("requests").update({ status }).eq("id", quoteId);
      if (error) throw error;
      setQuote((prev) => (prev ? { ...prev, status } : prev));
    } catch (err) {
      console.error("Error updating status:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDatesSave = async () => {
    if (!quoteId) return;
    setSaving(true);
    try {
      const payload = {
        inspection_date: inspectionDate ? new Date(inspectionDate).toISOString() : null,
        start_date: startDate ? new Date(startDate).toISOString() : null,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
      };

      const { error } = await supabase.from("requests").update(payload).eq("id", quoteId);
      if (error) throw error;

      setQuote((prev) => (prev ? { ...prev, ...payload } : prev));
    } catch (err) {
      console.error("Error saving dates:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!quoteId || !me || !newNote.trim()) return;

    try {
      // author_id forventer trolig employee_id (bigint). Hvis du bruker casdoorUser id (uuid),
      // bør du mappe me.email -> employee.id. Vi gjør det enkelt:
      const authorId = employees.find((x) => x.email === me.email)?.id || null;

      const { data, error } = await supabase
        .from("quote_notes")
        .insert({
          quote_id: quoteId,
          author_id: authorId,
          note: newNote.trim(),
        })
        .select("*")
        .single();

      if (error) throw error;

      setNotes((prev) => [data, ...prev]);
      setNewNote("");
    } catch (err) {
      console.error("Error adding note:", err);
    }
  };

  const startEditNote = (note) => {
    setEditingNoteId(note.id);
    setEditingText(note.note || "");
  };

  const cancelEditNote = () => {
    setEditingNoteId(null);
    setEditingText("");
  };

  const saveEditNote = async () => {
    if (!editingNoteId || !me) return;
    const note = notes.find((n) => n.id === editingNoteId);
    if (!note) return;

    const trimmed = editingText.trim();
    if (!trimmed || trimmed === note.note) {
      cancelEditNote();
      return;
    }

    try {
      const editorId = employees.find((x) => x.email === me.email)?.id || null;

      // log change
      await supabase.from("quote_note_edits").insert({
        note_id: note.id,
        editor_id: editorId,
        previous_value: note.note || "",
        new_value: trimmed,
      });

      // update note
      const { data: updatedRow, error: updateError } = await supabase
        .from("quote_notes")
        .update({
          note: trimmed,
          updated_at: new Date().toISOString(),
          updated_by: editorId,
        })
        .eq("id", note.id)
        .select("*")
        .single();

      if (updateError) throw updateError;

      setNotes((prev) => prev.map((n) => (n.id === note.id ? updatedRow : n)));
      cancelEditNote();
    } catch (err) {
      console.error("Error editing note:", err);
    }
  };

  const handleAddTime = async (e) => {
  e.preventDefault();
  if (!quoteId || !hours.trim()) return;

  const h = Number(hours);
  if (Number.isNaN(h) || h <= 0) return;

  try {
    const res = await fetch(`/api/admin/quotes/${quoteId}/time`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hours: h,
        description: timeDescription,
        employee_id: quote?.employee_id ?? null,
      }),
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || "Failed");

    setTimeEntries((prev) => [json.data, ...prev]);
    setHours("");
    setTimeDescription("");
  } catch (err) {
    console.error("Error adding time entry:", err);
    alert(err.message || "Could not add time entry");
  }
};


  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    setFile(f || null);
  };

  const getPublicUrl = (path) => {
    const { data } = supabase.storage.from("quote-attachments").getPublicUrl(path);
    return data?.publicUrl || null;
  };

  const handleUpload = async () => {
    if (!file || !quoteId || !me) return;

    try {
      setUploading(true);

      const path = `${quoteId}/${Date.now()}_${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("quote-attachments")
        .upload(path, file);

      if (uploadError) throw uploadError;

      const uploadedBy = employees.find((x) => x.email === me.email)?.id || null;

      const { data, error: metaError } = await supabase
        .from("quote_attachments")
        .insert({
          quote_id: quoteId,
          file_name: file.name,
          file_path: path,
          uploaded_by: uploadedBy,
        })
        .select("*")
        .single();

      if (metaError) throw metaError;

      setAttachments((prev) => [data, ...prev]);
      setFile(null);
    } catch (err) {
      console.error("Error uploading attachment:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleCreatePortalLink = async () => {
    if (!quoteId) return;

    try {
      setCreatingPortal(true);

      const token =
        (window.crypto?.randomUUID && window.crypto.randomUUID()) ||
        Math.random().toString(36).slice(2) + Date.now().toString(36);

      const expires = new Date();
      expires.setMonth(expires.getMonth() + 3);

      const { data, error } = await supabase
        .from("quote_portal_tokens")
        .insert({
          quote_id: quoteId,
          token,
          expires_at: expires.toISOString(),
        })
        .select("*")
        .single();

      if (error) throw error;

      const base = window.location.origin;
      setPortalUrl(`${base}/portal/${data.token}`);
    } catch (err) {
      console.error("Error creating portal link:", err);
    } finally {
      setCreatingPortal(false);
    }
  };

  const handleGenerateOfferPdf = async () => {
    if (!quote || !quoteId || !me) return;

    try {
      setGeneratingPdf(true);

      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text("Offer / Project Summary", 20, 20);

      doc.setFontSize(11);
      let y = 30;

      const addLine = (text) => {
        doc.text(String(text), 20, y);
        y += 6;
      };

      addLine(`Project ID: ${quote.id}`);
      addLine(`Customer: ${quote.name || ""}`);
      if (quote.address) addLine(`Address: ${quote.address}`);
      if (quote.email) addLine(`Email: ${quote.email}`);
      if (quote.phone) addLine(`Phone: ${quote.phone}`);

      y += 4;
      addLine(`Status: ${quote.status || "Ny"}`);
      addLine(`Urgent: ${quote.priority === "hast" ? "Yes" : "No"}`);

      if (quote.inspection_date) addLine(`Inspection: ${new Date(quote.inspection_date).toLocaleString()}`);
      if (quote.start_date) addLine(`Start: ${new Date(quote.start_date).toLocaleDateString()}`);
      if (quote.due_date) addLine(`Due: ${new Date(quote.due_date).toLocaleDateString()}`);

      y += 4;
      addLine("---");
      addLine("Customer message:");

      const message = quote.message || "";
      const split = doc.splitTextToSize(message, 170);
      doc.text(split, 20, y);
      y += split.length * 6;

      y += 8;
      addLine(`Total logged hours: ${totalHours.toFixed(2)}h`);

      // upload pdf
      const pdfBlob = doc.output("blob");
      const fileName = `offer_quote_${quote.id}.pdf`;
      const path = `${quote.id}/${Date.now()}_${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("quote-attachments")
        .upload(path, pdfBlob);

      if (uploadError) throw uploadError;

      const uploadedBy = employees.find((x) => x.email === me.email)?.id || null;

      const { data, error: metaError } = await supabase
        .from("quote_attachments")
        .insert({
          quote_id: quoteId,
          file_name: fileName,
          file_path: path,
          uploaded_by: uploadedBy,
        })
        .select("*")
        .single();

      if (metaError) throw metaError;

      setAttachments((prev) => [data, ...prev]);
    } catch (err) {
      console.error("Error generating PDF:", err);
    } finally {
      setGeneratingPdf(false);
    }
  };

  // --- render ---
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
      <div className="flex items-center justify-between gap-4">
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

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleGenerateOfferPdf} className="gap-2" disabled={generatingPdf}>
            <FileText size={16} />
            {generatingPdf ? "Generating…" : "Generate PDF"}
          </Button>

          <Button onClick={handleCreatePortalLink} className="gap-2" disabled={creatingPortal}>
            <LinkIcon size={16} />
            {creatingPortal ? "Creating…" : "Create portal link"}
          </Button>
        </div>
      </div>

      {/* Portal link */}
      {portalUrl ? (
        <Card>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-white font-semibold">Customer portal link</div>
              <div className="text-brand-300 text-sm break-all">{portalUrl}</div>
            </div>
            <Button
              variant="outline"
              onClick={() => navigator.clipboard.writeText(portalUrl)}
            >
              Copy
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: core */}
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
              <Button type="submit" className="gap-2" disabled={!canManageNotes}>
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
                          <Button onClick={saveEditNote}>Save</Button>
                          <Button variant="outline" onClick={cancelEditNote}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="text-brand-200 text-sm whitespace-pre-wrap">{n.note}</div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="text-xs text-brand-500">
                            {n.created_at ? new Date(n.created_at).toLocaleString() : ""}
                          </div>
                          <Button variant="outline" onClick={() => startEditNote(n)}>
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

        {/* Right: time + attachments */}
        <div className="space-y-6">
          <Card>
            <div className="flex items-center justify-between">
              <div className="text-white font-semibold flex items-center gap-2">
                <Clock size={16} /> Time
              </div>
              <div className="text-sm text-white">{totalHours.toFixed(2)}h</div>
            </div>

            <form onSubmit={handleAddTime} className="mt-4 space-y-3">
              <Input
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="Hours (e.g. 1.5)"
              />
              <Input
                value={timeDescription}
                onChange={(e) => setTimeDescription(e.target.value)}
                placeholder="Description (optional)"
              />
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
                    <div className="text-white text-sm font-medium">{Number(t.hours).toFixed(2)}h</div>
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
              <input type="file" onChange={handleFileChange} />
              <Button onClick={handleUpload} disabled={uploading || !file} className="gap-2">
                <Plus size={16} /> {uploading ? "Uploading…" : "Upload"}
              </Button>
            </div>

            <div className="mt-4 space-y-2">
              {attachments.length === 0 ? (
                <div className="text-brand-400 text-sm">No attachments.</div>
              ) : (
                attachments.map((a) => {
                  const url = getPublicUrl(a.file_path);
                  return (
                    <div key={a.id} className="border border-brand-800 rounded-lg p-3 bg-brand-900/30">
                      <div className="text-white text-sm font-medium flex items-center gap-2">
                        <Paperclip size={14} /> {a.file_name}
                      </div>
                      <div className="text-brand-500 text-[11px] mt-1">
                        {a.created_at ? new Date(a.created_at).toLocaleString() : ""}
                      </div>
                      {url ? (
                        <a className="text-accent-blue text-sm underline mt-2 inline-block" href={url} target="_blank" rel="noreferrer">
                          Open
                        </a>
                      ) : null}
                    </div>
                  );
                })
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
