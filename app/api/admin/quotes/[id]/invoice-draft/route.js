import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(_request, { params }) {
  const quoteId = String(params?.id || "");
  if (!quoteId) return NextResponse.json({ error: "Mangler tilbud." }, { status: 400 });

  const { data: quote, error: quoteError } = await supabaseAdmin
    .from("requests")
    .select("*")
    .eq("id", quoteId)
    .maybeSingle();

  if (quoteError || !quote) {
    return NextResponse.json({ error: "Tilbudet ble ikke funnet." }, { status: 404 });
  }

  const { data: existing } = await supabaseAdmin
    .from("invoices")
    .select("*")
    .eq("quote_id", quoteId)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ data: existing, reused: true });
  }

  const { data: timeEntries } = await supabaseAdmin
    .from("quote_time_entries")
    .select("*")
    .eq("quote_id", quoteId)
    .order("created_at", { ascending: true });

  const entries = timeEntries?.length ? timeEntries : [{ description: quote.title || quote.category || "Arbeid etter godkjent tilbud", hours: 1, rate: 0 }];
  const subtotal = entries.reduce((sum, entry) => sum + Number(entry.hours || 0) * Number(entry.rate || 0), 0);
  const vatRate = 25;
  const vatAmount = subtotal * (vatRate / 100);
  const total = subtotal + vatAmount;
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14);

  const { data: invoice, error: invoiceError } = await supabaseAdmin
    .from("invoices")
    .insert({
      customer_id: quote.customer_id || null,
      quote_id: quoteId,
      request_id: quote.id,
      invoice_number: `DRAFT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
      status: "draft",
      subtotal,
      vat_rate: vatRate,
      vat_amount: vatAmount,
      total,
      due_date: dueDate.toISOString().slice(0, 10)
    })
    .select("*")
    .single();

  if (invoiceError) {
    console.error("invoice draft create failed:", invoiceError);
    return NextResponse.json({ error: "Kunne ikke opprette fakturautkast. Kjor invoice-migrationen og prov igjen." }, { status: 500 });
  }

  const items = entries.map((entry) => {
    const quantity = Number(entry.hours || 0);
    const unitPrice = Number(entry.rate || 0);
    return {
      invoice_id: invoice.id,
      description: entry.description || "Arbeid etter godkjent tilbud",
      quantity,
      unit_price: unitPrice,
      vat_rate: vatRate,
      line_total: quantity * unitPrice
    };
  });

  if (items.length) {
    const { error: itemsError } = await supabaseAdmin.from("invoice_items").insert(items);
    if (itemsError) {
      console.error("invoice item create failed:", itemsError);
      return NextResponse.json({ error: "Fakturautkast ble opprettet, men linjer feilet." }, { status: 500 });
    }
  }

  await supabaseAdmin.from("quote_notes").insert({
    quote_id: quoteId,
    author_id: null,
    note: `[INVOICE] Fakturautkast ${invoice.invoice_number} opprettet.`
  });

  return NextResponse.json({ data: invoice, reused: false });
}
