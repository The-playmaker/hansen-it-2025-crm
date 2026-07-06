import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PortalTokenError, resolveQuotePortalToken } from "@/lib/portal/resolveQuotePortalToken";

export const dynamic = "force-dynamic";

export async function GET(_req, { params }) {
  const token = String(params?.token || "");
  if (!token) {
    return NextResponse.json({ error: "Mangler portal-token." }, { status: 400 });
  }

  let resolved;
  try {
    resolved = await resolveQuotePortalToken(token);
  } catch (error) {
    if (error instanceof PortalTokenError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("quote portal resolve failed:", error);
    return NextResponse.json({ error: "Kunne ikke apne kundeportalen." }, { status: 500 });
  }

  const { quote, tokenRow, tokenSource } = resolved;

  let employee = null;
  if (quote.employee_id) {
    const { data: emp } = await supabaseAdmin
      .from("employees")
      .select("*")
      .eq("id", quote.employee_id)
      .maybeSingle();
    employee = emp ?? null;
  }

  const { data: timeEntries } = await supabaseAdmin
    .from("quote_time_entries")
    .select("*")
    .eq("quote_id", quote.id)
    .order("created_at", { ascending: false });

  let quoteItems = [];
  const quoteItemIds = [quote.id, quote.source_request_id].filter(Boolean);
  const quoteItemFilter = quoteItemIds
    .flatMap((id) => [`quote_id.eq.${id}`, `request_id.eq.${id}`])
    .join(",");

  const { data: itemsData, error: itemsError } = await supabaseAdmin
    .from("quote_items")
    .select("*")
    .or(quoteItemFilter)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (!itemsError && itemsData?.length) {
    const packageIds = [...new Set(itemsData.map((item) => item.service_package_id).filter(Boolean))];
    let packages = [];
    if (packageIds.length) {
      const packageResult = await supabaseAdmin
        .from("service_packages")
        .select("*, service_package_items(*)")
        .in("id", packageIds);
      packages = packageResult.data || [];
    }
    const packageMap = new Map(packages.map((pkg) => [String(pkg.id), pkg]));
    quoteItems = itemsData.map((item) => ({
      ...item,
      service_package: item.service_package_id ? packageMap.get(String(item.service_package_id)) || null : null,
    }));
  }

  const { data: documents } = await supabaseAdmin
    .from("quote_documents")
    .select("*")
    .eq("quote_id", quote.id)
    .eq("is_portal_visible", true)
    .order("created_at", { ascending: false });

  return NextResponse.json({
    token: {
      quote_id: tokenRow.quote_id,
      token_source: tokenSource,
      expires_at: tokenRow.expires_at,
    },
    quote,
    employee,
    timeEntries: timeEntries || [],
    quoteItems,
    documents: documents || [],
  });
}
