import { NextResponse } from "next/server";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabaseAdmin";
import { phoenixSiteContentFallback } from "@/lib/phoenixMockData";

export const dynamic = "force-dynamic";

function isMissingTableError(error) {
  const text = `${error?.code || ""} ${error?.message || ""}`.toLowerCase();
  return text.includes("42p01") || text.includes("does not exist") || text.includes("relation") || text.includes("schema cache");
}

function normalizeContent(content = {}) {
  return {
    heroTitle: String(content.heroTitle || "").trim(),
    heroSubtitle: String(content.heroSubtitle || "").trim(),
    ctaText: String(content.ctaText || "").trim(),
    services: Array.isArray(content.services) ? content.services.map((service) => ({
      title: String(service.title || "").trim(),
      description: String(service.description || "").trim(),
      href: String(service.href || "").trim()
    })) : [],
    aboutText: String(content.aboutText || "").trim(),
    contactText: String(content.contactText || "").trim(),
    seoTitle: String(content.seoTitle || "").trim(),
    seoDescription: String(content.seoDescription || "").trim()
  };
}

async function readCurrent() {
  const { data, error } = await supabaseAdmin
    .from("phoenix_site_content")
    .select("*")
    .eq("key", "homepage")
    .eq("page", "home")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return { data, error };
}

export async function GET() {
  if (!hasSupabaseAdminConfig) {
    return NextResponse.json({ status: "demo", configured: false, content: phoenixSiteContentFallback, message: "Demo mode: Supabase er ikke konfigurert." });
  }

  const { data, error } = await readCurrent();
  if (error) {
    return NextResponse.json({ status: isMissingTableError(error) ? "table_missing" : "error", configured: true, content: null, message: isMissingTableError(error) ? "phoenix_site_content-tabellen mangler. TODO: opprett tabellen." : error.message }, { status: isMissingTableError(error) ? 501 : 500 });
  }

  if (!data) {
    return NextResponse.json({ status: "empty", configured: true, content: null, message: "phoenix_site_content er tom. Legg inn første innholdsrad og trykk Lagre." });
  }

  return NextResponse.json({ status: "ok", configured: true, content: normalizeContent(data.content || data) });
}

export async function PATCH(request) {
  if (!hasSupabaseAdminConfig) {
    return NextResponse.json({ error: "Supabase er ikke konfigurert." }, { status: 503 });
  }

  const body = await request.json();
  const content = normalizeContent(body.content || body);
  const current = await readCurrent();

  if (current.error) {
    return NextResponse.json({ error: isMissingTableError(current.error) ? "phoenix_site_content-tabellen mangler." : current.error.message }, { status: isMissingTableError(current.error) ? 501 : 500 });
  }

  const query = current.data?.id
    ? supabaseAdmin.from("phoenix_site_content").update({ key: "homepage", title: "Hansen IT hjemmeside", content, section: "home", page: "home", updated_at: new Date().toISOString() }).eq("id", current.data.id).select("*").single()
    : supabaseAdmin.from("phoenix_site_content").insert({ key: "homepage", title: "Hansen IT hjemmeside", content, section: "home", page: "home" }).select("*").single();

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ status: "ok", content: normalizeContent(data.content || data) });
}

