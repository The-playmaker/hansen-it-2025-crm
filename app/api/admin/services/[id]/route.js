import { NextResponse } from "next/server";
import { requireAdmin, adminErrorResponse } from "@/lib/auth/requireAdmin";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function PATCH(req, { params }) {
  const auth = await requireAdmin({ minRole: "admin" });
  if (!auth.ok) return adminErrorResponse(auth);

  const body = await req.json();
  const { data, error } = await supabaseAdmin
    .from("services")
    .update(body)
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    console.error("services update error:", error);
    return NextResponse.json({ error: error.message || "Kunne ikke oppdatere tjeneste." }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function DELETE(_req, { params }) {
  const auth = await requireAdmin({ minRole: "admin" });
  if (!auth.ok) return adminErrorResponse(auth);

  const { error } = await supabaseAdmin.from("services").delete().eq("id", params.id);

  if (error) {
    console.error("services delete error:", error);
    return NextResponse.json({ error: error.message || "Kunne ikke slette tjeneste." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
