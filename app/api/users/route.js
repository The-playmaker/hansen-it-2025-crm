import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

export async function GET() {
  try {
    const supabase = getSupabaseServer();
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
