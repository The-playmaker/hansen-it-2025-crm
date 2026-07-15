"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { phoenixSiteContentFallback } from "@/lib/phoenixMockData";
import { EmptyState, Field, PhoenixPageHeader, PhoenixPanel, PrimaryButton, SecondaryButton, TextArea, TextInput } from "@/components/phoenix/PhoenixUi";

const emptyService = () => ({ title: "", description: "", href: "", features: [] });
const emptyContent = {
  heroTitle: "",
  heroSubtitle: "",
  ctaText: "",
  services: [emptyService()],
  aboutText: "",
  contactText: "",
  seoTitle: "",
  seoDescription: ""
};

function normalizeContent(content = {}, useFallback = false) {
  return {
    ...(useFallback ? phoenixSiteContentFallback : emptyContent),
    ...content,
    services: Array.isArray(content.services) && content.services.length
      ? content.services.map((service) => ({
        title: service.title || service.name || "",
        description: service.description || service.short_description || "",
        href: service.href || "",
        features: Array.isArray(service.features) ? service.features : []
      }))
      : [emptyService()]
  };
}

export default function SiteContentPage() {
  const [content, setContent] = useState(normalizeContent());
  const [mode, setMode] = useState("loading");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadContent() {
      try {
        const response = await fetch("/api/admin/site-content", { cache: "no-store" });
        const result = await response.json();
        if (cancelled) return;
        setMode(result.status || (response.ok ? "ok" : "error"));
        setMessage(result.message || "");
        if (result.content) setContent(normalizeContent(result.content, result.status === "demo"));
        else if (result.status === "empty") setContent(normalizeContent());
      } catch (error) {
        if (!cancelled) {
          setMode("error");
          setMessage(error.message || "Kunne ikke hente nettsideinnhold.");
        }
      }
    }
    loadContent();
    return () => { cancelled = true; };
  }, []);

  const updateField = (field, value) => setContent((current) => ({ ...current, [field]: value }));
  const updateService = (index, patch) => setContent((current) => ({
    ...current,
    services: current.services.map((service, serviceIndex) => serviceIndex === index ? { ...service, ...patch } : service)
  }));
  const addService = () => setContent((current) => ({ ...current, services: [...current.services, emptyService()] }));
  const removeService = (index) => setContent((current) => {
    const services = current.services.filter((_, serviceIndex) => serviceIndex !== index);
    return { ...current, services: services.length ? services : [emptyService()] };
  });

  const save = async () => {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/site-content", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Kunne ikke lagre nettsideinnhold.");
      setMode("ok");
      setContent(normalizeContent(result.content));
      setMessage("Lagret i Supabase.");
    } catch (error) {
      setMessage(error.message || "Kunne ikke lagre nettsideinnhold.");
    } finally {
      setSaving(false);
    }
  };

  const readOnly = mode === "table_missing" || mode === "error" || mode === "loading";
  const isDemo = mode === "demo";

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PhoenixPageHeader
        title="Nettsideinnhold"
        description="CMS-innhold hentes fra Supabase-tabellen phoenix_site_content. Local fallback brukes bare i demo mode uten Supabase env."
        action={<PrimaryButton type="button" onClick={save} disabled={saving || readOnly || isDemo}><Save size={16} />{saving ? "Lagrer..." : "Lagre"}</PrimaryButton>}
      />

      {mode === "loading" ? <PhoenixPanel><EmptyState text="Henter nettsideinnhold..." /></PhoenixPanel> : null}
      {isDemo ? <PhoenixPanel title="Demo mode" description="Supabase er ikke konfigurert. Viser lokal fallback, men lagrer ikke produksjonsinnhold." /> : null}
      {mode === "table_missing" ? <PhoenixPanel title="Ikke konfigurert" description={message || "TODO: Opprett phoenix_site_content i Supabase før produksjonsinnhold vises."}><EmptyState text="Ingen fiktiv produksjonsdata vises når Supabase er konfigurert men tabellen mangler." /></PhoenixPanel> : null}
      {mode === "empty" ? <PhoenixPanel title="Klar for første innholdsrad" description={message || "Fyll inn feltene og trykk Lagre. Ingen fiktiv produksjonsdata vises."} /> : null}
      {mode === "error" ? <PhoenixPanel title="Feil"><div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">{message}</div></PhoenixPanel> : null}
      {message && ["ok"].includes(mode) ? <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">{message}</div> : null}

      {!readOnly ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-6">
            <PhoenixPanel title="Forside hero">
              <div className="space-y-4">
                <Field label="Hero title"><TextInput value={content.heroTitle} onChange={(event) => updateField("heroTitle", event.target.value)} /></Field>
                <Field label="Hero subtitle"><TextArea value={content.heroSubtitle} onChange={(event) => updateField("heroSubtitle", event.target.value)} /></Field>
                <Field label="CTA tekst"><TextInput value={content.ctaText} onChange={(event) => updateField("ctaText", event.target.value)} /></Field>
              </div>
            </PhoenixPanel>

            <PhoenixPanel title="Tjenester / seksjoner">
              <div className="space-y-3">
                {content.services.map((service, index) => (
                  <div key={`${service.title}-${index}`} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                    <div className="grid gap-3 lg:grid-cols-[1fr_1fr_160px_44px]">
                      <Field label="Tittel"><TextInput value={service.title} onChange={(event) => updateService(index, { title: event.target.value })} /></Field>
                      <Field label="Beskrivelse"><TextInput value={service.description} onChange={(event) => updateService(index, { description: event.target.value })} /></Field>
                      <Field label="Lenke"><TextInput value={service.href || ""} placeholder="/contact" onChange={(event) => updateService(index, { href: event.target.value })} /></Field>
                      <button type="button" onClick={() => removeService(index)} className="mt-6 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-rose-400/30 text-rose-200 hover:bg-rose-500/10" title="Fjern seksjon"><Trash2 size={16} /></button>
                    </div>
                    <div className="mt-3">
                      <Field label="Punkter / features (én per linje)">
                        <TextArea
                          value={(service.features || []).join("\n")}
                          onChange={(event) => updateService(index, { features: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean) })}
                          placeholder={"Brannmur\nEndpoint-beskyttelse\nBackup"}
                        />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4"><SecondaryButton type="button" onClick={addService}><Plus size={16} />Legg til seksjon</SecondaryButton></div>
            </PhoenixPanel>

            <PhoenixPanel title="Om, kontakt og SEO">
              <div className="space-y-4">
                <Field label="Om oss tekst"><TextArea value={content.aboutText} onChange={(event) => updateField("aboutText", event.target.value)} /></Field>
                <Field label="Kontakttekst"><TextArea value={content.contactText} onChange={(event) => updateField("contactText", event.target.value)} /></Field>
                <Field label="SEO title"><TextInput value={content.seoTitle} onChange={(event) => updateField("seoTitle", event.target.value)} /></Field>
                <Field label="SEO description"><TextArea value={content.seoDescription} onChange={(event) => updateField("seoDescription", event.target.value)} /></Field>
              </div>
            </PhoenixPanel>
          </div>

          <PhoenixPanel title="Forhåndsvisning">
            <div className="space-y-5 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
              <div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Hero</p><h2 className="mt-2 text-2xl font-bold text-white">{content.heroTitle}</h2><p className="mt-2 text-sm text-slate-300">{content.heroSubtitle}</p></div>
              <div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Tjenester</p><div className="mt-2 space-y-2">{content.services.map((service, index) => <div key={`${service.title}-preview-${index}`} className="rounded-xl border border-white/10 p-3"><p className="font-semibold text-white">{service.title || "Uten tittel"}</p><p className="mt-1 text-sm text-slate-400">{service.description || "Ingen beskrivelse"}</p>{service.features?.length ? <ul className="mt-2 space-y-1 text-xs text-cyan-200">{service.features.map((feature) => <li key={feature}>✓ {feature}</li>)}</ul> : null}</div>)}</div></div>
            </div>
          </PhoenixPanel>
        </div>
      ) : null}
    </div>
  );
}
