import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

function getMeFromCookie(req) {
  const raw = req.cookies.get("casdoorUser")?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function POST(req, { params }) {
  const me = getMeFromCookie(req);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const quoteId = params.id;

  const body = await req.json().catch(() => ({}));
  const hours = Number(body.hours);
  const description = body.description?.trim() || null;
  const employee_id = body.employee_id ?? null; // send fra client (valgfritt)

  if (!hours || Number.isNaN(hours) || hours <= 0) {
    return NextResponse.json({ error: "Invalid hours" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("quote_time_entries")
    .insert({
      quote_id: quoteId,
      employee_id,
      hours,
      description,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
