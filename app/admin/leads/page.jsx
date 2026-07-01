"use client";

import { useMemo, useState } from "react";
import { usePhoenixData } from "@/components/phoenix/usePhoenixData";
import { EmptyState, Field, formatDate, PhoenixPageHeader, PhoenixPanel, RecordCard, SelectInput, StatusBadge, TextInput } from "@/components/phoenix/PhoenixUi";

const leadStatuses = ["alle", "ny", "kontaktet", "kvalifisert", "droppet"];

export default function LeadsPage() {
  const { data, upsert, remove } = usePhoenixData();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("alle");

  const leads = useMemo(() => {
    return (data.leads || []).filter((lead) => {
      const haystack = `${lead.name || ""} ${lead.email || ""} ${lead.company || ""} ${lead.message || ""}`.toLowerCase();
      const matchesQuery = haystack.includes(query.toLowerCase());
      const matchesStatus = status === "alle" || lead.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [data.leads, query, status]);

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PhoenixPageHeader
        title="Leads"
        description="Henvendelser fra Hansen IT-nettsiden lander her. I v1 vises mock/localStorage-data når Supabase ikke er koblet."
      />

      <PhoenixPanel title="Lead-innboks" description="Dette er broen mellom nettsiden og Phoenix CRM. Full kunde-konvertering kommer senere.">
        <div className="mb-4 grid gap-3 md:grid-cols-[1fr_220px]">
          <Field label="Søk"><TextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Søk navn, firma, e-post eller melding..." /></Field>
          <Field label="Status"><SelectInput value={status} options={leadStatuses} onChange={(event) => setStatus(event.target.value)} /></Field>
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          {leads.length ? leads.map((lead) => (
            <RecordCard
              key={lead.id}
              title={lead.company || lead.name}
              meta={`${lead.name || "Ukjent navn"} - ${lead.email || "Ingen e-post"}${lead.phone ? ` - ${lead.phone}` : ""}`}
              badge={lead.status || "ny"}
              onDelete={() => remove("leads", lead.id)}
            >
              <p className="whitespace-pre-line">{lead.message}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <StatusBadge>{lead.category || "ukategorisert"}</StatusBadge>
                <span>Kilde: {lead.source || "ukjent"}</span>
                <span>{formatDate(lead.createdAt)}</span>
              </div>
              <div className="mt-3 max-w-xs">
                <SelectInput value={lead.status || "ny"} options={leadStatuses.filter((item) => item !== "alle")} onChange={(event) => upsert("leads", { ...lead, status: event.target.value }, "lead")} />
              </div>
            </RecordCard>
          )) : <EmptyState text="Ingen leads i dette filteret." />}
        </div>
      </PhoenixPanel>
    </div>
  );
}
