"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { EmptyState, PhoenixPageHeader, PhoenixPanel, SecondaryButton, StatusBadge } from "@/components/phoenix/PhoenixUi";

function money(value) {
  return new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 }).format(Number(value || 0));
}

export default function InvoiceDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(`/api/admin/invoices/${id}`, { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Kunne ikke hente faktura.");
        setInvoice(result.data);
      } catch (err) {
        setError(err.message || "Kunne ikke hente faktura.");
      } finally {
        setLoading(false);
      }
    }
    if (id) load();
  }, [id]);

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PhoenixPageHeader
        eyebrow="Faktura foundation"
        title={invoice?.invoice_number || "Fakturautkast"}
        description="Utkast basert på quote/time entries. Sendes ikke automatisk."
        action={<SecondaryButton type="button" onClick={() => router.push("/admin/invoices")}><ArrowLeft size={16} />Tilbake</SecondaryButton>}
      />

      {loading ? <PhoenixPanel><EmptyState text="Henter faktura..." /></PhoenixPanel> : null}
      {error ? <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div> : null}

      {invoice ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <PhoenixPanel title="Status"><StatusBadge>{invoice.status}</StatusBadge></PhoenixPanel>
            <PhoenixPanel title="Subtotal"><p className="text-2xl font-bold text-white">{money(invoice.subtotal)}</p></PhoenixPanel>
            <PhoenixPanel title="MVA"><p className="text-2xl font-bold text-white">{money(invoice.vat_amount)}</p></PhoenixPanel>
            <PhoenixPanel title="Total"><p className="text-2xl font-bold text-white">{money(invoice.total)}</p></PhoenixPanel>
          </div>

          <PhoenixPanel title="Fakturalinjer">
            <div className="space-y-3">
              {(invoice.items || []).map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{item.description}</p>
                      <p className="text-sm text-slate-400">{Number(item.quantity).toFixed(2)} x {money(item.unit_price)} · MVA {Number(item.vat_rate || 0).toFixed(0)}%</p>
                    </div>
                    <p className="font-semibold text-white">{money(item.line_total)}</p>
                  </div>
                </div>
              ))}
              {!invoice.items?.length ? <EmptyState text="Ingen fakturalinjer." /> : null}
            </div>
          </PhoenixPanel>
        </>
      ) : null}
    </div>
  );
}
