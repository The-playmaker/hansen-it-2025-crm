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
  customer_id: "",
  contact_id: "",
  request_id: "",
  quote_id: "",
  lead_id: "",
  customer_name: "",
  signer_name: "",
  signer_email: "",
  signer_role: "",
  domains: "",
  ip_addresses: "",
  scan_type: "passive",
  notes: ""
};

const knownTlds = new Set(["agency", "app", "as", "biz", "cloud", "co", "com", "dev", "digital", "dk", "io", "it", "net", "no", "org", "se", "tech"]);
const domainPattern = /^(?!-)[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63})+$/i;

function domainList(value) {
  return String(value || "").split(/[\n,;]/).map((item) => item.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].split(":")[0]).filter(Boolean);
}

function distance(a, b) {
  const matrix = Array.from({ length: a.length + 1 }, (_, index) => [index]);
  for (let j = 1; j <= b.length; j += 1) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return matrix[a.length][b.length];
}

function localDomainWarnings(value) {
  return domainList(value).flatMap((domain) => {
    const warnings = [];
    if (!domainPattern.test(domain)) warnings.push({ domain, message: "Ugyldig domeneformat." });
    const parts = domain.split(".");
    const tld = parts.at(-1) || "";
    const sld = parts.slice(0, -1).join(".");
    if (domainPattern.test(domain) && !knownTlds.has(tld)) {
      let best = null;
      for (const known of knownTlds) {
        const score = distance(tld, known);
        if (!best || score < best.score) best = { tld: known, score };
      }
      warnings.push({ domain, message: best?.score <= 2 ? `TLD ser mistenkelig ut. Mener du ${sld}.${best.tld}?` : "TLD ser ukjent eller mistenkelig ut." });
    }
    return warnings;
  });
}

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
  const [preflight, setPreflight] = useState(null);
  const [confirmDnsWarnings, setConfirmDnsWarnings] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [quotes, setQuotes] = useState([]);

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

  useEffect(() => {
    let cancelled = false;
    async function loadRelations() {
      const [customerRes, requestRes, quoteRes] = await Promise.all([
        fetch("/api/admin/customers", { cache: "no-store" }),
        fetch("/api/admin/requests", { cache: "no-store" }),
        fetch("/api/admin/quotes?table=quotes", { cache: "no-store" })
      ]);
      const [customerJson, requestJson, quoteJson] = await Promise.all([
        customerRes.json().catch(() => ({})),
        requestRes.json().catch(() => ({})),
        quoteRes.json().catch(() => ({}))
      ]);
      if (cancelled) return;
      setCustomers(customerJson.data || []);
      setRequests(requestJson.data || []);
      setQuotes(quoteJson.data || []);
    }
    loadRelations().catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const domainWarnings = useMemo(() => localDomainWarnings(form.domains), [form.domains]);

  const update = (key, value) => {
    setPreflight(null);
    setConfirmDnsWarnings(false);
    setForm((current) => ({ ...current, [key]: value }));
  };

  const selectedCustomer = customers.find((customer) => String(customer.id) === String(form.customer_id));
  const selectedContact = selectedCustomer?.contacts?.find((contact) => String(contact.id) === String(form.contact_id));
  const selectedRequest = requests.find((request) => String(request.id) === String(form.request_id));
  const selectedQuote = quotes.find((quote) => String(quote.id) === String(form.quote_id));

  const chooseCustomer = (customerId) => {
    const customer = customers.find((item) => String(item.id) === String(customerId));
    const primaryContact = customer?.contacts?.find((contact) => contact.is_primary) || customer?.contacts?.[0];
    setPreflight(null);
    setConfirmDnsWarnings(false);
    setForm((current) => ({
      ...current,
      customer_id: customerId,
      contact_id: primaryContact?.id || "",
      customer_name: customer?.company_name || customer?.name || current.customer_name,
      signer_email: primaryContact?.email || customer?.email || current.signer_email,
      signer_name: primaryContact?.name || current.signer_name
    }));
  };

  const chooseRequest = (requestId) => {
    const request = requests.find((item) => String(item.id) === String(requestId));
    setPreflight(null);
    setConfirmDnsWarnings(false);
    setForm((current) => ({
      ...current,
      request_id: requestId,
      customer_id: request?.customer_id || current.customer_id,
      contact_id: request?.contact_id || current.contact_id,
      lead_id: request?.lead_id || current.lead_id,
      customer_name: request?.company || request?.customer_name || request?.name || current.customer_name,
      signer_email: request?.email || current.signer_email,
      signer_name: request?.name || current.signer_name
    }));
  };

  const chooseQuote = (quoteId) => {
    const quote = quotes.find((item) => String(item.id) === String(quoteId));
    setPreflight(null);
    setConfirmDnsWarnings(false);
    setForm((current) => ({
      ...current,
      quote_id: quoteId,
      customer_id: quote?.customer_id || current.customer_id,
      contact_id: quote?.contact_id || current.contact_id,
      request_id: quote?.source_request_id || current.request_id,
      lead_id: quote?.lead_id || current.lead_id,
      customer_name: quote?.customer_name || quote?.company || quote?.name || current.customer_name,
      signer_email: quote?.email || current.signer_email,
      signer_name: quote?.name || current.signer_name
    }));
  };

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
      if (domainWarnings.some((warning) => warning.message.includes("Ugyldig"))) {
        throw new Error("Rett ugyldige domener før autorisasjonen opprettes.");
      }
      const response = await fetch("/api/admin/scan-authorizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, confirm_dns_warnings: confirmDnsWarnings })
      });
      const result = await response.json();
      if (!response.ok) {
        if (result.preflight) setPreflight(result.preflight);
        throw new Error(result.error || "Kunne ikke opprette autorisasjon.");
      }
      setItems((current) => [result.data, ...current]);
      setForm(initialForm);
      setPreflight(null);
      setConfirmDnsWarnings(false);
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

      <PhoenixPanel title="Ny autorisasjon" description="Koble scan til CRM først, og definer deretter scope kunden skal signere.">
        <form onSubmit={createAuthorization} className="grid gap-4 lg:grid-cols-2">
          <div className="lg:col-span-2 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-100">Koble til CRM</h3>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Field label="Velg eksisterende kunde"><SelectInput value={form.customer_id} onChange={(event) => chooseCustomer(event.target.value)} options={[{ value: "", label: "Ingen valgt" }, ...customers.map((customer) => ({ value: customer.id, label: customer.company_name || customer.name || customer.email || customer.id }))]} /></Field>
              <Field label="Velg kontaktperson"><SelectInput value={form.contact_id} onChange={(event) => update("contact_id", event.target.value)} options={[{ value: "", label: "Ingen valgt" }, ...(selectedCustomer?.contacts || []).map((contact) => ({ value: contact.id, label: contact.name || contact.email || contact.id }))]} /></Field>
              <Field label="Velg henvendelse/request"><SelectInput value={form.request_id} onChange={(event) => chooseRequest(event.target.value)} options={[{ value: "", label: "Ingen valgt" }, ...requests.map((request) => ({ value: request.id, label: request.company || request.customer_name || request.name || request.email || request.id }))]} /></Field>
              <Field label="Velg eksisterende tilbud"><SelectInput value={form.quote_id} onChange={(event) => chooseQuote(event.target.value)} options={[{ value: "", label: "Opprett nytt tilbud senere" }, ...quotes.map((quote) => ({ value: quote.id, label: quote.title || quote.customer_name || quote.company || quote.name || quote.id }))]} /></Field>
            </div>
            <div className="mt-4 grid gap-2 text-sm text-cyan-50 md:grid-cols-2">
              <p>Kunde: <span className="font-semibold">{selectedCustomer?.company_name || form.customer_name || "Ikke valgt"}</span></p>
              <p>Kontakt: <span className="font-semibold">{selectedContact?.name || form.signer_name || "Ikke valgt"}</span></p>
              <p>Request: <span className="font-semibold">{selectedRequest?.company || selectedRequest?.name || form.request_id || "Ikke valgt"}</span></p>
              <p>Tilbud: <span className="font-semibold">{selectedQuote?.title || selectedQuote?.customer_name || form.quote_id || "Opprettes senere"}</span></p>
            </div>
          </div>
          <div className="lg:col-span-2">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Autorisasjonsdetaljer</h3>
          </div>
          <Field label="Kunde/firma"><TextInput value={form.customer_name} onChange={(event) => update("customer_name", event.target.value)} required /></Field>
          <Field label="E-post til signatar"><TextInput type="email" value={form.signer_email} onChange={(event) => update("signer_email", event.target.value)} required /></Field>
          <Field label="Navn signatar"><TextInput value={form.signer_name} onChange={(event) => update("signer_name", event.target.value)} /></Field>
          <Field label="Rolle"><TextInput value={form.signer_role} onChange={(event) => update("signer_role", event.target.value)} placeholder="Daglig leder / IT-ansvarlig" /></Field>
          <Field label="Scan-type"><SelectInput value={form.scan_type} onChange={(event) => updateScanType(event.target.value)} options={scanTypes} /></Field>
          <Field label="Domener"><TextArea value={form.domains} onChange={(event) => update("domains", event.target.value)} placeholder={"hansen-it.com\nkunde.no"} /></Field>
          <Field label="IP-er i scope"><TextArea value={form.ip_addresses} onChange={(event) => update("ip_addresses", event.target.value)} placeholder={"Kun IP-er kunden eier/har samtykke til\n203.0.113.10"} /></Field>
          <Field label="Notater / begrensninger"><TextArea value={form.notes} onChange={(event) => update("notes", event.target.value)} /></Field>
          {(domainWarnings.length || preflight?.warnings?.length) ? (
            <div className="lg:col-span-2 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              <p className="font-semibold">Domain validation / DNS preflight</p>
              <div className="mt-2 space-y-2">
                {domainWarnings.map((warning) => <p key={`${warning.domain}-${warning.message}`}>{warning.domain}: {warning.message}</p>)}
                {preflight?.warnings?.map((item) => (
                  <div key={item.domain}>
                    <p className="font-semibold">{item.domain}</p>
                    {item.warnings.map((warning) => <p key={warning}>- {warning}</p>)}
                    {item.dns ? <p className="text-xs text-amber-200">DNS: A {item.dns.a?.length || 0}, AAAA {item.dns.aaaa?.length || 0}, MX {item.dns.mx?.length || 0}, NS {item.dns.ns?.length || 0}</p> : null}
                  </div>
                ))}
              </div>
              {preflight?.requiresOverride ? (
                <label className="mt-3 flex items-center gap-2 text-sm font-semibold">
                  <input type="checkbox" checked={confirmDnsWarnings} onChange={(event) => setConfirmDnsWarnings(event.target.checked)} />
                  Jeg bekrefter at scope er riktig selv om DNS-records ikke ble funnet.
                </label>
              ) : null}
            </div>
          ) : null}
          <div className="lg:col-span-2">
            <PrimaryButton disabled={saving || !configured} type="submit"><ShieldCheck size={16} />{saving ? "Oppretter..." : "Opprett autorisasjon"}</PrimaryButton>
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
