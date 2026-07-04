"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { EmptyState, Field, formatDate, PhoenixPageHeader, PhoenixPanel, PrimaryButton, SecondaryButton, SelectInput, StatusBadge, TextArea, TextInput } from "@/components/phoenix/PhoenixUi";

const scanTypes = [
  { value: "passive", label: "Passiv OSINT/DNS/HTTP" },
  { value: "standard", label: "Standard autorisert scan" },
  { value: "extended", label: "Utvidet autorisert scan" }
];

const initialForm = {
  customer_name: "",
  signer_name: "",
  signer_email: "",
  signer_role: "",
  domains: "",
  ip_addresses: "",
  scan_type: "passive",
  notes: ""
};

export default function ScanAuthorizationsPage() {
  const [items, setItems] = useState([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(initialForm);

  const pendingCount = useMemo(() => items.filter((item) => item.status === "pending").length, [items]);
  const signedCount = useMemo(() => items.filter((item) => item.status === "signed").length, [items]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/scan-authorizations", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Kunne ikke hente autorisasjoner.");
      setConfigured(result.configured !== false);
      setItems(result.data || []);
    } catch (err) {
      setError(err.message || "Kunne ikke hente autorisasjoner.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const createAuthorization = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/scan-authorizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Kunne ikke opprette autorisasjon.");
      setItems((current) => [result.data, ...current]);
      setForm(initialForm);
    } catch (err) {
      setError(err.message || "Kunne ikke opprette autorisasjon.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PhoenixPageHeader
        eyebrow="Security"
        title="Scan Authorizations"
        description="Send sikker token-lenke til kunde før autorisert skanning. Signering oppretter scan_job med status queued."
      />

      {!configured ? <PhoenixPanel title="Ikke konfigurert" description="Supabase må konfigureres før scan-autorisasjoner kan brukes." /> : null}
      {error ? <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <PhoenixPanel title="Totalt"><p className="text-3xl font-bold text-white">{items.length}</p><p className="text-sm text-slate-400">Autorisasjoner</p></PhoenixPanel>
        <PhoenixPanel title="Venter"><p className="text-3xl font-bold text-amber-200">{pendingCount}</p><p className="text-sm text-slate-400">Sendt, ikke signert</p></PhoenixPanel>
        <PhoenixPanel title="Signert"><p className="text-3xl font-bold text-emerald-200">{signedCount}</p><p className="text-sm text-slate-400">Jobb skal være queued</p></PhoenixPanel>
      </div>

      <PhoenixPanel title="Ny autorisasjon" description="Definer scope før kunden signerer. Aktiv skanning skal ikke kjøres uten signert autorisasjon.">
        <form onSubmit={createAuthorization} className="grid gap-4 lg:grid-cols-2">
          <Field label="Kunde/firma"><TextInput value={form.customer_name} onChange={(e) => update("customer_name", e.target.value)} required /></Field>
          <Field label="E-post til signatar"><TextInput type="email" value={form.signer_email} onChange={(e) => update("signer_email", e.target.value)} required /></Field>
          <Field label="Navn signatar"><TextInput value={form.signer_name} onChange={(e) => update("signer_name", e.target.value)} /></Field>
          <Field label="Rolle"><TextInput value={form.signer_role} onChange={(e) => update("signer_role", e.target.value)} placeholder="Daglig leder / IT-ansvarlig" /></Field>
          <Field label="Scan-type"><SelectInput value={form.scan_type} onChange={(e) => update("scan_type", e.target.value)} options={scanTypes} /></Field>
          <Field label="Domener"><TextArea value={form.domains} onChange={(e) => update("domains", e.target.value)} placeholder={"hansen-it.com\nkunde.no"} /></Field>
          <Field label="IP-er i scope"><TextArea value={form.ip_addresses} onChange={(e) => update("ip_addresses", e.target.value)} placeholder={"Kun IP-er kunden eier/har samtykke til\n203.0.113.10"} /></Field>
          <Field label="Notater / begrensninger"><TextArea value={form.notes} onChange={(e) => update("notes", e.target.value)} /></Field>
          <div className="lg:col-span-2">
            <PrimaryButton disabled={saving || !configured} type="submit"><ShieldCheck size={16} />{saving ? "Oppretter..." : "Opprett token-lenke"}</PrimaryButton>
          </div>
        </form>
      </PhoenixPanel>

      <PhoenixPanel title="Autorisasjoner">
        {loading ? <EmptyState text="Henter autorisasjoner..." /> : null}
        {!loading ? (
          <div className="space-y-3">
            {items.length ? items.map((item) => (
              <article key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-white">{item.customer_name}</h3>
                    <p className="mt-1 text-sm text-slate-400">{item.signer_email} · opprettet {formatDate(item.created_at)}</p>
                    <p className="mt-1 text-xs text-slate-500">Scope: {(item.scan_scopes?.[0]?.domains || []).join(", ") || "Ingen domener"} {(item.scan_scopes?.[0]?.ip_addresses || []).length ? `· IP-er: ${item.scan_scopes[0].ip_addresses.length}` : ""}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge>{item.status}</StatusBadge>
                    {item.scan_jobs?.length ? <StatusBadge>job: {item.scan_jobs[0].status}</StatusBadge> : null}
                  </div>
                </div>
                <div className="mt-4"><Link href={`/admin/scan-authorizations/${item.id}`}><SecondaryButton type="button">Åpne detaljer</SecondaryButton></Link></div>
              </article>
            )) : <EmptyState text="Ingen scan-autorisasjoner ennå." />}
          </div>
        ) : null}
      </PhoenixPanel>
    </div>
  );
}
