import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(_req, ctx) {
  const id = ctx.params.id;

  const { data, error } = await supabaseAdmin
    .from("quote_time_entries")
    .select("*")
    .eq("quote_id", id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data || [] });
}

export async function POST(req, ctx) {
  const id = ctx.params.id;
  const body = await req.json().catch(() => ({}));

  const hours = Number(body.hours);
  if (Number.isNaN(hours) || hours <= 0) {
    return NextResponse.json({ error: "hours must be > 0" }, { status: 400 });
  }

  const employeeId =
    body.employee_id === null || body.employee_id === undefined
      ? null
      : Number(body.employee_id);

  if (employeeId !== null && Number.isNaN(employeeId)) {
    return NextResponse.json(
      { error: "employee_id must be a number or null" },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("quote_time_entries")
    .insert({
      quote_id: id,
      employee_id: employeeId,
      hours,
      description: body.description ? String(body.description).trim() : null,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
