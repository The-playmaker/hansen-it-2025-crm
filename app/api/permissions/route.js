import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("permissions")
    .select("id,key,label,description,created_at")
    .order("key", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req) {
  const supabase = getSupabaseServer();
  const body = await req.json();
  const { key, label, description } = body || {};

  if (!key || !label) {
    return NextResponse.json({ error: "key and label are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("permissions")
    .insert({ key, label, description: description || "" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
