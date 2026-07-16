"use client";

import Link from "next/link";
import { PhoenixPanel, SecondaryButton } from "@/components/phoenix/PhoenixUi";

function LinkCell({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-1 font-semibold text-white">{value}</p>
    </div>
  );
}

/**
 * Shared CRM business-link panel for security reports and scan authorizations.
 */
export default function ForretningskoblingPanel({
  row,
  busy = false,
  description = "Koblingen som driver flyten videre til tilbud, dokumenter og kundeportal.",
  customerFallback = "",
  contactFallback = "",
  onLinkCustomer,
  onLinkContact,
  onLinkRequest,
  onCreateQuote,
  createQuoteLabel = "Opprett tilbud",
  createQuoteBusy = false,
}) {
  const customerLabel = row?.customer?.company_name || customerFallback || "Ikke koblet";
  const contactLabel = row?.contact?.name || contactFallback || "Ikke koblet";
  const requestLabel = row?.request?.company || row?.request?.name || "Ikke koblet";
  const leadLabel = row?.lead?.title || "Ikke koblet";
  const quoteLabel = row?.quote?.title || "Mangler tilbud";
  const quoteId = row?.quote_id || row?.quote?.id || null;

  return (
    <PhoenixPanel title="Forretningskobling" description={description}>
      <div className="grid gap-3 md:grid-cols-5">
        <LinkCell label="Kunde" value={customerLabel} />
        <LinkCell label="Kontaktperson" value={contactLabel} />
        <LinkCell label="Henvendelse" value={requestLabel} />
        <LinkCell label="Lead" value={leadLabel} />
        <LinkCell label="Tilbud / portal" value={quoteLabel} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {quoteId ? (
          <Link href={`/admin/quotes/${quoteId}`}>
            <SecondaryButton type="button">Åpne tilbud</SecondaryButton>
          </Link>
        ) : null}
        {!quoteId && onCreateQuote ? (
          <SecondaryButton type="button" disabled={Boolean(busy) || createQuoteBusy} onClick={onCreateQuote}>
            {createQuoteBusy ? "Oppretter..." : createQuoteLabel}
          </SecondaryButton>
        ) : null}
        <SecondaryButton type="button" disabled={Boolean(busy)} onClick={onLinkCustomer}>
          {row?.customer_id ? "Bytt kunde" : "Koble til kunde"}
        </SecondaryButton>
        <SecondaryButton type="button" disabled={Boolean(busy)} onClick={onLinkContact}>
          {row?.contact_id ? "Bytt kontaktperson" : "Koble kontaktperson"}
        </SecondaryButton>
        <SecondaryButton type="button" disabled={Boolean(busy)} onClick={onLinkRequest}>
          {row?.request_id ? "Bytt henvendelse" : "Koble til henvendelse"}
        </SecondaryButton>
      </div>
    </PhoenixPanel>
  );
}
