import { NextResponse } from "next/server";
import { requireAdmin, adminErrorResponse } from "@/lib/auth/requireAdmin";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const auth = await requireAdmin();
  if (!auth.ok) return adminErrorResponse(auth);

  if (!hasSupabaseAdminConfig) return NextResponse.json({ configured: false, data: [] });
  const url = new URL(req.url);
  const search = (url.searchParams.get("search") || "").trim();
  const table = (url.searchParams.get("table") || "").trim();

  if (table === "quotes") {
    let quoteQuery = supabaseAdmin
      .from("quotes")
      .select("*, customer:customers(id,company_name,email), contact:contacts(id,name,email)")
      .order("created_at", { ascending: false })
      .limit(200);

    if (search) quoteQuery = quoteQuery.or(`title.ilike.%${search}%,description.ilike.%${search}%`);

    const { data, error } = await quoteQuery;
    if (error) return NextResponse.json({ configured: true, error: error.message, data: [] }, { status: 500 });
    return NextResponse.json({ configured: true, data: data || [] });
  }

  let query = supabaseAdmin
    .from("requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,company.ilike.%${search}%,id::text.ilike.%${search}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ configured: true, error: error.message, data: [] }, { status: 500 });
  return NextResponse.json({ configured: true, data: data || [] });
}

export async function POST(request) {
  const auth = await requireAdmin({ minRole: "employee" });
  if (!auth.ok) return adminErrorResponse(auth);

  if (!hasSupabaseAdminConfig) return NextResponse.json({ error: "Supabase er ikke konfigurert." }, { status: 503 });
  const body = await request.json();
  if (!body.name && !body.company) return NextResponse.json({ error: "Kunde/firma er påkrevd." }, { status: 400 });

  const payload = {
    name: body.name || body.company,
    customer_name: body.company || body.name || null,
    company: body.company || null,
    email: body.email || null,
    phone: body.phone || null,
    message: body.message || body.description || "Tilbud opprettet i Phoenix CRM.",
    priority: body.priority || "normal",
    status: body.status || "kladd"
  };

  if (body.customer_id) payload.customer_id = body.customer_id;
  if (body.contact_id) payload.contact_id = body.contact_id;
  if (body.lead_id) payload.lead_id = body.lead_id;
  if (body.source_request_id) payload.source_request_id = body.source_request_id;

  const { data, error } = await supabaseAdmin
    .from("requests")
    .insert(payload)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
