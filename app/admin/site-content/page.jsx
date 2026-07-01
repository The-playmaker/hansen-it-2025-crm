"use client";

export const dynamic = "force-dynamic";

import { Plus, Save, Trash2 } from "lucide-react";
import { phoenixSiteContentFallback } from "@/lib/phoenixMockData";
import { usePhoenixData } from "@/components/phoenix/usePhoenixData";
import { Field, PhoenixPageHeader, PhoenixPanel, PrimaryButton, SecondaryButton, TextArea, TextInput } from "@/components/phoenix/PhoenixUi";

const emptyService = () => ({
  title: "",
  description: "",
  href: ""
});

function normalizeContent(content = {}) {
  return {
    ...phoenixSiteContentFallback,
    ...content,
    services: Array.isArray(content.services) && content.services.length ? content.services : phoenixSiteContentFallback.services
  };
}

export default function SiteContentPage() {
  const { data, setData } = usePhoenixData();
  const content = normalizeContent(data.siteContent);

  const updateField = (field, value) => {
    setData((current) => ({
      ...current,
      siteContent: normalizeContent({ ...current.siteContent, [field]: value })
    }));
  };

  const updateService = (index, patch) => {
    setData((current) => {
      const currentContent = normalizeContent(current.siteContent);
      const services = currentContent.services.map((service, serviceIndex) => (
        serviceIndex === index ? { ...service, ...patch } : service
      ));
      return { ...current, siteContent: { ...currentContent, services } };
    });
  };

  const addService = () => {
    setData((current) => {
      const currentContent = normalizeContent(current.siteContent);
      return { ...current, siteContent: { ...currentContent, services: [...currentContent.services, emptyService()] } };
    });
  };

  const removeService = (index) => {
    setData((current) => {
      const currentContent = normalizeContent(current.siteContent);
      const services = currentContent.services.filter((_, serviceIndex) => serviceIndex !== index);
      return { ...current, siteContent: { ...currentContent, services: services.length ? services : [emptyService()] } };
    });
  };

  const resetContent = () => {
    setData((current) => ({ ...current, siteContent: phoenixSiteContentFallback }));
  };

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PhoenixPageHeader
        title="Nettsideinnhold"
        description="Enkel CMS-modul for Hansen IT-nettsiden. Innholdet lagres foreløpig i Phoenix localStorage; Supabase-tabell kobles på senere."
        action={<SecondaryButton type="button" onClick={resetContent}>Tilbakestill mock</SecondaryButton>}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-6">
          <PhoenixPanel title="Forside hero" description="Teksten som møter brukeren øverst på hansen-it.com.">
            <div className="space-y-4">
              <Field label="Hero title">
                <TextInput value={content.heroTitle} onChange={(event) => updateField("heroTitle", event.target.value)} />
              </Field>
              <Field label="Hero subtitle">
                <TextArea value={content.heroSubtitle} onChange={(event) => updateField("heroSubtitle", event.target.value)} />
              </Field>
              <Field label="CTA tekst">
                <TextInput value={content.ctaText} onChange={(event) => updateField("ctaText", event.target.value)} />
              </Field>
            </div>
          </PhoenixPanel>

          <PhoenixPanel
            title="Tjenester / seksjoner"
            description="Korte seksjoner til forsiden. Bruk vanlig tekst nå; rich editor kommer ikke i denne versjonen."
          >
            <div className="space-y-3">
              {content.services.map((service, index) => (
                <div key={`${service.title}-${index}`} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                  <div className="grid gap-3 lg:grid-cols-[1fr_1fr_160px_44px]">
                    <Field label="Tittel">
                      <TextInput value={service.title} onChange={(event) => updateService(index, { title: event.target.value })} />
                    </Field>
                    <Field label="Beskrivelse">
                      <TextInput value={service.description} onChange={(event) => updateService(index, { description: event.target.value })} />
                    </Field>
                    <Field label="Lenke">
                      <TextInput value={service.href || ""} placeholder="/contact" onChange={(event) => updateService(index, { href: event.target.value })} />
                    </Field>
                    <button type="button" onClick={() => removeService(index)} className="mt-6 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-rose-400/30 text-rose-200 hover:bg-rose-500/10" title="Fjern seksjon">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <SecondaryButton type="button" onClick={addService}><Plus size={16} />Legg til seksjon</SecondaryButton>
            </div>
          </PhoenixPanel>

          <PhoenixPanel title="Om, kontakt og SEO">
            <div className="space-y-4">
              <Field label="Om oss tekst">
                <TextArea value={content.aboutText} onChange={(event) => updateField("aboutText", event.target.value)} />
              </Field>
              <Field label="Kontakttekst">
                <TextArea value={content.contactText} onChange={(event) => updateField("contactText", event.target.value)} />
              </Field>
              <Field label="SEO title">
                <TextInput value={content.seoTitle} onChange={(event) => updateField("seoTitle", event.target.value)} />
              </Field>
              <Field label="SEO description">
                <TextArea value={content.seoDescription} onChange={(event) => updateField("seoDescription", event.target.value)} />
              </Field>
            </div>
          </PhoenixPanel>
        </div>

        <PhoenixPanel title="Forhåndsvisning" description="En enkel lesbar sjekk av innholdet som API-et skal levere.">
          <div className="space-y-5 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Hero</p>
              <h2 className="mt-2 text-2xl font-bold text-white">{content.heroTitle}</h2>
              <p className="mt-2 text-sm text-slate-300">{content.heroSubtitle}</p>
              <p className="mt-3 inline-flex rounded-xl bg-cyan-400 px-3 py-2 text-sm font-bold text-slate-950">{content.ctaText}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Tjenester</p>
              <div className="mt-2 space-y-2">
                {content.services.map((service, index) => (
                  <div key={`${service.title}-preview-${index}`} className="rounded-xl border border-white/10 p-3">
                    <p className="font-semibold text-white">{service.title || "Uten tittel"}</p>
                    <p className="mt-1 text-sm text-slate-400">{service.description || "Ingen beskrivelse"}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Om / kontakt</p>
              <p className="mt-2 text-sm text-slate-300">{content.aboutText}</p>
              <p className="mt-2 text-sm text-slate-300">{content.contactText}</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-500"><Save className="mr-1 inline h-3 w-3" />Endringer lagres automatisk lokalt i nettleseren.</p>
        </PhoenixPanel>
      </div>
    </div>
  );
}
