import { NextResponse } from "next/server";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!hasSupabaseAdminConfig) {
    return NextResponse.json({ configured: false, data: [] });
  }

  const { data, error } = await supabaseAdmin
    .from("leads")
    .select("*, customer:customers(id,company_name,email), contact:contacts(id,name,email,phone)")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("leads read error:", error);
    return NextResponse.json({ configured: true, error: error.message, data: [] }, { status: 500 });
  }

  return NextResponse.json({ configured: true, data: data || [] });
}
