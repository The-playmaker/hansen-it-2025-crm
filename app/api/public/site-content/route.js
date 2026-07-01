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
    : phoenixSiteContentFallback.services;

  return {
    ...phoenixSiteContentFallback,
    heroTitle: source.heroTitle || source.hero_title || phoenixSiteContentFallback.heroTitle,
    heroSubtitle: source.heroSubtitle || source.hero_subtitle || phoenixSiteContentFallback.heroSubtitle,
    ctaText: source.ctaText || source.cta_text || phoenixSiteContentFallback.ctaText,
    services,
    aboutText: source.aboutText || source.about_text || phoenixSiteContentFallback.aboutText,
    contactText: source.contactText || source.contact_text || phoenixSiteContentFallback.contactText,
    seoTitle: source.seoTitle || source.seo_title || phoenixSiteContentFallback.seoTitle,
    seoDescription: source.seoDescription || source.seo_description || phoenixSiteContentFallback.seoDescription
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
  if (!hasSupabaseAdminConfig) {
    return json({ status: "fallback", content: phoenixSiteContentFallback });
  }

  const { data, error } = await supabaseAdmin
    .from("phoenix_site_content")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("phoenix_site_content read error:", error);
    return json({ status: "fallback", content: phoenixSiteContentFallback });
  }

  return json({ status: "ok", content: normalizeSiteContent(data) });
}
