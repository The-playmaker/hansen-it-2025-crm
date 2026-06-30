"use client";

import { useState } from "react";
import { customerStatuses } from "@/lib/phoenixMockData";
import { usePhoenixData } from "@/components/phoenix/usePhoenixData";
import { AddIcon, EmptyState, Field, FormActions, PhoenixPageHeader, PhoenixPanel, RecordCard, SelectInput, TextArea, TextInput } from "@/components/phoenix/PhoenixUi";

const blankCustomer = {
  companyName: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  customerType: "",
  status: "lead",
  followUpDate: "",
  notes: "",
  contacts: []
};

export default function CustomersPage() {
  const { data, upsert, remove } = usePhoenixData();
  const [form, setForm] = useState(blankCustomer);
  const [editingId, setEditingId] = useState(null);
  const [query, setQuery] = useState("");

  const filtered = data.customers.filter((customer) => `${customer.companyName} ${customer.contactPerson} ${customer.email}`.toLowerCase().includes(query.toLowerCase()));

  const save = (event) => {
    event.preventDefault();
    if (!form.companyName.trim()) return;
    const contacts = form.contacts?.length ? form.contacts : [{ name: form.contactPerson, role: "Hovedkontakt", email: form.email, phone: form.phone }];
    upsert("customers", { ...form, id: editingId, contacts }, "kunde");
    setForm(blankCustomer);
    setEditingId(null);
  };

  const edit = (customer) => {
    setForm({ ...blankCustomer, ...customer });
    setEditingId(customer.id);
  };

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PhoenixPageHeader title="Kunder" description="Companies og contacts fra inspirasjons-CRM-et er samlet i én enkel kundevisning for v1." />
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <PhoenixPanel title={editingId ? "Rediger kunde" : "Ny kunde"} description="Legg inn firma og primærkontakt. Flere kontaktpersoner kan struktureres senere.">
          <form onSubmit={save} className="space-y-4">
            <Field label="Firmanavn"><TextInput value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} required /></Field>
            <Field label="Kontaktperson"><TextInput value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Telefon"><TextInput value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
              <Field label="E-post"><TextInput type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            </div>
            <Field label="Adresse"><TextInput value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Kundetype"><TextInput value={form.customerType} onChange={(e) => setForm({ ...form, customerType: e.target.value })} /></Field>
              <Field label="Status"><SelectInput value={form.status} options={customerStatuses} onChange={(e) => setForm({ ...form, status: e.target.value })} /></Field>
            </div>
            <Field label="Oppfølging"><TextInput type="date" value={form.followUpDate} onChange={(e) => setForm({ ...form, followUpDate: e.target.value })} /></Field>
            <Field label="Notater"><TextArea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
            <FormActions editing={Boolean(editingId)} onCancel={() => { setForm(blankCustomer); setEditingId(null); }} />
          </form>
        </PhoenixPanel>

        <PhoenixPanel title="Kundeliste" description="Kortbasert layout inspirert av Companies-visningen.">
          <div className="mb-4 flex flex-wrap gap-2">
            <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Søk kunde eller kontakt..." className="max-w-sm" />
            <button onClick={() => { setForm(blankCustomer); setEditingId(null); }} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-semibold text-white hover:bg-white/10"><AddIcon />Ny kunde</button>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {filtered.length ? filtered.map((customer) => (
              <RecordCard key={customer.id} title={customer.companyName} meta={`${customer.contactPerson || "Ingen kontakt"} - ${customer.email || "Ingen e-post"}`} badge={customer.status} onEdit={() => edit(customer)} onDelete={() => remove("customers", customer.id)}>
                <p>{customer.notes}</p>
                <div className="mt-3 rounded-xl bg-white/5 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Kontaktpersoner</p>
                  {(customer.contacts || []).map((contact, index) => (
                    <p key={`${contact.email}-${index}`} className="mt-2 text-sm text-slate-300">{contact.name} - {contact.role || "Kontakt"} - {contact.email || contact.phone || "Ingen kontaktinfo"}</p>
                  ))}
                </div>
              </RecordCard>
            )) : <EmptyState text="Ingen kunder funnet." />}
          </div>
        </PhoenixPanel>
      </div>
    </div>
  );
}
