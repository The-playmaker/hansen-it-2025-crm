import { NextResponse } from "next/server";
import { requireMe } from "@/lib/requireMe";
import { hasMinimumRole } from "@/lib/auth/roles";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function DELETE(_request, { params }) {
  const me = requireMe();
  if (!me) return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  if (!hasMinimumRole(me.role, "employee")) {
    return NextResponse.json({ error: "Du har ikke tilgang til denne handlingen." }, { status: 403 });
  }
  if (!hasSupabaseAdminConfig) return NextResponse.json({ error: "Supabase er ikke konfigurert." }, { status: 503 });

  const { data: item, error: readError } = await supabaseAdmin
    .from("quote_items")
    .select("id, quote_id, request_id")
    .eq("id", params.itemId)
    .maybeSingle();

  const belongsToQuote = item && [item.quote_id, item.request_id].some((value) => String(value || "") === String(params.id));
  if (readError || !belongsToQuote) {
    return NextResponse.json({ error: "Tilbudslinjen ble ikke funnet." }, { status: 404 });
  }

  const { error } = await supabaseAdmin.from("quote_items").delete().eq("id", params.itemId);
  if (error) {
    console.error("quote item delete error:", error);
    return NextResponse.json({ error: "Kunne ikke slette tilbudslinjen." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
