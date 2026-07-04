import { NextResponse } from "next/server";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

function clean(value) {
  return String(value || "").trim();
}

function customerPayload(body = {}) {
  return {
    company_name: clean(body.company_name || body.companyName),
    organization_number: clean(body.organization_number) || null,
    email: clean(body.email) || null,
    phone: clean(body.phone) || null,
    website: clean(body.website) || null,
    address: clean(body.address) || null,
    customer_type: clean(body.customer_type || body.customerType) || null,
    status: clean(body.status) || "lead",
    notes: clean(body.notes) || null,
    updated_at: new Date().toISOString()
  };
}

async function loadRelated(customerId) {
  const [contacts, requests, leads, quotes, tasks] = await Promise.all([
    supabaseAdmin.from("contacts").select("*").eq("customer_id", customerId).order("created_at", { ascending: false }),
    supabaseAdmin.from("requests").select("*").eq("customer_id", customerId).order("created_at", { ascending: false }),
    supabaseAdmin.from("leads").select("*").eq("customer_id", customerId).order("created_at", { ascending: false }),
    supabaseAdmin.from("requests").select("*").eq("customer_id", customerId).order("created_at", { ascending: false }),
    supabaseAdmin.from("tasks").select("*").eq("customer_id", customerId).order("created_at", { ascending: false })
  ]);

  return {
    contacts: contacts.data || [],
    requests: requests.data || [],
    leads: leads.data || [],
    quotes: quotes.data || [],
    tasks: tasks.data || [],
    errors: [contacts.error, requests.error, leads.error, quotes.error, tasks.error].filter(Boolean)
  };
}

export async function GET(_request, { params }) {
  if (!hasSupabaseAdminConfig) {
    return NextResponse.json({ configured: false, data: null });
  }

  const { data: customer, error } = await supabaseAdmin
    .from("customers")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  const related = await loadRelated(params.id);
  if (related.errors.length) {
    console.error("customer related read errors:", related.errors);
  }

  return NextResponse.json({ configured: true, data: { ...customer, ...related } });
}

export async function PATCH(request, { params }) {
  if (!hasSupabaseAdminConfig) {
    return NextResponse.json({ error: "Supabase er ikke konfigurert." }, { status: 503 });
  }

  const body = await request.json();
  const payload = customerPayload(body);
  if (!payload.company_name) {
    return NextResponse.json({ error: "Firmanavn er påkrevd." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("customers")
    .update(payload)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) {
    console.error("customers update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function DELETE() {
  return NextResponse.json({ error: "Sletting er deaktivert. Sett kunden til inaktiv i stedet." }, { status: 405 });
}
