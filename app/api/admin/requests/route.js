import { NextResponse } from "next/server";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";
import { mapRequestToLead } from "@/lib/requestLeadMapping";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!hasSupabaseAdminConfig) {
    return NextResponse.json({ configured: false, data: [], leads: [], message: "Demo mode: Supabase er ikke konfigurert." });
  }

  const { data, error } = await supabaseAdmin
    .from("requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("requests read error:", error);
    return NextResponse.json({ configured: true, error: error.message, data: [], leads: [] }, { status: 500 });
  }

  return NextResponse.json({ configured: true, data: data || [], leads: (data || []).map(mapRequestToLead) });
}
