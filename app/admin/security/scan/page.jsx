"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Download, FileJson, FileText, Link as LinkIcon, Mail, MessageSquarePlus, SearchCheck, ShieldAlert } from "lucide-react";
import { downloadSecurityReportJson, downloadSecurityReportPdf } from "@/lib/securityScan/exportClient";
import { EmptyState, Field, MetricCard, PhoenixPageHeader, PhoenixPanel, PrimaryButton, SecondaryButton, SelectInput, StatusBadge, TextArea, TextInput } from "@/components/phoenix/PhoenixUi";

const categoryLabels = { web: "Web", email: "E-post", domain: "Domene" };
const severityLabels = { critical: "kritisk", high: "høy", medium: "middels", low: "lav", ok: "ok" };
const crmActionLabels = {
  lead: "Lead/request opprettet fra funn.",
  task: "Oppgave opprettet fra funn.",
  quote: "Tilbudskladd opprettet fra funn.",
  note: "Kundenotat lagt til fra funn."
};

function toneForSeverity(severity) {
  if (severity === "critical") return "border-rose-400/40 bg-rose-500/15 text-rose-100";
  if (severity === "high") return "border-orange-400/40 bg-orange-500/15 text-orange-100";
  if (severity === "medium") return "border-amber-400/30 bg-amber-500/10 text-amber-200";
  if (severity === "low") return "border-cyan-400/30 bg-cyan-500/10 text-cyan-200";
  return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
}

export default function SecurityScanPage() {
  const [domain, setDomain] = useState("");
  const [customers, setCustomers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [leads, setLeads] = useState([]);
  const [links, setLinks] = useState({ customer_id: "", request_id: "", lead_id: "" });
  const [crmConfigured, setCrmConfigured] = useState(true);
  const [state, setState] = useState("idle");
  const [error, setError] = useState("");
  const [report, setReport] = useState(null);
  const [actionBusy, setActionBusy] = useState("");
  const [actionResult, setActionResult] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [sendForm, setSendForm] = useState({ recipient_email: "", message: "" });

  const problems = useMemo(() => report?.findings?.filter((finding) => finding.status !== "ok") || [], [report]);
  const okFindings = useMemo(() => report?.findings?.filter((finding) => finding.status === "ok") || [], [report]);
  const selectedCustomer = useMemo(() => customers.find((customer) => customer.id === links.customer_id), [customers, links.customer_id]);

  useEffect(() => {
    let cancelled = false;
    async function loadCrmOptions() {
      try {
        const [customersResponse, requestsResponse, leadsResponse] = await Promise.all([
          fetch("/api/admin/customers", { cache: "no-store" }),
          fetch("/api/admin/requests", { cache: "no-store" }),
          fetch("/api/admin/leads", { cache: "no-store" })
        ]);
        const [customersResult, requestsResult, leadsResult] = await Promise.all([
          customersResponse.json(),
          requestsResponse.json(),
          leadsResponse.json()
        ]);
        if (cancelled) return;
        setCustomers(customersResult.data || []);
        setRequests(requestsResult.data || []);
        setLeads(leadsResult.data || []);
        setCrmConfigured(customersResult.configured !== false && requestsResult.configured !== false && leadsResult.configured !== false);
      } catch {
        if (!cancelled) setCrmConfigured(false);
      }
    }
    loadCrmOptions();
    return () => { cancelled = true; };
  }, []);

  const useCustomerDomain = () => {
    if (!selectedCustomer) return;
    const source = selectedCustomer.website || selectedCustomer.email || "";
    const nextDomain = String(source).replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].split("@").pop();
    if (nextDomain) setDomain(nextDomain);
  };

  const runScan = async (event) => {
    event.preventDefault();
    if (!domain.trim()) return;
    setState("scanning");
    setError("");
    setActionResult("");
    setShareUrl("");
    setReport(null);

    try {
      const response = await fetch("/api/admin/security/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, ...links })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Skanningen feilet.");
      setReport(result);
      setState("done");
    } catch (err) {
      setError(err.message || "Skanningen feilet.");
      setState("error");
    }
  };

  const createShareLink = async () => {
    if (!report?.reportId) {
      setError("Rapporten må være lagret før den kan deles.");
      return;
    }
    setActionBusy("share");
    setError("");
    try {
      const response = await fetch(`/api/admin/security/reports/${report.reportId}/share`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Kunne ikke lage delbar lenke.");
      setShareUrl(result.url);
      setActionResult("Delbar rapportlenke er klar.");
    } catch (err) {
      setError(err.message || "Kunne ikke lage delbar lenke.");
    } finally {
      setActionBusy("");
    }
  };

  const sendReport = async (event) => {
    event.preventDefault();
    if (!report?.reportId) {
      setError("Rapporten må være lagret før den kan sendes.");
      return;
    }
    setActionBusy("send");
    setError("");
    try {
      const response = await fetch(`/api/admin/security/reports/${report.reportId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sendForm)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Kunne ikke sende rapport.");
      setShareUrl(result.url);
      setActionResult("Rapporten er sendt.");
      setSendForm({ recipient_email: "", message: "" });
    } catch (err) {
      setError(err.message || "Kunne ikke sende rapport.");
    } finally {
      setActionBusy("");
    }
  };

  const createCrmItem = async (type, finding) => {
    if (!report || !finding) return;
    const key = `${type}-${finding.id}`;
    setActionBusy(key);
    setActionResult("");
    setError("");

    try {
      const response = await fetch("/api/admin/security/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          domain: report.domain,
          reportId: report.reportId,
          customer_id: report.customer_id || links.customer_id,
          request_id: report.request_id || links.request_id,
          lead_id: report.lead_id || links.lead_id,
          finding
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Kunne ikke opprette CRM-element.");
      setActionResult(crmActionLabels[type] || "CRM-element opprettet fra funn.");
    } catch (err) {
      setError(err.message || "Kunne ikke opprette CRM-element.");
    } finally {
      setActionBusy("");
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PhoenixPageHeader
        eyebrow="Security"
        title="Scan"
        description="Kjør passiv sikkerhetssjekk av domene direkte fra Phoenix CRM. Rapporten lagres i samme Supabase-prosjekt når tabellen finnes."
        action={<Link href="/admin/security/reports" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"><FileText size={16} />Reports</Link>}
      />

      <PhoenixPanel title="Ny skanning" description="Passive oppslag: DNS, RDAP, TLS, HTTPS og sikkerhetsheadere. Ingen aktiv angrepstesting.">
        {!crmConfigured ? <div className="mb-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100">Demo mode: CRM-valg er ikke koblet fordi Supabase mangler eller ikke svarer. Scan kan fortsatt kjøres, men blir ikke lagret.</div> : null}
        <form onSubmit={runScan} className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-3">
            <Field label="Kunde">
              <SelectInput
                value={links.customer_id}
                onChange={(event) => setLinks((current) => ({ ...current, customer_id: event.target.value }))}
                options={[{ value: "", label: "Ingen valgt" }, ...customers.map((customer) => ({ value: customer.id, label: customer.company_name || customer.email || customer.id }))]}
              />
            </Field>
            <Field label="Request">
              <SelectInput
                value={links.request_id}
                onChange={(event) => setLinks((current) => ({ ...current, request_id: event.target.value }))}
                options={[{ value: "", label: "Ingen valgt" }, ...requests.map((request) => ({ value: request.id, label: `${request.company || request.name || request.email || "Request"}${request.status ? ` · ${request.status}` : ""}` }))]}
              />
            </Field>
            <Field label="Lead">
              <SelectInput
                value={links.lead_id}
                onChange={(event) => setLinks((current) => ({ ...current, lead_id: event.target.value }))}
                options={[{ value: "", label: "Ingen valgt" }, ...leads.map((lead) => ({ value: lead.id, label: `${lead.title || lead.customer?.company_name || lead.id}${lead.status ? ` · ${lead.status}` : ""}` }))]}
              />
            </Field>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <Field label="Domene"><TextInput value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="hansen-it.com" /></Field>
            <div className="flex items-end"><SecondaryButton disabled={!selectedCustomer} type="button" onClick={useCustomerDomain}>Bruk kundedomene</SecondaryButton></div>
            <div className="flex items-end"><PrimaryButton disabled={state === "scanning"} type="submit"><SearchCheck size={16} />{state === "scanning" ? "Skanner..." : "Start scan"}</PrimaryButton></div>
          </div>
        </form>
        {error ? <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div> : null}
      </PhoenixPanel>

      {state === "scanning" ? <PhoenixPanel><EmptyState text="Skanner domene. Dette kan ta opptil ett minutt..." /></PhoenixPanel> : null}

      {report ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="Security Score" value={report.score} detail={`Karakter ${report.grade}`} tone={report.score >= 75 ? "emerald" : report.score >= 50 ? "amber" : "rose"} />
            <MetricCard label="Web" value={`${report.categories.web.score}/${report.categories.web.max}`} detail="HTTPS, TLS og headere" tone="cyan" />
            <MetricCard label="E-post" value={`${report.categories.email.score}/${report.categories.email.max}`} detail="SPF, DKIM og DMARC" tone="amber" />
            <MetricCard label="Domene" value={`${report.categories.domain.score}/${report.categories.domain.max}`} detail="RDAP og DNSSEC" tone="emerald" />
            <MetricCard label="Spoofing" value={severityLabels[report.spoofingRisk?.level] || "ukjent"} detail={report.spoofingRisk?.reason || "E-postrisiko"} tone={report.spoofingRisk?.level === "low" ? "emerald" : report.spoofingRisk?.level === "medium" ? "amber" : "rose"} />
          </div>

          <PhoenixPanel title={`Rapport: ${report.domain}`} description={report.summary}>
            <div className="flex flex-wrap gap-2 text-sm text-slate-300">
              <StatusBadge>{report.saved ? "Lagret" : "Ikke lagret"}</StatusBadge>
              {report.customer_id ? <StatusBadge>Kunde koblet</StatusBadge> : null}
              {report.request_id ? <StatusBadge>Request koblet</StatusBadge> : null}
              {report.lead_id ? <StatusBadge>Lead koblet</StatusBadge> : null}
              {report.reportId ? <span>Rapport-ID: {report.reportId}</span> : null}
              {report.saveError ? <span className="text-amber-200">Lagring feilet: {report.saveError}</span> : null}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <SecondaryButton type="button" onClick={() => downloadSecurityReportPdf(report)}><Download size={16} />Last ned PDF</SecondaryButton>
              <SecondaryButton type="button" onClick={() => downloadSecurityReportJson(report)}><FileJson size={16} />Last ned JSON</SecondaryButton>
              <SecondaryButton type="button" disabled={!report.reportId || Boolean(actionBusy)} onClick={createShareLink}><LinkIcon size={16} />{actionBusy === "share" ? "Lager..." : "Lag delbar lenke"}</SecondaryButton>
            </div>
            {!report.reportId ? <p className="mt-3 text-sm text-amber-200">Rapport må lagres før deling eller sending.</p> : null}
            {shareUrl ? <div className="mt-3 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-3 text-sm text-cyan-100"><p className="font-semibold">Delbar lenke</p><p className="mt-1 break-all">{shareUrl}</p></div> : null}
            {actionResult ? <div className="mt-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{actionResult}</div> : null}
          </PhoenixPanel>

          <PhoenixPanel title="Send rapport" description="Sender sikker rapportlenke via Resend. Krever RESEND_API_KEY i miljøet.">
            <form onSubmit={sendReport} className="grid gap-3 md:grid-cols-[1fr_1.4fr_auto]">
              <Field label="Mottaker"><TextInput type="email" value={sendForm.recipient_email} onChange={(event) => setSendForm((current) => ({ ...current, recipient_email: event.target.value }))} placeholder="kunde@example.no" /></Field>
              <Field label="Melding"><TextArea value={sendForm.message} onChange={(event) => setSendForm((current) => ({ ...current, message: event.target.value }))} placeholder="Kort valgfri melding..." /></Field>
              <div className="flex items-end"><PrimaryButton type="submit" disabled={!report.reportId || actionBusy === "send"}><Mail size={16} />{actionBusy === "send" ? "Sender..." : "Send"}</PrimaryButton></div>
            </form>
          </PhoenixPanel>

          <PhoenixPanel title="Subdomain discovery" description="Passiv DNS-sjekk av vanlige subdomener. Ingen portscan eller IP-range scanning.">
            {report.subdomains?.length ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {report.subdomains.map((item) => (
                  <article key={item.host} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                    <p className="font-semibold text-white">{item.host}</p>
                    {item.a?.length ? <p className="mt-1 text-xs text-slate-400">A: {item.a.join(", ")}</p> : null}
                    {item.cname?.length ? <p className="mt-1 text-xs text-slate-400">CNAME: {item.cname.join(", ")}</p> : null}
                  </article>
                ))}
              </div>
            ) : <EmptyState text="Ingen vanlige subdomener funnet i passiv DNS-sjekk." />}
          </PhoenixPanel>

          <PhoenixPanel title="Prioriterte tiltak" description="Funn som bør rettes først.">
            <div className="space-y-3">
              {report.actions?.length ? report.actions.map((action) => (
                <article key={action.id} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><h3 className="font-semibold text-white">{action.title}</h3><p className="mt-1 text-sm text-slate-300">{action.fix}</p></div>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${toneForSeverity(action.severity)}`}>{severityLabels[action.severity] || action.severity}</span>
                  </div>
                  {action.effort ? <p className="mt-2 text-xs text-slate-500">Estimert arbeid: {action.effort}</p> : null}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <SecondaryButton type="button" disabled={Boolean(actionBusy)} onClick={() => createCrmItem("lead", action)}>
                      <ShieldAlert size={15} />{actionBusy === `lead-${action.id}` ? "Oppretter..." : "Create CRM lead"}
                    </SecondaryButton>
                    <SecondaryButton type="button" disabled={Boolean(actionBusy)} onClick={() => createCrmItem("task", action)}>
                      <CheckCircle2 size={15} />{actionBusy === `task-${action.id}` ? "Oppretter..." : "Create task"}
                    </SecondaryButton>
                    <SecondaryButton type="button" disabled={Boolean(actionBusy)} onClick={() => createCrmItem("quote", action)}>
                      <FileText size={15} />{actionBusy === `quote-${action.id}` ? "Oppretter..." : "Create quote draft"}
                    </SecondaryButton>
                    <SecondaryButton type="button" disabled={Boolean(actionBusy) || !(report.customer_id || links.customer_id)} onClick={() => createCrmItem("note", action)}>
                      <MessageSquarePlus size={15} />{actionBusy === `note-${action.id}` ? "Lagrer..." : "Add customer note"}
                    </SecondaryButton>
                  </div>
                </article>
              )) : <EmptyState text="Ingen prioriterte tiltak." />}
            </div>
          </PhoenixPanel>

          <div className="grid gap-6 xl:grid-cols-2">
            <PhoenixPanel title="Funn som bør ses på">
              <div className="space-y-3">
                {problems.length ? problems.map((finding) => (
                  <article key={finding.id} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                    <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 text-amber-300" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-white">{finding.title}</p><span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${toneForSeverity(finding.severity)}`}>{severityLabels[finding.severity] || finding.severity}</span></div><p className="mt-1 text-sm text-slate-300">{finding.explain}</p><p className="mt-2 text-xs text-slate-500">{categoryLabels[finding.category] || finding.category}</p></div></div>
                  </article>
                )) : <EmptyState text="Ingen problemer funnet." />}
              </div>
            </PhoenixPanel>
            <PhoenixPanel title="Dette er på plass">
              <div className="space-y-3">
                {okFindings.length ? okFindings.map((finding) => (
                  <article key={finding.id} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                    <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-300" /><div><p className="font-semibold text-white">{finding.title}</p><p className="mt-1 text-sm text-slate-300">{finding.explain}</p></div></div>
                  </article>
                )) : <EmptyState text="Ingen OK-funn ennå." />}
              </div>
            </PhoenixPanel>
          </div>
        </>
      ) : null}
    </div>
  );
}
