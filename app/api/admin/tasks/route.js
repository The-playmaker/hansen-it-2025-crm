import { NextResponse } from "next/server";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!hasSupabaseAdminConfig) {
    return NextResponse.json({ configured: false, data: [] });
  }

  const { data, error } = await supabaseAdmin
    .from("tasks")
    .select("*, customer:customers(id,company_name)")
    .order("due_date", { ascending: true })
    .limit(500);

  if (error) {
    console.error("tasks read error:", error);
    return NextResponse.json({ configured: true, error: error.message, data: [] }, { status: 500 });
  }

  return NextResponse.json({ configured: true, data: data || [] });
}
