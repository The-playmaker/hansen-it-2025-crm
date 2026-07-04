"use client";

import { useEffect, useMemo, useState } from "react";
import { ideaStatuses } from "@/lib/phoenixMockData";
import { usePhoenixData } from "@/components/phoenix/usePhoenixData";
import { EmptyState, Field, FormActions, PhoenixPageHeader, PhoenixPanel, RecordCard, SelectInput, TextArea, TextInput } from "@/components/phoenix/PhoenixUi";

const blankIdea = { title: "", description: "", category: "", status: "parkert" };

export default function IdeasPage() {
  const demo = usePhoenixData();
  const [ideas, setIdeas] = useState([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(blankIdea);
  const [editingId, setEditingId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("alle");

  const loadIdeas = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/ideas", { cache: "no-store" });
      const result = await response.json();
      setConfigured(result.configured !== false);
      setIdeas(result.configured === false ? demo.data.ideas : result.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIdeas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => statusFilter === "alle" ? ideas : ideas.filter((idea) => idea.status === statusFilter), [ideas, statusFilter]);

  const save = async (event) => {
    event.preventDefault();
    if (!form.title.trim()) return;

    if (!configured) {
      demo.upsert("ideas", { ...form, id: editingId }, "ide");
      setIdeas(editingId ? ideas.map((idea) => idea.id === editingId ? { ...form, id: editingId } : idea) : [{ ...form, id: `demo-${Date.now()}` }, ...ideas]);
      setForm(blankIdea);
      setEditingId(null);
      return;
    }

    const response = await fetch(editingId ? `/api/admin/ideas/${editingId}` : "/api/admin/ideas", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const result = await response.json();
    if (!response.ok) return alert(result.error || "Kunne ikke lagre ide.");
    setIdeas(editingId ? ideas.map((idea) => idea.id === editingId ? result.data : idea) : [result.data, ...ideas]);
    setForm(blankIdea);
    setEditingId(null);
  };

  const edit = (idea) => {
    setForm({ ...blankIdea, ...idea });
    setEditingId(idea.id);
  };

  const deleteIdea = async (idea) => {
    if (!configured) {
      demo.remove("ideas", idea.id);
      setIdeas(ideas.filter((entry) => entry.id !== idea.id));
      return;
    }
    const response = await fetch(`/api/admin/ideas/${idea.id}`, { method: "DELETE" });
    if (!response.ok) return alert("Kunne ikke slette ide.");
    setIdeas(ideas.filter((entry) => entry.id !== idea.id));
  };

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PhoenixPageHeader title="Idebank" description="Idebanken bruker Supabase-tabellen phoenix_ideas når Supabase er konfigurert. LocalStorage brukes kun som demo fallback." />
      {!configured ? <PhoenixPanel title="Demo mode" description="Supabase er ikke konfigurert. Ideer lagres midlertidig lokalt i nettleseren." /> : null}
      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <PhoenixPanel title={editingId ? "Rediger ide" : "Parker ny ide"} description="Standardstatus er parkert for å beskytte fokus.">
          <form onSubmit={save} className="space-y-4">
            <Field label="Tittel"><TextInput value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></Field>
            <Field label="Beskrivelse"><TextArea value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Kategori"><TextInput value={form.category || ""} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
              <Field label="Status"><SelectInput value={form.status} options={ideaStatuses} onChange={(e) => setForm({ ...form, status: e.target.value })} /></Field>
            </div>
            <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 p-3 text-sm text-amber-100">Rask parkering er tilsiktet: ideer skal ikke automatisk bli oppgaver, tilbud eller prosjekter.</div>
            <FormActions editing={Boolean(editingId)} onCancel={() => { setForm(blankIdea); setEditingId(null); }} />
          </form>
        </PhoenixPanel>

        <PhoenixPanel title="Ideer" description="Filtrer etter status og løft kun det som faktisk skal prioriteres.">
          <div className="mb-4 flex flex-wrap gap-2"><SelectInput value={statusFilter} options={["alle", ...ideaStatuses]} onChange={(e) => setStatusFilter(e.target.value)} className="max-w-xs" /></div>
          {loading ? <EmptyState text="Henter ideer..." /> : <div className="grid gap-3 lg:grid-cols-2">
            {filtered.length ? filtered.map((idea) => (
              <RecordCard key={idea.id} title={idea.title} meta={idea.category || "Ingen kategori"} badge={idea.status} onEdit={() => edit(idea)} onDelete={() => deleteIdea(idea)}><p>{idea.description}</p></RecordCard>
            )) : <EmptyState text="Ingen ideer i dette filteret." />}
          </div>}
        </PhoenixPanel>
      </div>
    </div>
  );
}

