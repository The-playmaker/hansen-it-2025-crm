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


export default function QuoteDetails() {
  const { id } = useParams();
  const quoteId = id; // Assuming UUID, keep as string
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

  
}
