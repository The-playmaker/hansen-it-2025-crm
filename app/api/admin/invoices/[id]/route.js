import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const invoiceId = String(params?.id || "");
  const { data: invoice, error } = await supabaseAdmin
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .maybeSingle();

  if (error || !invoice) {
    return NextResponse.json({ error: "Faktura ble ikke funnet." }, { status: 404 });
  }

  const { data: items } = await supabaseAdmin
    .from("invoice_items")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: true });

  return NextResponse.json({ data: { ...invoice, items: items || [] } });
}
