import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(req, { params }) {
  let { data, error } = await supabaseAdmin
    .from("requests")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!data) {
    const fallback = await supabaseAdmin
      .from("quotes")
      .select("*")
      .eq("id", params.id)
      .maybeSingle();
    data = fallback.data;
    error = fallback.error;
  }

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Fant ikke tilbud." }, { status: error ? 500 : 404 });
  }

  return NextResponse.json({ data });
}

export async function PATCH(req, { params }) {
  const body = await req.json();
  let { data, error } = await supabaseAdmin
    .from("requests")
    .update(body)
    .eq("id", params.id)
    .select()
    .maybeSingle();

  if (!data) {
    const fallback = await supabaseAdmin
      .from("quotes")
      .update(body)
      .eq("id", params.id)
      .select()
      .maybeSingle();
    data = fallback.data;
    error = fallback.error;
  }

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Fant ikke tilbud." }, { status: error ? 500 : 404 });
  }

  return NextResponse.json({ data });
}
