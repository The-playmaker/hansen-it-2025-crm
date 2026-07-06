import { NextResponse } from "next/server";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

function clean(value) {
  return String(value || "").trim();
}

function customerNameFromRequest(request) {
  return clean(request.company) ||
    clean(request.customer_name) ||
    clean(request.name) ||
    clean(request.email) ||
    "Ukjent kunde";
}

function contactNameFromRequest(request) {
  return clean(request.name) || clean(request.email) || "Ukjent kontakt";
}

async function findOrCreateCustomer(request) {
  const customerName = customerNameFromRequest(request);
  const email = clean(request.email);

  let query = supabaseAdmin.from("customers").select("*").limit(1);
  if (clean(request.company)) query = query.ilike("company_name", clean(request.company));
  else if (email) query = query.eq("email", email);
  else query = query.eq("company_name", customerName);

  const { data: existing, error: findError } = await query.maybeSingle();
  if (findError) throw findError;
  if (existing) return existing;

  const { data, error } = await supabaseAdmin
    .from("customers")
    .insert({
      name: customerName,
      company_name: customerName,
      email: email || null,
      phone: clean(request.phone) || null,
      status: "lead",
      source: "requests",
      notes: request.message || request.description || null
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

async function findOrCreateContact(request, customerId) {
  const email = clean(request.email);
  const name = contactNameFromRequest(request);

  let query = supabaseAdmin.from("contacts").select("*").eq("customer_id", customerId).limit(1);
  if (email) query = query.eq("email", email);
  else query = query.ilike("name", name);

  const { data: existing, error: findError } = await query.maybeSingle();
  if (findError) throw findError;
  if (existing) return existing;

  const { data, error } = await supabaseAdmin
    .from("contacts")
    .insert({
      customer_id: customerId,
      name,
      email: email || null,
      phone: clean(request.phone) || null,
      is_primary: true
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

async function findOrCreateLead(request, customerId, contactId) {
  const { data: existing, error: findError } = await supabaseAdmin
    .from("leads")
    .select("*")
    .eq("source_request_id", request.id)
    .maybeSingle();

  if (findError) throw findError;
  if (existing) return existing;

  const { data, error } = await supabaseAdmin
    .from("leads")
    .insert({
      customer_id: customerId,
      contact_id: contactId,
      source_request_id: request.id,
      title: customerNameFromRequest(request),
      description: request.message || request.description || null,
      status: "open",
      source: "requests"
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function POST(_request, { params }) {
  if (!hasSupabaseAdminConfig) {
    return NextResponse.json({ error: "Supabase er ikke konfigurert." }, { status: 503 });
  }

  const { data: requestRow, error: requestError } = await supabaseAdmin
    .from("requests")
    .select("*")
    .eq("id", params.id)
    .single();

  if (requestError || !requestRow) {
    if (requestError) console.error("request conversion lookup error:", requestError);
    return NextResponse.json({ error: "Henvendelsen ble ikke funnet." }, { status: 404 });
  }

  try {
    const customer = await findOrCreateCustomer(requestRow);
    const contact = await findOrCreateContact(requestRow, customer.id);
    const lead = await findOrCreateLead(requestRow, customer.id, contact.id);

    let { data: updatedRequest, error: updateError } = await supabaseAdmin
      .from("requests")
      .update({
        customer_id: customer.id,
        contact_id: contact.id,
        lead_id: lead.id,
        status: "converted",
        converted_to_customer: true,
        converted_at: new Date().toISOString()
      })
      .eq("id", requestRow.id)
      .select("*")
      .single();

    if (updateError) {
      console.error("request conversion update converted status error:", updateError);
      const fallback = await supabaseAdmin
        .from("requests")
        .update({
          customer_id: customer.id,
          contact_id: contact.id,
          lead_id: lead.id,
          converted_to_customer: true,
          converted_at: new Date().toISOString()
        })
        .eq("id", requestRow.id)
        .select("*")
        .single();
      updatedRequest = fallback.data;
      updateError = fallback.error;
    }

    if (updateError) throw updateError;

    return NextResponse.json({ customer, contact, lead, request: updatedRequest });
  } catch (error) {
    console.error("request conversion error:", error);
    return NextResponse.json({ error: "Kunne ikke konvertere henvendelsen til kunde. Sjekk serverloggen for tekniske detaljer." }, { status: 500 });
  }
}
