import { NextResponse } from "next/server";
import { requireAdmin, adminErrorResponse } from "@/lib/auth/requireAdmin";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin({ minRole: "admin" });
  if (!auth.ok) return adminErrorResponse(auth);

  try {
    const supabase = supabaseAdmin;
    const { data, error } = await supabase
      .from("roles")
      .select("id, name, permissions");

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error("Failed to fetch roles:", err);
    return NextResponse.json({ error: "Failed to fetch roles" }, { status: 500 });
  }
}
