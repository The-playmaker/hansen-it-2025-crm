"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { EmptyState, Field, formatDate, PhoenixPageHeader, PhoenixPanel, PrimaryButton, SecondaryButton, SelectInput, StatusBadge, TextArea, TextInput } from "@/components/phoenix/PhoenixUi";

const scanTypes = [
  { value: "passive", label: "Passiv OSINT/DNS/HTTP" },
  { value: "external_active", label: "Ekstern aktiv scan (deaktivert)" },
  { value: "internal_agent", label: "Intern agent/VPN (deaktivert)" }
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

const jobStatusText = (job) => {
  if (!job) return "";
  if (job.status === "queued") return "Queued - waiting for scanner runner";
  if (job.status === "running") return "Running - scanner runner behandler jobben";
  if (job.status === "completed") return "Completed";
  if (job.status === "failed") return "Failed";
  if (job.status === "cancelled") return "Cancelled";
  return job.status;
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
  const queuedCount = useMemo(() => items.filter((item) => item.scan_jobs?.some((job) => job.status === "queued")).length, [items]);

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

  useEffect(() => {
    load();
  }, []);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const updateScanType = (value) => {
    if (value !== "passive") {
      setError("Active scanning disabled – shared egress IP. Velg passiv scan.");
      setForm((current) => ({ ...current, scan_type: "passive" }));
      return;
    }
    setError("");
    setForm((current) => ({ ...current, scan_type: value }));
  };

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
        description="Send sikker token-lenke til kunde for autorisert skanning. Signering oppretter scan_job med status queued, som venter paa scanner runner."
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
          <p className="font-semibold">Passive scan runner active</p>
          <p className="mt-1">phoenix-scan01 kjører passiv DNS/HTTP/TLS/header/e-postkontroll.</p>
        </div>
        <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          <p className="font-semibold">Active scanning disabled – shared egress IP</p>
          <p className="mt-1">Egress IP 185.243.217.163 er delt Proxmox/NAT. external_active, Nmap og vuln scan er blokkert.</p>
        </div>
      </div>

      {!configured ? <PhoenixPanel title="Ikke konfigurert" description="Supabase maa konfigureres for scan-autorisasjoner kan brukes." /> : null}
      {error ? <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div> : null}

      <div className="grid gap-4 md:grid-cols-4">
        <PhoenixPanel title="Totalt"><p className="text-3xl font-bold text-white">{items.length}</p><p className="text-sm text-slate-400">Autorisasjoner</p></PhoenixPanel>
        <PhoenixPanel title="Venter"><p className="text-3xl font-bold text-amber-200">{pendingCount}</p><p className="text-sm text-slate-400">Sendt, ikke signert</p></PhoenixPanel>
        <PhoenixPanel title="Signert"><p className="text-3xl font-bold text-emerald-200">{signedCount}</p><p className="text-sm text-slate-400">Godkjent scope</p></PhoenixPanel>
        <PhoenixPanel title="Queued"><p className="text-3xl font-bold text-sky-200">{queuedCount}</p><p className="text-sm text-slate-400">Venter paa runner</p></PhoenixPanel>
      </div>

      <PhoenixPanel title="Ny autorisasjon" description="Definer scope for kunden signerer. Aktiv skanning skal ikke kjores uten signert autorisasjon.">
        <form onSubmit={createAuthorization} className="grid gap-4 lg:grid-cols-2">
          <Field label="Kunde/firma"><TextInput value={form.customer_name} onChange={(event) => update("customer_name", event.target.value)} required /></Field>
          <Field label="E-post til signatar"><TextInput type="email" value={form.signer_email} onChange={(event) => update("signer_email", event.target.value)} required /></Field>
          <Field label="Navn signatar"><TextInput value={form.signer_name} onChange={(event) => update("signer_name", event.target.value)} /></Field>
          <Field label="Rolle"><TextInput value={form.signer_role} onChange={(event) => update("signer_role", event.target.value)} placeholder="Daglig leder / IT-ansvarlig" /></Field>
          <Field label="Scan-type"><SelectInput value={form.scan_type} onChange={(event) => updateScanType(event.target.value)} options={scanTypes} /></Field>
          <Field label="Domener"><TextArea value={form.domains} onChange={(event) => update("domains", event.target.value)} placeholder={"hansen-it.com\nkunde.no"} /></Field>
          <Field label="IP-er i scope"><TextArea value={form.ip_addresses} onChange={(event) => update("ip_addresses", event.target.value)} placeholder={"Kun IP-er kunden eier/har samtykke til\n203.0.113.10"} /></Field>
          <Field label="Notater / begrensninger"><TextArea value={form.notes} onChange={(event) => update("notes", event.target.value)} /></Field>
          <div className="lg:col-span-2">
            <PrimaryButton disabled={saving || !configured} type="submit"><ShieldCheck size={16} />{saving ? "Oppretter..." : "Opprett token-lenke"}</PrimaryButton>
          </div>
        </form>
      </PhoenixPanel>

      <PhoenixPanel title="Autorisasjoner">
        {loading ? <EmptyState text="Henter autorisasjoner..." /> : null}
        {!loading ? (
          <div className="space-y-3">
            {items.length ? items.map((item) => {
              const job = item.scan_jobs?.[0];
              return (
                <article key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-white">{item.customer_name}</h3>
                      <p className="mt-1 text-sm text-slate-400">{item.signer_email} - opprettet {formatDate(item.created_at)}</p>
                      <p className="mt-1 text-xs text-slate-500">Scope: {(item.scan_scopes?.[0]?.domains || []).join(", ") || "Ingen domener"} {(item.scan_scopes?.[0]?.ip_addresses || []).length ? ` - IP-er: ${item.scan_scopes[0].ip_addresses.length}` : ""}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge>{item.status}</StatusBadge>
                      {job ? <StatusBadge>job: {jobStatusText(job)}</StatusBadge> : null}
                    </div>
                  </div>
                  {job?.status === "queued" ? (
                    <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                      Queued - waiting for scanner runner. Scan kjører ikke ennå; den venter på `npm run scanner:run` eller manuell passiv kjøring fra detaljsiden.
                    </div>
                  ) : null}
                  <div className="mt-4"><Link href={`/admin/scan-authorizations/${item.id}`}><SecondaryButton type="button">Aapne detaljer</SecondaryButton></Link></div>
                </article>
              );
            }) : <EmptyState text="Ingen scan-autorisasjoner ennaa." />}
          </div>
        ) : null}
      </PhoenixPanel>
    </div>
  );
}
