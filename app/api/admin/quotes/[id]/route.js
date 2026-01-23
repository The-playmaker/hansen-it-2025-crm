import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(req, ctx) {
  const id = ctx.params.id;
  const url = new URL(req.url);
  const include = url.searchParams.get("include");

  const { data: quote, error } = await supabaseAdmin
    .from("requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !quote) {
    return NextResponse.json({ error: error?.message || "Not found" }, { status: 404 });
  }

  // optional includes
  let time = null;
  let attachments = null;

  if (include === "time") {
    const r = await supabaseAdmin
      .from("quote_time_entries")
      .select("*")
      .eq("quote_id", id)
      .order("created_at", { ascending: false });
    time = r.data || [];
  }

  if (include === "attachments") {
    const r = await supabaseAdmin
      .from("quote_attachments")
      .select("*")
      .eq("quote_id", id)
      .order("created_at", { ascending: false });
    attachments = r.data || [];
  }

  return NextResponse.json({ data: quote, time, attachments });
}

export async function PATCH(req, ctx) {
  const id = ctx.params.id;
  const body = await req.json().catch(() => ({}));

  const allowed = {};
  if ("status" in body) allowed.status = body.status;
  if ("employee_id" in body) allowed.employee_id = body.employee_id;
  if ("inspection_date" in body) allowed.inspection_date = body.inspection_date;
  if ("start_date" in body) allowed.start_date = body.start_date;
  if ("due_date" in body) allowed.due_date = body.due_date;

  const { data, error } = await supabaseAdmin
    .from("requests")
    .update(allowed)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
