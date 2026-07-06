"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ImagePlus, Plus, Trash2 } from "lucide-react";
import { servicePackageCategories } from "@/lib/securityScan/recommendations";
import { EmptyState, Field, formatCurrency, PhoenixPageHeader, PhoenixPanel, PrimaryButton, SecondaryButton, SelectInput, StatusBadge, TextArea, TextInput } from "@/components/phoenix/PhoenixUi";

const categoryLabels = {
  web: "Web",
  email_security: "E-postsikkerhet",
  dns_domain: "DNS/domene",
  microsoft_365: "Microsoft 365",
  security_followup: "Sikkerhetsoppfølging",
  monitoring: "Overvåking",
  support: "Support"
};

const blankItem = { title: "", description: "", quantity: 1, unit: "stk", unit_price: 0, sort_order: 0 };
const blankAsset = { type: "image", title: "", url: "", storage_path: "", alt_text: "", sort_order: 0 };

export default function ServicePackageDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [pkg, setPkg] = useState(null);
  const [form, setForm] = useState(null);
  const [itemForm, setItemForm] = useState(blankItem);
  const [assetForm, setAssetForm] = useState(blankAsset);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/service-packages/${id}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Kunne ikke hente produktpakke.");
      setPkg(result.data);
      setForm(result.data);
    } catch (err) {
      setError(err.message || "Kunne ikke hente produktpakke.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const updateForm = (patch) => setForm((current) => ({ ...current, ...patch }));

  const savePackage = async (event) => {
    event.preventDefault();
    setBusy("package");
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/service-packages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Kunne ikke lagre produktpakke.");
      setPkg(result.data);
      setForm(result.data);
      setMessage("Produktpakken er lagret.");
    } catch (err) {
      setError(err.message || "Kunne ikke lagre produktpakke.");
    } finally {
      setBusy("");
    }
  };

  const addItem = async (event) => {
    event.preventDefault();
    setBusy("item");
    setError("");
    try {
      const response = await fetch(`/api/admin/service-packages/${id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemForm)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Kunne ikke legge til linje.");
      setItemForm(blankItem);
      await load();
    } catch (err) {
      setError(err.message || "Kunne ikke legge til linje.");
    } finally {
      setBusy("");
    }
  };

  const deleteItem = async (itemId) => {
    setBusy(itemId);
    await fetch(`/api/admin/service-packages/${id}/items/${itemId}`, { method: "DELETE" });
    await load();
    setBusy("");
  };

  const addAsset = async (event) => {
    event.preventDefault();
    setBusy("asset");
    setError("");
    try {
      const response = await fetch(`/api/admin/service-packages/${id}/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assetForm)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Kunne ikke legge til asset.");
      setAssetForm(blankAsset);
      await load();
    } catch (err) {
      setError(err.message || "Kunne ikke legge til asset.");
    } finally {
      setBusy("");
    }
  };

  const deleteAsset = async (assetId) => {
    setBusy(assetId);
    await fetch(`/api/admin/service-packages/${id}/assets/${assetId}`, { method: "DELETE" });
    await load();
    setBusy("");
  };

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PhoenixPageHeader
        eyebrow="Produktpakker"
        title={pkg?.name || "Produktpakke"}
        description="Rediger tilbudsgrunnlag, pakkeinnhold og enkle design-/PDF-assets."
        action={<SecondaryButton type="button" onClick={() => router.push("/admin/service-packages")}><ArrowLeft size={16} />Tilbake</SecondaryButton>}
      />

      {loading ? <PhoenixPanel><EmptyState text="Henter produktpakke..." /></PhoenixPanel> : null}
      {error ? <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div> : null}
      {message ? <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">{message}</div> : null}

      {form ? (
        <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
          <PhoenixPanel title="Pakkeinfo" description="Dette er grunnlaget for rapportforslag og tilbudskladder.">
            <form onSubmit={savePackage} className="space-y-4">
              <Field label="Navn"><TextInput value={form.name || ""} onChange={(e) => updateForm({ name: e.target.value })} required /></Field>
              <Field label="Slug"><TextInput value={form.slug || ""} onChange={(e) => updateForm({ slug: e.target.value })} required /></Field>
              <Field label="Kategori"><SelectInput value={form.category || "support"} onChange={(e) => updateForm({ category: e.target.value })} options={servicePackageCategories.map((category) => ({ value: category, label: categoryLabels[category] || category }))} /></Field>
              <Field label="Målkunde"><TextInput value={form.target_customer || ""} onChange={(e) => updateForm({ target_customer: e.target.value })} /></Field>
              <Field label="Kort beskrivelse"><TextInput value={form.short_description || ""} onChange={(e) => updateForm({ short_description: e.target.value })} /></Field>
              <Field label="Lang beskrivelse"><TextArea value={form.long_description || ""} onChange={(e) => updateForm({ long_description: e.target.value })} /></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Pris fra"><TextInput type="number" value={form.price_from || ""} onChange={(e) => updateForm({ price_from: e.target.value })} /></Field>
                <Field label="Fastpris"><TextInput type="number" value={form.fixed_price || ""} onChange={(e) => updateForm({ fixed_price: e.target.value })} /></Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Timer min"><TextInput type="number" value={form.hourly_estimate_min || ""} onChange={(e) => updateForm({ hourly_estimate_min: e.target.value })} /></Field>
                <Field label="Timer maks"><TextInput type="number" value={form.hourly_estimate_max || ""} onChange={(e) => updateForm({ hourly_estimate_max: e.target.value })} /></Field>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-200">
                <input type="checkbox" checked={form.is_active !== false} onChange={(e) => updateForm({ is_active: e.target.checked })} />
                Aktiv pakke
              </label>
              <PrimaryButton type="submit" disabled={busy === "package"}>{busy === "package" ? "Lagrer..." : "Lagre pakke"}</PrimaryButton>
            </form>
          </PhoenixPanel>

          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <PhoenixPanel title="Kategori"><StatusBadge>{categoryLabels[pkg.category] || pkg.category}</StatusBadge></PhoenixPanel>
              <PhoenixPanel title="Pris"><p className="text-2xl font-bold text-white">{formatCurrency(pkg.fixed_price || pkg.price_from || 0)}</p></PhoenixPanel>
              <PhoenixPanel title="Timer"><p className="text-2xl font-bold text-white">{pkg.hourly_estimate_min || "-"}-{pkg.hourly_estimate_max || "-"}</p></PhoenixPanel>
            </div>

            <PhoenixPanel title="Pakkelinjer" description="Linjer kan brukes som tilbudslinjer eller PDF-innhold.">
              <form onSubmit={addItem} className="mb-4 grid gap-3 lg:grid-cols-[1fr_1fr_80px_80px_110px_auto]">
                <TextInput placeholder="Tittel" value={itemForm.title} onChange={(e) => setItemForm({ ...itemForm, title: e.target.value })} required />
                <TextInput placeholder="Beskrivelse" value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} />
                <TextInput type="number" placeholder="Ant." value={itemForm.quantity} onChange={(e) => setItemForm({ ...itemForm, quantity: e.target.value })} />
                <TextInput placeholder="Enhet" value={itemForm.unit} onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })} />
                <TextInput type="number" placeholder="Pris" value={itemForm.unit_price} onChange={(e) => setItemForm({ ...itemForm, unit_price: e.target.value })} />
                <PrimaryButton type="submit" disabled={busy === "item"}><Plus size={16} />Legg til</PrimaryButton>
              </form>
              <div className="space-y-2">
                {pkg.service_package_items?.length ? pkg.service_package_items.sort((a, b) => a.sort_order - b.sort_order).map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/45 p-3">
                    <div>
                      <p className="font-semibold text-white">{item.title}</p>
                      <p className="text-sm text-slate-400">{item.description || "-"} · {item.quantity} {item.unit} · {formatCurrency(item.unit_price)}</p>
                    </div>
                    <button type="button" onClick={() => deleteItem(item.id)} disabled={Boolean(busy)} className="rounded-xl border border-rose-400/30 px-3 py-2 text-sm text-rose-200 hover:bg-rose-500/10"><Trash2 size={15} /></button>
                  </div>
                )) : <EmptyState text="Ingen pakkelinjer ennå." />}
              </div>
            </PhoenixPanel>

            <PhoenixPanel title="Assets" description="Enkel foundation for design-preview, før/etter-bilder, webside-eksempler, PDF-illustrasjoner og kundeportal.">
              <form onSubmit={addAsset} className="mb-4 grid gap-3 lg:grid-cols-[110px_1fr_1fr_1fr_auto]">
                <SelectInput value={assetForm.type} onChange={(e) => setAssetForm({ ...assetForm, type: e.target.value })} options={["image", "preview", "pdf", "link"]} />
                <TextInput placeholder="Tittel" value={assetForm.title} onChange={(e) => setAssetForm({ ...assetForm, title: e.target.value })} />
                <TextInput placeholder="URL" value={assetForm.url} onChange={(e) => setAssetForm({ ...assetForm, url: e.target.value })} />
                <TextInput placeholder="Alt-tekst" value={assetForm.alt_text} onChange={(e) => setAssetForm({ ...assetForm, alt_text: e.target.value })} />
                <PrimaryButton type="submit" disabled={busy === "asset"}><ImagePlus size={16} />Legg til</PrimaryButton>
              </form>
              <div className="space-y-2">
                {pkg.service_package_assets?.length ? pkg.service_package_assets.sort((a, b) => a.sort_order - b.sort_order).map((asset) => (
                  <div key={asset.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/45 p-3">
                    <div>
                      <p className="font-semibold text-white">{asset.title || asset.type}</p>
                      <p className="text-sm text-slate-400">{asset.url || asset.storage_path} · {asset.alt_text || "Ingen alt-tekst"}</p>
                    </div>
                    <div className="flex gap-2">
                      {asset.url ? <Link href={asset.url} target="_blank" className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white hover:bg-white/10">Åpne</Link> : null}
                      <button type="button" onClick={() => deleteAsset(asset.id)} disabled={Boolean(busy)} className="rounded-xl border border-rose-400/30 px-3 py-2 text-sm text-rose-200 hover:bg-rose-500/10"><Trash2 size={15} /></button>
                    </div>
                  </div>
                )) : <EmptyState text="Ingen assets ennå." />}
              </div>
            </PhoenixPanel>
          </div>
        </div>
      ) : null}
    </div>
  );
}
