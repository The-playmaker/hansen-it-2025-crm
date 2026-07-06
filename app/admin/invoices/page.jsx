"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ReceiptText } from "lucide-react";
import { EmptyState, PhoenixPageHeader, PhoenixPanel, StatusBadge } from "@/components/phoenix/PhoenixUi";

function money(value) {
  return new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 }).format(Number(value || 0));
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/admin/invoices", { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Kunne ikke hente fakturaer.");
        setInvoices(result.data || []);
      } catch (err) {
        setError(err.message || "Kunne ikke hente fakturaer.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PhoenixPageHeader
        eyebrow="Finance foundation"
        title="Faktura"
        description="Fakturamodul foundation. Utkast kan opprettes fra godkjente tilbud, men sendes ikke automatisk og er ikke koblet mot regnskap ennå."
      />

      {error ? <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div> : null}

      <PhoenixPanel title="Fakturautkast" description="Ekstern regnskapsintegrasjon med Tripletex/Fiken/PowerOffice kommer senere.">
        {loading ? <EmptyState text="Henter fakturaer..." /> : null}
        {!loading && !invoices.length ? <EmptyState text="Ingen fakturautkast ennå." /> : null}
        <div className="grid gap-3">
          {invoices.map((invoice) => (
            <Link key={invoice.id} href={`/admin/invoices/${invoice.id}`} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 hover:bg-white/10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 font-semibold text-white"><ReceiptText size={16} />{invoice.invoice_number || "Fakturautkast"}</div>
                  <p className="mt-1 text-sm text-slate-400">Forfall: {invoice.due_date || "Ikke satt"} · Total: {money(invoice.total)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge>{invoice.status}</StatusBadge>
                  <ArrowRight size={16} className="text-slate-400" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </PhoenixPanel>
    </div>
  );
}
