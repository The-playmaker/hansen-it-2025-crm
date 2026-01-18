import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

export async function DELETE(req, { params }) {
  const { id } = params;

  try {
    const supabase = getSupabaseServer();

    // Hent bruker for e-post
    const { data: user } = await supabase
      .from("employees")
      .select("*")
      .eq("id", id)
      .single();

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Slett bruker i Supabase
    await supabase.from("employees").delete().eq("id", id);

    // TODO: Slett bruker i Casdoor via API
    await fetch(`${process.env.NEXT_PUBLIC_CASDOOR_SERVER_URL}/api/delete-user?owner=${process.env.CASDOOR_ORG_NAME}&name=${user.email}`, {
      method: "POST"
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to delete user:", err);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
