"use client";

import { useState } from "react";
import { ideaStatuses } from "@/lib/phoenixMockData";
import { usePhoenixData } from "@/components/phoenix/usePhoenixData";
import { EmptyState, Field, FormActions, PhoenixPageHeader, PhoenixPanel, RecordCard, SelectInput, TextArea, TextInput } from "@/components/phoenix/PhoenixUi";

const blankIdea = { title: "", description: "", category: "", status: "parkert" };

export default function IdeasPage() {
  const { data, upsert, remove } = usePhoenixData();
  const [form, setForm] = useState(blankIdea);
  const [editingId, setEditingId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("alle");

  const ideas = statusFilter === "alle" ? data.ideas : data.ideas.filter((idea) => idea.status === statusFilter);

  const save = (event) => {
    event.preventDefault();
    if (!form.title.trim()) return;
    upsert("ideas", { ...form, id: editingId }, "ide");
    setForm(blankIdea);
    setEditingId(null);
  };

  const edit = (idea) => {
    setForm({ ...blankIdea, ...idea });
    setEditingId(idea.id);
  };

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PhoenixPageHeader title="Idebank" description="Nye ideer parkeres raskt. De blir ikke aktive prosjekter før statusen bevisst endres." />
      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <PhoenixPanel title={editingId ? "Rediger ide" : "Parker ny ide"} description="Standardstatus er parkert for å beskytte fokus i v1.">
          <form onSubmit={save} className="space-y-4">
            <Field label="Tittel"><TextInput value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></Field>
            <Field label="Beskrivelse"><TextArea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Kategori"><TextInput value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
              <Field label="Status"><SelectInput value={form.status} options={ideaStatuses} onChange={(e) => setForm({ ...form, status: e.target.value })} /></Field>
            </div>
            <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 p-3 text-sm text-amber-100">Rask parkering er tilsiktet: ideer skal ikke automatisk bli oppgaver, tilbud eller prosjekter.</div>
            <FormActions editing={Boolean(editingId)} onCancel={() => { setForm(blankIdea); setEditingId(null); }} />
          </form>
        </PhoenixPanel>

        <PhoenixPanel title="Ideer" description="Filtrer etter status og løft kun det som faktisk skal prioriteres.">
          <div className="mb-4 flex flex-wrap gap-2">
            <SelectInput value={statusFilter} options={["alle", ...ideaStatuses]} onChange={(e) => setStatusFilter(e.target.value)} className="max-w-xs" />
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {ideas.length ? ideas.map((idea) => (
              <RecordCard key={idea.id} title={idea.title} meta={idea.category || "Ingen kategori"} badge={idea.status} onEdit={() => edit(idea)} onDelete={() => remove("ideas", idea.id)}>
                <p>{idea.description}</p>
              </RecordCard>
            )) : <EmptyState text="Ingen ideer i dette filteret." />}
          </div>
        </PhoenixPanel>
      </div>
    </div>
  );
}
