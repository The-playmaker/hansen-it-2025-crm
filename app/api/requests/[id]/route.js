import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(request, { params }) {
  const id = params.id;

  const { data, error } = await supabaseServer
    .from("requests")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Supabase error:", error);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PATCH(request, { params }) {
  const id = params.id;
  const body = await request.json();

  const { data, error } = await supabase
    .from("requests")
    .update(body)
    .eq("id", id)
    .select();

  if (error) {
    console.error("Supabase update error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}
