import { NextResponse } from "next/server";
import { requireAdmin, adminErrorResponse } from "@/lib/auth/requireAdmin";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin({ minRole: "admin" });
  if (!auth.ok) return adminErrorResponse(auth);

  const supabase = supabaseAdmin;

  const { data: roles, error: rErr } = await supabase
    .from("roles")
    .select("id,name,description,created_at")
    .order("name", { ascending: true });

  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });

  const { data: links, error: lErr } = await supabase
    .from("role_permissions")
    .select("role_id,permission_id");

  if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 });

  return NextResponse.json({ roles, links });
}

export async function POST(req) {
  const auth = await requireAdmin({ minRole: "owner" });
  if (!auth.ok) return adminErrorResponse(auth);

  const supabase = supabaseAdmin;
  const { name, description } = await req.json();

  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const { data, error } = await supabase
    .from("roles")
    .insert({ name, description: description || "" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
