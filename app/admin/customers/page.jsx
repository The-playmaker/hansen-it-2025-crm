"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { customerStatuses } from "@/lib/phoenixMockData";
import { usePhoenixData } from "@/components/phoenix/usePhoenixData";
import { EmptyState, Field, FormActions, PhoenixPageHeader, PhoenixPanel, RecordCard, SelectInput, TextArea, TextInput } from "@/components/phoenix/PhoenixUi";

const blankCustomer = {
  company_name: "",
  contact_name: "",
  phone: "",
  email: "",
  address: "",
  customer_type: "",
  status: "lead",
  notes: ""
};

function normalizeCustomer(customer = {}) {
  return {
    ...customer,
    company_name: customer.company_name || customer.companyName || "",
    contact_name: customer.contact_name || customer.contactPerson || customer.contacts?.[0]?.name || "",
    email: customer.email || customer.contacts?.[0]?.email || "",
    phone: customer.phone || customer.contacts?.[0]?.phone || "",
    address: customer.address || "",
    customer_type: customer.customer_type || customer.customerType || "",
    status: customer.status || "lead",
    notes: customer.notes || ""
  };
}

export default function CustomersPage() {
  const demo = usePhoenixData();
  const [customers, setCustomers] = useState([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(blankCustomer);
  const [editingId, setEditingId] = useState(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  const loadCustomers = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/customers", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Kunne ikke hente kunder.");
      setConfigured(result.configured !== false);
      setCustomers(result.configured === false ? demo.data.customers.map(normalizeCustomer) : (result.data || []).map(normalizeCustomer));
    } catch (err) {
      setError(err.message || "Kunne ikke hente kunder.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    return customers.filter((customer) => {
      const haystack = `${customer.company_name} ${customer.contact_name} ${customer.email} ${customer.phone}`.toLowerCase();
      return haystack.includes(query.toLowerCase());
    });
  }, [customers, query]);

  const save = async (event) => {
    event.preventDefault();
    if (!form.company_name.trim()) return;

    if (!configured) {
      const demoCustomer = {
        id: editingId,
        companyName: form.company_name,
        contactPerson: form.contact_name,
        phone: form.phone,
        email: form.email,
        address: form.address,
        customerType: form.customer_type,
        status: form.status,
        notes: form.notes,
        contacts: [{ name: form.contact_name, role: "Hovedkontakt", email: form.email, phone: form.phone }]
      };
      demo.upsert("customers", demoCustomer, "kunde");
      setCustomers((current) => editingId
        ? current.map((customer) => customer.id === editingId ? normalizeCustomer({ ...demoCustomer, id: editingId }) : customer)
        : [normalizeCustomer({ ...demoCustomer, id: `demo-${Date.now()}` }), ...current]);
      setForm(blankCustomer);
      setEditingId(null);
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(editingId ? `/api/admin/customers/${editingId}` : "/api/admin/customers", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Kunne ikke lagre kunde.");
      const normalized = normalizeCustomer(result.data);
      setCustomers((current) => editingId ? current.map((customer) => customer.id === editingId ? { ...customer, ...normalized } : customer) : [normalized, ...current]);
      setForm(blankCustomer);
      setEditingId(null);
    } catch (err) {
      alert(err.message || "Kunne ikke lagre kunde.");
    } finally {
      setSaving(false);
    }
  };

  const edit = (customer) => {
    const normalized = normalizeCustomer(customer);
    setForm({
      company_name: normalized.company_name,
      contact_name: normalized.contact_name,
      phone: normalized.phone,
      email: normalized.email,
      address: normalized.address,
      customer_type: normalized.customer_type,
      status: normalized.status,
      notes: normalized.notes
    });
    setEditingId(customer.id);
  };

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PhoenixPageHeader title="Kunder" description="Kunder og kontaktpersoner hentes fra Supabase-tabellene customers og contacts når Supabase er konfigurert." />
      {!configured ? <PhoenixPanel title="Demo mode" description="Supabase er ikke konfigurert. Kunder lagres midlertidig lokalt i nettleseren." /> : null}
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <PhoenixPanel title={editingId ? "Rediger kunde" : "Ny kunde"} description="Opprett kunde i Supabase og legg inn primærkontakt.">
          <form onSubmit={save} className="space-y-4">
            <Field label="Firmanavn"><TextInput value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} required /></Field>
            <Field label="Kontaktperson"><TextInput value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Telefon"><TextInput value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
              <Field label="E-post"><TextInput type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            </div>
            <Field label="Adresse"><TextInput value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Kundetype"><TextInput value={form.customer_type} onChange={(e) => setForm({ ...form, customer_type: e.target.value })} /></Field>
              <Field label="Status"><SelectInput value={form.status} options={customerStatuses} onChange={(e) => setForm({ ...form, status: e.target.value })} /></Field>
            </div>
            <Field label="Notater"><TextArea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
            <FormActions editing={Boolean(editingId)} onCancel={() => { setForm(blankCustomer); setEditingId(null); }} />
            {saving ? <p className="text-sm text-slate-400">Lagrer...</p> : null}
          </form>
        </PhoenixPanel>

        <PhoenixPanel title="Kundeliste" description="Ekte kunder fra Supabase når databasen er konfigurert.">
          <div className="mb-4 flex flex-wrap gap-2">
            <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Søk kunde eller kontakt..." className="max-w-sm" />
            <button onClick={() => { setForm(blankCustomer); setEditingId(null); }} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-semibold text-white hover:bg-white/10"><Plus size={16} />Ny kunde</button>
          </div>
          {loading ? <EmptyState text="Henter kunder..." /> : null}
          {error ? <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div> : null}
          {!loading && !error ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {filtered.length ? filtered.map((customer) => (
                <RecordCard key={customer.id} title={customer.company_name || "Ukjent kunde"} meta={`${customer.contact_name || "Ingen kontakt"} - ${customer.email || "Ingen e-post"}`} badge={customer.status} onEdit={() => edit(customer)}>
                  <p>{customer.notes}</p>
                  <div className="mt-3 rounded-xl bg-white/5 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Kontaktpersoner</p>
                    {(customer.contacts || []).length ? customer.contacts.map((contact) => (
                      <p key={contact.id || `${contact.email}-${contact.name}`} className="mt-2 text-sm text-slate-300">{contact.name || "Ukjent"} - {contact.role || "Kontakt"} - {contact.email || contact.phone || "Ingen kontaktinfo"}</p>
                    )) : <p className="mt-2 text-sm text-slate-500">Ingen kontakter registrert.</p>}
                  </div>
                  {configured ? <Link href={`/admin/customers/${customer.id}`} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">Åpne detaljer <ArrowRight size={16} /></Link> : null}
                </RecordCard>
              )) : <EmptyState text="Ingen kunder funnet." />}
            </div>
          ) : null}
        </PhoenixPanel>
      </div>
    </div>
  );
}
