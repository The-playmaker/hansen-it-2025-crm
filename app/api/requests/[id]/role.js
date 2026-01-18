import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

export async function PATCH(req, { params }) {
  const { id } = params;
  const { role } = await req.json();

  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("employees")
      .update({ role })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err) {
    console.error("Failed to update role:", err);
    return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
  }
}
