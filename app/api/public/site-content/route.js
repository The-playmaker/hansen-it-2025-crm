import { NextResponse } from "next/server";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabaseAdmin";
import { phoenixSiteContentFallback } from "@/lib/phoenixMockData";

export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin": process.env.CRM_SITE_CONTENT_ALLOWED_ORIGIN || "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function json(body, init = {}) {
  return NextResponse.json(body, { ...init, headers: { ...corsHeaders, ...(init.headers || {}) } });
}

function normalizeService(service = {}) {
  return {
    title: String(service.title || service.name || "").trim(),
    description: String(service.description || service.short_description || "").trim(),
    href: String(service.href || "").trim()
  };
}

function normalizeSiteContent(row = {}) {
  const source = row.content && typeof row.content === "object" ? row.content : row;
  const services = Array.isArray(source.services)
    ? source.services.map(normalizeService).filter((service) => service.title || service.description)
    : [];

  return {
    heroTitle: source.heroTitle || source.hero_title || "",
    heroSubtitle: source.heroSubtitle || source.hero_subtitle || "",
    ctaText: source.ctaText || source.cta_text || "",
    services,
    aboutText: source.aboutText || source.about_text || "",
    contactText: source.contactText || source.contact_text || "",
    seoTitle: source.seoTitle || source.seo_title || "",
    seoDescription: source.seoDescription || source.seo_description || ""
  };
}

function isMissingTableError(error) {
  const text = `${error?.code || ""} ${error?.message || ""}`.toLowerCase();
  return text.includes("42p01") || text.includes("does not exist") || text.includes("relation") || text.includes("schema cache");
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
  if (!hasSupabaseAdminConfig) {
    return json({ status: "demo", configured: false, content: phoenixSiteContentFallback, message: "Demo mode: Supabase er ikke konfigurert." });
  }

  const { data, error } = await supabaseAdmin
    .from("phoenix_site_content")
    .select("*")
    .eq("key", "homepage")
    .eq("page", "home")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("phoenix_site_content read error:", error);
    return json({
      status: isMissingTableError(error) ? "not_configured" : "error",
      configured: true,
      content: null,
      message: isMissingTableError(error)
        ? "phoenix_site_content-tabellen finnes ikke. TODO: opprett tabellen før produksjonsinnhold vises."
        : "Kunne ikke hente nettsideinnhold fra Supabase."
    }, { status: isMissingTableError(error) ? 501 : 500 });
  }

  if (!data) {
    return json({ status: "not_configured", configured: true, content: null, message: "phoenix_site_content er tom. TODO: legg inn første innholdsrad." }, { status: 501 });
  }

  return json({ status: "ok", configured: true, content: normalizeSiteContent(data) });
}

