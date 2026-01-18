import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

export async function GET() {
  try {
    const supabase = getSupabaseServer();
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
