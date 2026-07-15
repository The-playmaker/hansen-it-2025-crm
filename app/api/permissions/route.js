import { NextResponse } from "next/server";
import { requireAdmin, adminErrorResponse } from "@/lib/auth/requireAdmin";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin({ minRole: "admin" });
  if (!auth.ok) return adminErrorResponse(auth);

  const supabase = supabaseAdmin;
  const { data, error } = await supabase
    .from("permissions")
    .select("id,key,label,description,created_at")
    .order("key", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req) {
  const auth = await requireAdmin({ minRole: "owner" });
  if (!auth.ok) return adminErrorResponse(auth);

  const supabase = supabaseAdmin;
  const body = await req.json();
  const { key, label, description } = body || {};

  if (!key || !label) {
    return NextResponse.json({ error: "key and label are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("permissions")
    .insert({ key, label, description: description || "" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
