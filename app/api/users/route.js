import { NextResponse } from "next/server";
import { requireAdmin, adminErrorResponse } from "@/lib/auth/requireAdmin";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin({ minRole: "employee" });
  if (!auth.ok) return adminErrorResponse(auth);

  try {
    const supabase = supabaseAdmin;
    const { data, error } = await supabase
      .from("employees")
      .select("id, name, email, role");

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err) {
    console.error("Failed to fetch users:", err);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}
