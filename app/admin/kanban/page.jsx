"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import { priorities, taskStatuses } from "@/lib/phoenixMockData";
import { usePhoenixData } from "@/components/phoenix/usePhoenixData";
import { EmptyState, Field, FormActions, formatDate, PhoenixPageHeader, PhoenixPanel, RecordCard, SelectInput, StatusBadge, TextArea, TextInput } from "@/components/phoenix/PhoenixUi";

const blankTask = { title: "", description: "", customerId: "", assignee: "", dueDate: "", status: "ny", priority: "normal" };

export default function KanbanPage() {
  const { data, customersById, upsert, remove } = usePhoenixData();
  const [form, setForm] = useState(blankTask);
  const [editingId, setEditingId] = useState(null);

  const save = (event) => {
    event.preventDefault();
    if (!form.title.trim()) return;
    upsert("tasks", { ...form, id: editingId, customerId: form.customerId || data.customers[0]?.id || "" }, "oppgave");
    setForm({ ...blankTask, customerId: data.customers[0]?.id || "" });
    setEditingId(null);
  };

  const edit = (task) => {
    setForm({ ...blankTask, ...task });
    setEditingId(task.id);
  };

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PhoenixPageHeader title="Oppgaver / Kanban" description="Scrumboard-inspirasjon uten tung drag/drop i v1. Endre status på kortet for å flytte oppgaven." />
      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <PhoenixPanel title={editingId ? "Rediger oppgave" : "Ny oppgave"} description="Hold oppgaver korte nok til at Dagens 3 blir nyttig.">
          <form onSubmit={save} className="space-y-4">
            <Field label="Tittel"><TextInput value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></Field>
            <Field label="Beskrivelse"><TextArea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            <Field label="Kunde"><SelectInput value={form.customerId || data.customers[0]?.id || ""} options={data.customers.map((customer) => ({ value: customer.id, label: customer.companyName }))} onChange={(e) => setForm({ ...form, customerId: e.target.value })} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Ansvarlig"><TextInput value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value })} /></Field>
              <Field label="Frist"><TextInput type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Status"><SelectInput value={form.status} options={taskStatuses} onChange={(e) => setForm({ ...form, status: e.target.value })} /></Field>
              <Field label="Prioritet"><SelectInput value={form.priority} options={priorities} onChange={(e) => setForm({ ...form, priority: e.target.value })} /></Field>
            </div>
            <FormActions editing={Boolean(editingId)} onCancel={() => { setForm(blankTask); setEditingId(null); }} />
          </form>
        </PhoenixPanel>

        <div className="grid gap-4 lg:grid-cols-4">
          {taskStatuses.map((status) => {
            const tasks = data.tasks.filter((task) => task.status === status);
            return (
              <PhoenixPanel key={status} title={status} description={`${tasks.length} oppgaver`} className="p-4">
                <div className="space-y-3">
                  {tasks.length ? tasks.map((task) => (
                    <RecordCard key={task.id} title={task.title} meta={`${customersById.get(task.customerId)?.companyName || "Ingen kunde"} - ${formatDate(task.dueDate)}`} badge={task.priority} onEdit={() => edit(task)} onDelete={() => remove("tasks", task.id)}>
                      <p>{task.description}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <StatusBadge>{task.status}</StatusBadge>
                        <SelectInput value={task.status} options={taskStatuses} onChange={(e) => upsert("tasks", { ...task, status: e.target.value }, "oppgave")} className="max-w-[150px]" />
                      </div>
                    </RecordCard>
                  )) : <EmptyState text="Ingen kort her." />}
                </div>
              </PhoenixPanel>
            );
          })}
        </div>
      </div>
    </div>
  );
}
