import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function POST(req, { params }) {
  try {
    const { id } = params; // quote id
    const body = await req.json().catch(() => ({}));

    // employee_id kan være number eller null
    const employee_id =
      body.employee_id === null || body.employee_id === "" || typeof body.employee_id === "undefined"
        ? null
        : Number(body.employee_id);

    if (employee_id !== null && Number.isNaN(employee_id)) {
      return NextResponse.json({ error: "employee_id must be a number or null" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("requests")
      .update({ employee_id })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
