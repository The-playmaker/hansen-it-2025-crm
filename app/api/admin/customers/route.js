import { NextResponse } from "next/server";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

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
    source: clean(body.source) || "crm",
    updated_at: new Date().toISOString()
  };
}

async function loadContacts(customerIds = []) {
  if (!customerIds.length) return new Map();
  const { data, error } = await supabaseAdmin
    .from("contacts")
    .select("*")
    .in("customer_id", customerIds)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).reduce((map, contact) => {
    const list = map.get(contact.customer_id) || [];
    list.push(contact);
    map.set(contact.customer_id, list);
    return map;
  }, new Map());
}

export async function GET() {
  if (!hasSupabaseAdminConfig) {
    return NextResponse.json({ configured: false, data: [] });
  }

  const { data, error } = await supabaseAdmin
    .from("customers")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("customers read error:", error);
    return NextResponse.json({ configured: true, error: error.message, data: [] }, { status: 500 });
  }

  try {
    const contactsByCustomer = await loadContacts((data || []).map((customer) => customer.id));
    return NextResponse.json({
      configured: true,
      data: (data || []).map((customer) => ({ ...customer, contacts: contactsByCustomer.get(customer.id) || [] }))
    });
  } catch (contactError) {
    console.error("contacts read error:", contactError);
    return NextResponse.json({ configured: true, error: contactError.message, data: [] }, { status: 500 });
  }
}

export async function POST(request) {
  if (!hasSupabaseAdminConfig) {
    return NextResponse.json({ error: "Supabase er ikke konfigurert." }, { status: 503 });
  }

  const body = await request.json();
  const payload = customerPayload(body);
  if (!payload.company_name) {
    return NextResponse.json({ error: "Firmanavn er påkrevd." }, { status: 400 });
  }

  const { data: customer, error } = await supabaseAdmin
    .from("customers")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    console.error("customers insert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const contactName = clean(body.contact_name || body.contactPerson);
  const contactEmail = clean(body.contact_email || body.email);
  if (contactName || contactEmail || body.phone) {
    await supabaseAdmin.from("contacts").insert({
      customer_id: customer.id,
      name: contactName || contactEmail || payload.company_name,
      email: contactEmail || null,
      phone: clean(body.contact_phone || body.phone) || null,
      role: clean(body.contact_role) || "Hovedkontakt",
      is_primary: true
    });
  }

  const { data: contacts } = await supabaseAdmin.from("contacts").select("*").eq("customer_id", customer.id);
  return NextResponse.json({ data: { ...customer, contacts: contacts || [] } });
}
