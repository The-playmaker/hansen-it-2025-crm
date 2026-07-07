import { NextResponse } from "next/server";
import { requireMe } from "@/lib/requireMe";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const RISTESUND_REQUEST_ID = "7de38205-7f93-4c23-a5c1-7d12ede2058e";
const RISTESUND_QUOTE_ID = "b05134fc-b5a8-45ff-bf31-dc2fb5cc0f16";
const RISTESUND_CUSTOMER_ID = "fcdc0794-0952-4b1f-bd15-f78c22da359b";

const testSpecs = [
  { key: "requests", table: "requests", testFilter: "is_test.eq.true,name.ilike.%Test%,company.ilike.%Test%,email.ilike.%test@example%" },
  { key: "leads", table: "leads", testFilter: "is_test.eq.true,name.ilike.%Test%,company.ilike.%Test%,email.ilike.%test@example%" },
  { key: "quotes", table: "quotes", testFilter: "is_test.eq.true,title.ilike.%Test%,description.ilike.%Test%" },
  { key: "quote_items", table: "quote_items", testFilter: "is_test.eq.true,title.ilike.%Test%,description.ilike.%Test%" },
  { key: "quote_documents", table: "quote_documents", testFilter: "is_test.eq.true,filename.ilike.%test%,title.ilike.%Test%" },
  { key: "quote_messages", table: "quote_messages", testFilter: "is_test.eq.true,message.ilike.%test%" },
  { key: "security_scan_reports", table: "security_scan_reports", testFilter: "is_test.eq.true,domain.ilike.%test%" },
  { key: "scan_jobs", table: "scan_jobs", testFilter: "is_test.eq.true,domain.ilike.%test%" },
  { key: "quote_portal_tokens", table: "quote_portal_tokens", testFilter: "is_test.eq.true" },
  { key: "invoices", table: "invoices", testFilter: "is_test.eq.true,invoice_number.ilike.%DRAFT-TEST%" },
  { key: "invoice_items", table: "invoice_items", testFilter: "is_test.eq.true,description.ilike.%test%" },
];

const ristesundSpecs = [
  { key: "quote_portal_tokens", table: "quote_portal_tokens", column: "quote_id", value: RISTESUND_QUOTE_ID },
  { key: "quote_documents", table: "quote_documents", column: "quote_id", value: RISTESUND_QUOTE_ID },
  { key: "quote_messages", table: "quote_messages", column: "quote_id", value: RISTESUND_QUOTE_ID },
  { key: "quote_items", table: "quote_items", column: "quote_id", value: RISTESUND_QUOTE_ID },
  { key: "invoices", table: "invoices", column: "quote_id", value: RISTESUND_QUOTE_ID },
];

function assertAdmin() {
  const me = requireMe();
  if (!me) return { error: "Ikke innlogget.", status: 401 };
  if (me.role !== "admin") return { error: "Kun admin kan rydde testdata.", status: 403 };
  if (!hasSupabaseAdminConfig) return { error: "Supabase er ikke konfigurert.", status: 503 };
  return { me };
}

async function countSpec(spec) {
  let query = supabaseAdmin.from(spec.table).select("id", { count: "exact", head: true });
  if (spec.testFilter) query = query.or(spec.testFilter);
  if (spec.column) query = query.eq(spec.column, spec.value);
  const { count, error } = await query;
  if (error) return { key: spec.key, table: spec.table, count: 0, error: error.message };
  return { key: spec.key, table: spec.table, count: count || 0 };
}

async function deleteSpec(spec) {
  let query = supabaseAdmin.from(spec.table).delete({ count: "exact" });
  if (spec.testFilter) query = query.or(spec.testFilter);
  if (spec.column) query = query.eq(spec.column, spec.value);
  const { count, error } = await query;
  if (error) return { key: spec.key, table: spec.table, deleted: 0, error: error.message };
  return { key: spec.key, table: spec.table, deleted: count || 0 };
}

async function preview(kind) {
  const specs = kind === "ristesund" ? ristesundSpecs : testSpecs;
  return Promise.all(specs.map(countSpec));
}

async function runDelete(kind, fullRistesund = false) {
  const specs = kind === "ristesund" ? ristesundSpecs : testSpecs;
  const ordered = [...specs].reverse();
  const results = [];
  for (const spec of ordered) results.push(await deleteSpec(spec));

  if (kind === "ristesund") {
    const { data: invoices } = await supabaseAdmin
      .from("invoices")
      .select("id")
      .eq("quote_id", RISTESUND_QUOTE_ID);
    const invoiceIds = (invoices || []).map((invoice) => invoice.id);
    if (invoiceIds.length) {
      await supabaseAdmin.from("invoice_items").delete().in("invoice_id", invoiceIds);
    }

    if (fullRistesund) {
      await supabaseAdmin.from("quotes").delete().eq("id", RISTESUND_QUOTE_ID);
      await supabaseAdmin.from("contacts").delete().eq("customer_id", RISTESUND_CUSTOMER_ID);
      await supabaseAdmin.from("customers").delete().eq("id", RISTESUND_CUSTOMER_ID);
      await supabaseAdmin.from("requests").delete().eq("id", RISTESUND_REQUEST_ID);
    } else {
      await supabaseAdmin
        .from("quotes")
        .update({ status: "kladd", total_ex_vat: 0, total_vat: 0, total_inc_vat: 0, updated_at: new Date().toISOString() })
        .eq("id", RISTESUND_QUOTE_ID);
    }
  }

  return results;
}

export async function GET(request) {
  const auth = assertAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const kind = new URL(request.url).searchParams.get("kind") === "ristesund" ? "ristesund" : "test";
  const counts = await preview(kind);
  return NextResponse.json({ kind, counts });
}

export async function POST(request) {
  const auth = assertAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  if (body.confirmation !== "SLETT TESTDATA") {
    return NextResponse.json({ error: "Bekreft med teksten SLETT TESTDATA." }, { status: 400 });
  }

  const kind = body.kind === "ristesund" ? "ristesund" : "test";
  const deleted = await runDelete(kind, Boolean(body.fullRistesund));
  const counts = await preview(kind);
  return NextResponse.json({ kind, deleted, counts });
}
