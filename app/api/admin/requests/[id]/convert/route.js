import { NextResponse } from "next/server";
import { requireAdmin, adminErrorResponse } from "@/lib/auth/requireAdmin";
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

function notFoundResponse(id) {
  return NextResponse.json({
    error: "Henvendelsen ble ikke funnet.",
    id,
    hint: "Sjekk at request finnes i samme Supabase-miljø som Vercel bruker."
  }, { status: 404 });
}

async function fetchRequestById(id) {
  const { data, error } = await supabaseAdmin
    .from("requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("request conversion lookup error:", { id, code: error.code, message: error.message });
  }

  return { data, error };
}

async function resolveRequestForConversion(id) {
  console.info("request conversion lookup:", { id });

  const direct = await fetchRequestById(id);
  if (direct.error || direct.data) return { requestRow: direct.data, lookupError: direct.error, source: "requests.id" };

  const quoteLookup = await supabaseAdmin
    .from("quotes")
    .select("id,source_request_id")
    .eq("id", id)
    .maybeSingle();

  if (quoteLookup.error) {
    console.error("request conversion quote fallback error:", { id, code: quoteLookup.error.code, message: quoteLookup.error.message });
  } else if (quoteLookup.data?.source_request_id) {
    console.warn("request conversion received quote id; resolving via quotes.source_request_id", { id, sourceRequestId: quoteLookup.data.source_request_id });
    const fromQuote = await fetchRequestById(quoteLookup.data.source_request_id);
    return { requestRow: fromQuote.data, lookupError: fromQuote.error, source: "quotes.source_request_id" };
  }

  const requestByLead = await supabaseAdmin
    .from("requests")
    .select("*")
    .eq("lead_id", id)
    .maybeSingle();

  if (requestByLead.error) {
    console.error("request conversion lead fallback error:", { id, code: requestByLead.error.code, message: requestByLead.error.message });
  } else if (requestByLead.data) {
    console.warn("request conversion received lead id; resolving via requests.lead_id", { id, requestId: requestByLead.data.id });
    return { requestRow: requestByLead.data, lookupError: null, source: "requests.lead_id" };
  }

  return { requestRow: null, lookupError: null, source: "not_found" };
}

async function loadConvertedEntities(requestRow) {
  const [customer, contact, lead] = await Promise.all([
    requestRow.customer_id ? supabaseAdmin.from("customers").select("*").eq("id", requestRow.customer_id).maybeSingle() : Promise.resolve({ data: null }),
    requestRow.contact_id ? supabaseAdmin.from("contacts").select("*").eq("id", requestRow.contact_id).maybeSingle() : Promise.resolve({ data: null }),
    requestRow.lead_id ? supabaseAdmin.from("leads").select("*").eq("id", requestRow.lead_id).maybeSingle() : Promise.resolve({ data: null })
  ]);

  for (const [label, result] of [["customer", customer], ["contact", contact], ["lead", lead]]) {
    if (result.error) console.error(`request conversion already converted ${label} lookup error:`, result.error);
  }

  return { customer: customer.data, contact: contact.data, lead: lead.data };
}

export async function POST(_request, { params }) {
  const auth = await requireAdmin({ minRole: "employee" });
  if (!auth.ok) return adminErrorResponse(auth);

  if (!hasSupabaseAdminConfig) {
    return NextResponse.json({ error: "Supabase er ikke konfigurert." }, { status: 503 });
  }

  const { requestRow, lookupError } = await resolveRequestForConversion(params.id);

  if (lookupError || !requestRow) {
    return notFoundResponse(params.id);
  }

  if (requestRow.converted_to_customer || requestRow.customer_id || requestRow.contact_id || requestRow.lead_id) {
    const entities = await loadConvertedEntities(requestRow);
    return NextResponse.json({
      alreadyConverted: true,
      customerId: requestRow.customer_id || entities.customer?.id || null,
      contactId: requestRow.contact_id || entities.contact?.id || null,
      leadId: requestRow.lead_id || entities.lead?.id || null,
      request: requestRow,
      ...entities
    });
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
        converted_to_customer: true,
        converted_at: new Date().toISOString()
      })
      .eq("id", requestRow.id)
      .select("*")
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({
      alreadyConverted: false,
      customerId: customer.id,
      contactId: contact.id,
      leadId: lead.id,
      customer,
      contact,
      lead,
      request: updatedRequest
    });
  } catch (error) {
    console.error("request conversion error:", error);
    return NextResponse.json({ error: "Kunne ikke konvertere henvendelsen til kunde. Sjekk serverloggen for tekniske detaljer." }, { status: 500 });
  }
}
