"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PackagePlus } from "lucide-react";
import { servicePackageCategories } from "@/lib/securityScan/recommendations";
import { EmptyState, Field, formatCurrency, PhoenixPageHeader, PhoenixPanel, PrimaryButton, RecordCard, SelectInput, StatusBadge, TextArea, TextInput } from "@/components/phoenix/PhoenixUi";

const blank = {
  name: "",
  slug: "",
  category: "support",
  short_description: "",
  long_description: "",
  target_customer: "",
  price_from: "",
  fixed_price: "",
  hourly_estimate_min: "",
  hourly_estimate_max: "",
  is_active: true
};

const categoryLabels = {
  web: "Web",
  email_security: "E-postsikkerhet",
  dns_domain: "DNS/domene",
  microsoft_365: "Microsoft 365",
  security_followup: "Sikkerhetsoppfølging",
  monitoring: "Overvåking",
  support: "Support"
};

function slugify(value) {
  return String(value || "").toLowerCase().replace(/æ/g, "ae").replace(/ø/g, "o").replace(/å/g, "a").replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
}

export default function ServicePackagesPage() {
  const [packages, setPackages] = useState([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(blank);
  const [filter, setFilter] = useState("alle");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/service-packages", { cache: "no-store" });
      const result = await response.json();
      setConfigured(result.configured !== false);
      if (!response.ok) throw new Error(result.error || "Kunne ikke hente produktpakker.");
      setPackages(result.data || []);
    } catch (err) {
      setError(err.message || "Kunne ikke hente produktpakker.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (filter === "alle") return packages;
    return packages.filter((pkg) => pkg.category === filter);
  }, [packages, filter]);

  const updateForm = (patch) => setForm((current) => ({ ...current, ...patch }));

  const save = async (event) => {
    event.preventDefault();
    setError("");
    const payload = { ...form, slug: form.slug || slugify(form.name) };
    const response = await fetch("/api/admin/service-packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error || "Kunne ikke opprette produktpakke.");
      return;
    }
    setPackages((current) => [result.data, ...current]);
    setForm(blank);
  };

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PhoenixPageHeader
        eyebrow="CRM"
        title="Produktpakker"
        description="Service Packages brukes til rapportforslag, tilbudskladder, webpakker og fremtidige kundeportal-/PDF-visninger."
      />

      {!configured ? <PhoenixPanel title="Ikke konfigurert" description="Supabase-tabellene service_packages, service_package_items og service_package_assets mangler eller miljøvariabler er ikke satt." /> : null}
      {error ? <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <PhoenixPanel title="Ny produktpakke" description="Hold pakken enkel nok til at den kan bli en tilbudslinje.">
          <form onSubmit={save} className="space-y-4">
            <Field label="Navn"><TextInput value={form.name} onChange={(e) => updateForm({ name: e.target.value, slug: form.slug || slugify(e.target.value) })} required /></Field>
            <Field label="Slug"><TextInput value={form.slug} onChange={(e) => updateForm({ slug: slugify(e.target.value) })} required /></Field>
            <Field label="Kategori">
              <SelectInput value={form.category} onChange={(e) => updateForm({ category: e.target.value })} options={servicePackageCategories.map((category) => ({ value: category, label: categoryLabels[category] || category }))} />
            </Field>
            <Field label="Kort beskrivelse"><TextInput value={form.short_description} onChange={(e) => updateForm({ short_description: e.target.value })} /></Field>
            <Field label="Lang beskrivelse"><TextArea value={form.long_description} onChange={(e) => updateForm({ long_description: e.target.value })} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Pris fra"><TextInput type="number" value={form.price_from} onChange={(e) => updateForm({ price_from: e.target.value })} /></Field>
              <Field label="Fastpris"><TextInput type="number" value={form.fixed_price} onChange={(e) => updateForm({ fixed_price: e.target.value })} /></Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Timer min"><TextInput type="number" value={form.hourly_estimate_min} onChange={(e) => updateForm({ hourly_estimate_min: e.target.value })} /></Field>
              <Field label="Timer maks"><TextInput type="number" value={form.hourly_estimate_max} onChange={(e) => updateForm({ hourly_estimate_max: e.target.value })} /></Field>
            </div>
            <PrimaryButton type="submit"><PackagePlus size={16} />Opprett pakke</PrimaryButton>
          </form>
        </PhoenixPanel>

        <PhoenixPanel title="Pakker" description="Standardpakker seeds via Supabase migration. Du kan justere dem fra detaljsiden.">
          <div className="mb-4 max-w-xs">
            <SelectInput value={filter} onChange={(e) => setFilter(e.target.value)} options={[{ value: "alle", label: "Alle kategorier" }, ...servicePackageCategories.map((category) => ({ value: category, label: categoryLabels[category] || category }))]} />
          </div>
          {loading ? <EmptyState text="Henter produktpakker..." /> : (
            <div className="grid gap-3 lg:grid-cols-2">
              {filtered.length ? filtered.map((pkg) => (
                <RecordCard key={pkg.id} title={pkg.name} meta={`${categoryLabels[pkg.category] || pkg.category} - ${formatCurrency(pkg.fixed_price || pkg.price_from || 0)}${pkg.fixed_price ? "" : " fra"}`} badge={pkg.is_active ? "aktiv" : "inaktiv"}>
                  <p>{pkg.short_description || pkg.long_description || "Ingen beskrivelse."}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={`/admin/service-packages/${pkg.id}`} className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">Åpne</Link>
                    <StatusBadge>{pkg.service_package_items?.length || 0} linjer</StatusBadge>
                    <StatusBadge>{pkg.service_package_assets?.length || 0} assets</StatusBadge>
                  </div>
                </RecordCard>
              )) : <EmptyState text="Ingen produktpakker i dette filteret." />}
            </div>
          )}
        </PhoenixPanel>
      </div>
    </div>
  );
}
