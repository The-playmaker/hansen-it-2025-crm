import { NextResponse } from "next/server";
import { requireAdmin, adminErrorResponse } from "@/lib/auth/requireAdmin";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin({ minRole: "employee" });
  if (!auth.ok) return adminErrorResponse(auth);

  const { data, error } = await supabaseAdmin
    .from("requests")
    .select("id,name,email,status,created_at,start_date")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("calendar read error:", error);
    return NextResponse.json({ error: "Kunne ikke hente forespørsler." }, { status: 500 });
  }

  return NextResponse.json({ data: data || [] });
}

export async function PATCH(req) {
  const auth = await requireAdmin({ minRole: "employee" });
  if (!auth.ok) return adminErrorResponse(auth);

  const body = await req.json();
  const { id, ...patch } = body || {};

  if (!id) {
    return NextResponse.json({ error: "Mangler id." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("requests")
    .update(patch)
    .eq("id", id)
    .select("id,name,email,status,created_at,start_date")
    .single();

  if (error) {
    console.error("calendar update error:", error);
    return NextResponse.json({ error: error.message || "Kunne ikke oppdatere forespørsel." }, { status: 500 });
  }

  return NextResponse.json({ data });
}
