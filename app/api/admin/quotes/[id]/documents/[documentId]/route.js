import { NextResponse } from "next/server";
import { requireMe } from "@/lib/requireMe";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function PATCH(request, { params }) {
  const me = requireMe();
  if (!me) return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  if (!hasSupabaseAdminConfig) return NextResponse.json({ error: "Supabase er ikke konfigurert." }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const visible = Boolean(body.is_portal_visible);

  const { data: document, error: readError } = await supabaseAdmin
    .from("quote_documents")
    .select("id, quote_id, request_id")
    .eq("id", params.documentId)
    .maybeSingle();

  const belongsToQuote = document && [document.quote_id, document.request_id].some((value) => String(value || "") === String(params.id));
  if (readError || !belongsToQuote) {
    return NextResponse.json({ error: "Dokumentet ble ikke funnet." }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from("quote_documents")
    .update({ is_portal_visible: visible, visible_in_portal: visible, updated_at: new Date().toISOString() })
    .eq("id", params.documentId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: "Kunne ikke oppdatere dokumentet." }, { status: 500 });
  return NextResponse.json({ data });
}
