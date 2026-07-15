import { NextResponse } from "next/server";
import { requireAdmin, adminErrorResponse } from "@/lib/auth/requireAdmin";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin({ minRole: "employee" });
  if (!auth.ok) return adminErrorResponse(auth);

  const { data, error } = await supabaseAdmin
    .from("services")
    .select("*")
    .order("sort_order");

  if (error) {
    console.error("services read error:", error);
    return NextResponse.json({ error: "Kunne ikke hente tjenester." }, { status: 500 });
  }

  return NextResponse.json({ data: data || [] });
}

export async function POST(req) {
  const auth = await requireAdmin({ minRole: "admin" });
  if (!auth.ok) return adminErrorResponse(auth);

  const body = await req.json();
  const { data, error } = await supabaseAdmin
    .from("services")
    .insert([body])
    .select()
    .single();

  if (error) {
    console.error("services create error:", error);
    return NextResponse.json({ error: error.message || "Kunne ikke opprette tjeneste." }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
