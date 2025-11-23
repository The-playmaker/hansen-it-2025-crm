'use client';
import {
  useEffect,
  useState,
} from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Input } from '@/components/ui/Input';
import {
  ArrowLeft,
  Clock,
  User,
  FileText,
  Paperclip,
  Plus,
  Calendar as CalendarIcon,
  MapPin,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { AdminLayout } from '@/components/admin/AdminLayout';

export default function QuoteDetails() {
  const { id } = useParams();
  const quoteId = id ? Number(id) : null;
  const router = useRouter();

  // Basic auth state (assuming RLS handles permissions or we check roles here)
  const [user, setUser] = useState(null);

  const [quote, setQuote] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [notes, setNotes] = useState([]);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingText, setEditingText] = useState('');

  // Not checking detailed roles like 'manager' or 'admin' explicitly here for now,
  // assuming if they can access the page they can edit (simplification).
  const canManageNotes = true;

  const startEditNote = (note) => {
    setEditingNoteId(note.id);
    setEditingText(note.note || '');
  };

  const cancelEditNote = () => {
    setEditingNoteId(null);
    setEditingText('');
  };

  const saveEditNote = async () => {
    if (!editingNoteId || !user) return;
    const note = notes.find((n) => n.id === editingNoteId);
    if (!note) return;

    const trimmed = editingText.trim();
    if (!trimmed || trimmed === note.note) {
      cancelEditNote();
      return;
    }

    if (note.author_id !== user.id) {
      const ok = window.confirm(
        'Dette notatet er skrevet av en annen ansatt. Endringen vil loggføres og originalen vil beholdes i historikken. Fortsette?'
      );
      if (!ok) return;
    }

    try {
      // 1) Logg endringen i historikk-tabell
      const { error: logError } = await supabase.from('quote_note_edits').insert({
        note_id: note.id,
        editor_id: user.id,
        previous_value: note.note || '',
        new_value: trimmed,
      });

      if (logError) throw logError;

      // 2) Oppdater selve notatet
      const { data: updatedRow, error: updateError } = await supabase
        .from('quote_notes')
        .update({
          note: trimmed,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        })
        .eq('id', note.id)
        .select('*')
        .single();

      if (updateError) throw updateError;

      // 3) Oppdater UI
      setNotes((prev) =>
        prev.map((n) => (n.id === note.id ? updatedRow : n))
      );
      cancelEditNote();
    } catch (err) {
      console.error('Error editing note:', err);
    }
  };


  const [timeEntries, setTimeEntries] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Notat
  const [newNote, setNewNote] = useState('');
  // Time-entry
  const [hours, setHours] = useState('');
  const [timeDescription, setTimeDescription] = useState('');
  // Datoer
  const [inspectionDate, setInspectionDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  // Vedlegg
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  // Portal-link
  const [portalUrl, setPortalUrl] = useState(null);
  const [creatingPortal, setCreatingPortal] = useState(false);
  // PDF
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  useEffect(() => {
    if (!quoteId) return;

    const load = async () => {
      try {
        setLoading(true);

        const { data: quoteData, error: quoteError } = await supabase
          .from('requests')
          .select('*')
          .eq('id', quoteId)
          .maybeSingle();

        if (quoteError || !quoteData) {
          router.push('/admin/dashboard');
          return;
        }

        setQuote(quoteData);

        if (quoteData.inspection_date) {
          setInspectionDate(quoteData.inspection_date.slice(0, 10));
        }
        if (quoteData.start_date) {
          setStartDate(quoteData.start_date.slice(0, 10));
        }
        if (quoteData.due_date) {
          setDueDate(quoteData.due_date.slice(0, 10));
        }

        const { data: empData } = await supabase
          .from('employees')
          .select('*')
          .eq('active', true)
          .order('name', { ascending: true });

        setEmployees(empData || []);

        const { data: notesData } = await supabase
          .from('quote_notes')
          .select('*')
          .eq('quote_id', quoteId)
          .order('created_at', { ascending: false });

        setNotes(notesData || []);

        const { data: timeData } = await supabase
          .from('quote_time_entries')
          .select('*')
          .eq('quote_id', quoteId)
          .order('created_at', { ascending: false });

        setTimeEntries(timeData || []);

        const { data: attachData } = await supabase
          .from('quote_attachments')
          .select('*')
          .eq('quote_id', quoteId)
          .order('created_at', { ascending: false });

        setAttachments(attachData || []);
      } catch (err) {
        console.error('Error loading quote details:', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [quoteId, router]);

  const handleAssignChange = async (employeeId) => {
    if (!quoteId) return;
    setSaving(true);
    try {
      const value = employeeId ? Number(employeeId) : null;

      const { error } = await supabase
        .from('requests')
        .update({ employee_id: value })
        .eq('id', quoteId);

      if (error) throw error;

      setQuote((prev) => (prev ? { ...prev, employee_id: value } : prev));
    } catch (err) {
      console.error('Error assigning employee:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (status) => {
    if (!quoteId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('requests')
        .update({ status })
        .eq('id', quoteId);

      if (error) throw error;

      setQuote((prev) => (prev ? { ...prev, status } : prev));
    } catch (err) {
      console.error('Error updating status:', err);
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

      const { error } = await supabase
        .from('requests')
        .update(payload)
        .eq('id', quoteId);

      if (error) throw error;

      setQuote((prev) => (prev ? { ...prev, ...payload } : prev));
    } catch (err) {
      console.error('Error saving dates:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!quoteId || !user || !newNote.trim()) return;

    try {
      const { data, error } = await supabase
        .from('quote_notes')
        .insert({
          quote_id: quoteId,
          author_id: user.id,
          note: newNote.trim(),
        })
        .select('*')
        .single();

      if (error) throw error;

      setNotes((prev) => [data, ...prev]);
      setNewNote('');
    } catch (err) {
      console.error('Error adding note:', err);
    }
  };

  const handleAddTime = async (e) => {
    e.preventDefault();
    if (!quoteId || !hours.trim()) return;

    const h = Number(hours);
    if (isNaN(h) || h <= 0) return;

    try {
      const { data, error } = await supabase
        .from('quote_time_entries')
        .insert({
          quote_id: quoteId,
          employee_id: quote?.employee_id || null,
          hours: h,
          description: timeDescription.trim() || null,
        })
        .select('*')
        .single();

      if (error) throw error;

      setTimeEntries((prev) => [data, ...prev]);
      setHours('');
      setTimeDescription('');
    } catch (err) {
      console.error('Error adding time entry:', err);
    }
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    setFile(f || null);
  };

  const handleUpload = async () => {
    if (!file || !quoteId || !user) return;

    try {
      setUploading(true);

      const path = `${quoteId}/${Date.now()}_${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('quote-attachments')
        .upload(path, file);

      if (uploadError) throw uploadError;

      const { data, error: metaError } = await supabase
        .from('quote_attachments')
        .insert({
          quote_id: quoteId,
          file_name: file.name,
          file_path: path,
          uploaded_by: user.id,
        })
        .select('*')
        .single();

      if (metaError) throw metaError;

      setAttachments((prev) => [data, ...prev]);
      setFile(null);
    } catch (err) {
      console.error('Error uploading attachment:', err);
    } finally {
      setUploading(false);
    }
  };

  const getPublicUrl = (path) => {
    const { data } = supabase.storage
      .from('quote-attachments')
      .getPublicUrl(path);
    return data.publicUrl;
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
        .from('quote_portal_tokens')
        .insert({
          quote_id: quoteId,
          token,
          expires_at: expires.toISOString(),
        })
        .select('*')
        .single();

      if (error) throw error;

      const base = window.location.origin;
      setPortalUrl(`${base}/portal/${data.token}`);
    } catch (err) {
      console.error('Error creating portal link:', err);
    } finally {
      setCreatingPortal(false);
    }
  };

  const handleGenerateOfferPdf = async () => {
    if (!quote || !quoteId || !user) return;

    try {
      setGeneratingPdf(true);

      const doc = new jsPDF();

      doc.setFontSize(16);
      doc.text('Offer / Project Summary', 20, 20);

      doc.setFontSize(11);
      let y = 30;

      const addLine = (text) => {
        doc.text(text, 20, y);
        y += 6;
      };

      addLine(`Project ID: ${quote.id}`);
      addLine(`Customer: ${quote.name || ''}`);
      if (quote.address) addLine(`Address: ${quote.address}`);
      if (quote.email) addLine(`Email: ${quote.email}`);
      if (quote.phone) addLine(`Phone: ${quote.phone}`);

      y += 4;

      addLine(`Status: ${quote.status}`);
      addLine(`Urgent: ${quote.priority === 'hast' ? 'Yes' : 'No'}`);

      if (quote.inspection_date) {
        addLine(
          `Inspection: ${new Date(quote.inspection_date).toLocaleString()}`
        );
      }
      if (quote.start_date) {
        addLine(`Start: ${new Date(quote.start_date).toLocaleDateString()}`);
      }
      if (quote.due_date) {
        addLine(`Due: ${new Date(quote.due_date).toLocaleDateString()}`);
      }

      y += 4;
      addLine('---');
      addLine('Customer message:');

      const message = quote.message || '';
      const split = doc.splitTextToSize(message, 170);
      doc.text(split, 20, y);
      y += split.length * 6;

      const totalHours = timeEntries.reduce(
        (sum, t) => sum + Number(t.hours || 0),
        0
      );
      y += 8;
      addLine(`Total logged hours: ${totalHours.toFixed(2)}h`);

      const pdfBlob = doc.output('blob');
      const fileName = `offer_quote_${quote.id}.pdf`;
      const path = `${quote.id}/${Date.now()}_${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('quote-attachments')
        .upload(path, pdfBlob);

      if (uploadError) throw uploadError;

      const { data, error: metaError } = await supabase
        .from('quote_attachments')
        .insert({
          quote_id: quoteId,
          file_name: fileName,
          file_path: path,
          uploaded_by: user.id,
        })
        .select('*')
        .single();

      if (metaError) throw metaError;

      setAttachments((prev) => [data, ...prev]);
    } catch (err) {
      console.error('Error generating PDF:', err);
    } finally {
      setGeneratingPdf(false);
    }
  };

  if (loading || !quote) {
    return (
      <div className="min-h-screen bg-brand-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-accent-blue border-t-transparent animate-spin" />
      </div>
    );
  }

  const assignedEmployee = employees.find((e) => e.id === quote.employee_id);
  const totalHours = timeEntries.reduce(
    (sum, t) => sum + Number(t.hours || 0),
    0
  );

  return (
    <AdminLayout title={`Quote #${quote.id}`}>
      <div className="p-6 space-y-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-brand-400 hover:text-white mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-white">
              Request #{quote.id} – {quote.name}
            </h1>
            <p className="text-brand-400 text-sm flex flex-wrap gap-2 items-center">
              <span>{quote.email}</span>
              {quote.phone && <span>· {quote.phone}</span>}
              {quote.address && (
                <span className="flex items-center gap-1">
                  · <MapPin className="w-3 h-3" /> {quote.address}
                </span>
              )}
            </p>
          </div>

          <div className="flex flex-col items-stretch md:items-end gap-2">
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={quote.status || 'Ny'}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="bg-brand-900 border border-brand-700 rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="Ny">Ny</option>
                <option value="Pågår">Pågår</option>
                <option value="Fullført">Fullført</option>
              </select>

              <select
                value={quote.employee_id || ''}
                onChange={(e) => handleAssignChange(e.target.value)}
                className="bg-brand-900 border border-brand-700 rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="">Unassigned</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCreatePortalLink}
              disabled={creatingPortal}
            >
              {creatingPortal ? 'Creating link...' : 'Create customer link'}
            </Button>

            {portalUrl && (
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(portalUrl)}
                className="text-[11px] text-accent-blue underline mt-1 text-left md:text-right"
              >
                Copy portal link
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <User className="w-4 h-4" />
              Customer
            </h2>
            <p className="text-brand-300 text-sm">
              <span className="font-medium text-white">Name:</span>{' '}
              {quote.name}
            </p>
            <p className="text-brand-300 text-sm">
              <span className="font-medium text-white">Email:</span>{' '}
              {quote.email}
            </p>
            <p className="text-brand-300 text-sm">
              <span className="font-medium text-white">Company:</span>{' '}
              {quote.company || '-'}
            </p>
            <p className="text-brand-300 text-sm">
              <span className="font-medium text-white">Phone:</span>{' '}
              {quote.phone || '-'}
            </p>
            <p className="text-brand-300 text-sm">
              <span className="font-medium text-white">Address:</span>{' '}
              {quote.address || '-'}
            </p>
            <p className="text-brand-300 text-sm mt-2">
              <span className="font-medium text-white">Assigned:</span>{' '}
              {assignedEmployee ? assignedEmployee.name : 'Unassigned'}
            </p>
            <p className="text-brand-300 text-sm mt-2">
              <span className="font-medium text-white">Urgent:</span>{' '}
              {quote.priority === 'hast' ? (
                <span className="text-red-400 font-semibold">YES</span>
              ) : (
                'No'
              )}
            </p>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" />
              Dates
            </h2>
            <div className="space-y-3 text-sm text-brand-300">
              <div>
                <p className="text-brand-400 mb-1">Inspection</p>
                <input
                  type="date"
                  value={inspectionDate}
                  onChange={(e) => setInspectionDate(e.target.value)}
                  className="w-full bg-brand-900 border border-brand-700 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <p className="text-brand-400 mb-1">Start</p>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-brand-900 border border-brand-700 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <p className="text-brand-400 mb-1">Due</p>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full bg-brand-900 border border-brand-700 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleDatesSave}
                disabled={saving}
                className="mt-2"
              >
                Save dates
              </Button>
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Time summary
            </h2>
            <p className="text-3xl font-bold text-accent-blue">
              {totalHours.toFixed(2)}h
            </p>
            <p className="text-brand-400 text-sm mt-2">
              Sum of all logged hours on this quote.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleGenerateOfferPdf}
              disabled={generatingPdf}
              className="mt-4"
            >
              {generatingPdf ? 'Generating PDF...' : 'Generate offer PDF'}
            </Button>
          </Card>
        </div>

        <Card>
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Customer message
          </h2>
          <p className="text-brand-300 whitespace-pre-wrap text-sm">
            {quote.message}
          </p>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
  <h2 className="text-lg font-semibold text-white mb-3">
    Internal Notes
  </h2>

  {/* Nytt notat */}
  <form onSubmit={handleAddNote} className="space-y-3 mb-4">
    <Textarea
      label=""
      placeholder="Add an internal note about this quote..."
      value={newNote}
      onChange={(e) => setNewNote(e.target.value)}
    />
    <Button
      type="submit"
      variant="primary"
      size="sm"
      disabled={!newNote.trim()}
    >
      Add note
    </Button>
  </form>

  {/* Liste over notater */}
  <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
    {notes.length === 0 ? (
      <p className="text-sm text-brand-500">No notes yet.</p>
    ) : (
      notes.map((n) => {
        const isOwner = user && n.author_id === user.id;
        const canEditThis = user && (isOwner || canManageNotes);
        const isEditing = editingNoteId === n.id;

        return (
          <div
            key={n.id}
            className="border border-brand-800 rounded-lg p-3 bg-brand-900/60"
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <div>
                <p className="text-xs text-brand-500">
                  {n.created_at
                    ? new Date(n.created_at).toLocaleString()
                    : ''}
                </p>
                {n.updated_at && (
                  <p className="text-[10px] text-brand-500 italic">
                    Edited{' '}
                    {new Date(n.updated_at).toLocaleString()}
                  </p>
                )}
              </div>

              {canEditThis && !isEditing && (
                <button
                  type="button"
                  onClick={() => startEditNote(n)}
                  className="text-[11px] text-accent-blue hover:text-accent-cyan"
                >
                  Edit
                </button>
              )}
            </div>

            {/* Vis enten edit-mode eller vanlig tekst */}
            {isEditing ? (
              <div className="space-y-2">
                <Textarea
                  label=""
                  value={editingText}
                  onChange={(e) => setEditingText(e.target.value)}
                />
                <div className="flex items-center gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs py-1"
                    onClick={cancelEditNote}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    className="text-xs py-1"
                    onClick={saveEditNote}
                    disabled={!editingText.trim()}
                  >
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-brand-200 whitespace-pre-wrap">
                {n.note}
              </p>
            )}
          </div>
        );
      })
    )}
  </div>
</Card>


          <Card>
            <h2 className="text-lg font-semibold text-white mb-3">
              Time entries
            </h2>
            <form onSubmit={handleAddTime} className="space-y-3 mb-4">
              <Input
                label="Hours"
                type="number"
                step="0.25"
                min="0"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
              <Textarea
                label="Description"
                value={timeDescription}
                onChange={(e) => setTimeDescription(e.target.value)}
                placeholder="What was done?"
              />
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={!hours.trim()}
              >
                Add time entry
              </Button>
            </form>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {timeEntries.length === 0 ? (
                <p className="text-sm text-brand-500">No time entries yet.</p>
              ) : (
                timeEntries.map((t) => (
                  <div
                    key={t.id}
                    className="border border-brand-800 rounded-lg p-3 bg-brand-900/60"
                  >
                    <p className="text-xs text-brand-500 mb-1">
                      {t.created_at
                        ? new Date(t.created_at).toLocaleString()
                        : ''}{' '}
                      · {t.hours}h
                    </p>
                    {t.description && (
                      <p className="text-sm text-brand-200 whitespace-pre-wrap">
                        {t.description}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <Paperclip className="w-4 h-4" />
              Attachments
            </h2>

            <div className="space-y-3 mb-4">
              <input
                type="file"
                onChange={handleFileChange}
                className="text-sm text-brand-300"
              />
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={!file || uploading}
                onClick={handleUpload}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {uploading ? 'Uploading...' : 'Upload'}
              </Button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {attachments.length === 0 ? (
                <p className="text-sm text-brand-500">No attachments yet.</p>
              ) : (
                attachments.map((a) => (
                  <div
                    key={a.id}
                    className="border border-brand-800 rounded-lg px-3 py-2 bg-brand-900/60 flex items-center justify-between gap-2"
                  >
                    <span className="text-sm text-brand-200 truncate">
                      {a.file_name}
                    </span>
                    <a
                      href={getPublicUrl(a.file_path)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-accent-blue hover:text-accent-cyan"
                    >
                      Open
                    </a>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
