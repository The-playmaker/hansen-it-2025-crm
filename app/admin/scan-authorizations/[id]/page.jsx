"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Copy, Play } from "lucide-react";
import { EmptyState, formatDate, PhoenixPageHeader, PhoenixPanel, SecondaryButton, StatusBadge } from "@/components/phoenix/PhoenixUi";

function jobStatusText(job) {
  if (!job) return "Ingen scan job";
  return {
    queued: "Queued - waiting for scanner runner",
    running: "Running - scanner runner behandler jobben",
    completed: "Completed - scan er ferdig",
    failed: "Failed - se feilmelding under",
    cancelled: "Cancelled"
  }[job.status] || job.status;
}

export default function ScanAuthorizationDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [runningJob, setRunningJob] = useState(false);
  const [jobMessage, setJobMessage] = useState("");

  const portalUrl = useMemo(() => {
    if (!item?.token || typeof window === "undefined") return "";
    return `${window.location.origin}/portal/scan-authorization/${item.token}`;
  }, [item]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/scan-authorizations/${id}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Kunne ikke hente autorisasjon.");
      setItem(result.data);
    } catch (err) {
      setError(err.message || "Kunne ikke hente autorisasjon.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const copyLink = async () => {
    await navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const scope = item?.scan_scopes?.[0];
  const job = item?.scan_jobs?.[0];

  const runPassiveJob = async () => {
    if (!job?.id) return;
    setRunningJob(true);
    setError("");
    setJobMessage("");
    try {
      const response = await fetch(`/api/admin/scan-jobs/${job.id}/run-passive`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Kunne ikke kjore passiv scan-jobb.");
      setJobMessage(result.idle ? "Ingen queued jobber." : "Passiv scan-jobb er kjort ferdig.");
      await load();
    } catch (err) {
      setError(err.message || "Kunne ikke kjore passiv scan-jobb.");
      await load();
    } finally {
      setRunningJob(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PhoenixPageHeader
        eyebrow="Security"
        title="Scan Authorization"
        description="Detaljer, signert scope og scan_job-status. Queued betyr at jobben venter paa scanner-runner."
        action={<SecondaryButton type="button" onClick={() => router.push("/admin/scan-authorizations")}><ArrowLeft size={16} />Tilbake</SecondaryButton>}
      />

      {loading ? <PhoenixPanel><EmptyState text="Henter autorisasjon..." /></PhoenixPanel> : null}
      {error ? <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div> : null}

      {item ? (
        <>
          <PhoenixPanel title={item.customer_name} description={`Signatar: ${item.signer_name || "-"} - ${item.signer_email}`}>
            <div className="flex flex-wrap gap-2">
              <StatusBadge>{item.status}</StatusBadge>
              {job ? <StatusBadge>{jobStatusText(job)}</StatusBadge> : null}
              {item.signed_at ? <StatusBadge>signert {formatDate(item.signed_at)}</StatusBadge> : null}
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
              <p className="text-sm text-slate-400">Portal-lenke</p>
              <p className="mt-1 break-all text-sm text-cyan-200">{portalUrl}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <SecondaryButton type="button" onClick={copyLink}><Copy size={16} />{copied ? "Kopiert" : "Kopier lenke"}</SecondaryButton>
                <Link href={portalUrl} target="_blank"><SecondaryButton type="button">Aapne portal</SecondaryButton></Link>
              </div>
            </div>
          </PhoenixPanel>

          <div className="grid gap-6 xl:grid-cols-2">
            <PhoenixPanel title="Scope">
              {scope ? (
                <div className="space-y-4 text-sm">
                  <div><p className="text-slate-400">Scan-type</p><p className="font-semibold text-white">{scope.scan_type}</p></div>
                  <div><p className="text-slate-400">Domener</p><p className="whitespace-pre-wrap text-white">{(scope.domains || []).join("\n") || "-"}</p></div>
                  <div><p className="text-slate-400">IP-er</p><p className="whitespace-pre-wrap text-white">{(scope.ip_addresses || []).join("\n") || "-"}</p></div>
                  <div><p className="text-slate-400">Bekreftet av kunde</p><p className="text-white">{scope.confirmed_by_customer ? "Ja" : "Nei"}</p></div>
                </div>
              ) : <EmptyState text="Mangler scope." />}
            </PhoenixPanel>

            <PhoenixPanel title="Signatur og audit">
              <div className="space-y-3 text-sm">
                <div><p className="text-slate-400">Rolle</p><p className="text-white">{item.signer_role || "-"}</p></div>
                <div><p className="text-slate-400">IP-adresse</p><p className="text-white">{item.signed_ip || "-"}</p></div>
                <div><p className="text-slate-400">Timestamp</p><p className="text-white">{item.signed_at ? new Date(item.signed_at).toLocaleString("nb-NO") : "-"}</p></div>
                <div><p className="text-slate-400">Vilkar</p><p className="whitespace-pre-wrap text-slate-200">{item.terms_text}</p></div>
              </div>
            </PhoenixPanel>
          </div>

          <PhoenixPanel title="Scan job" description="Queue-status viser om jobben faktisk er plukket opp av scanner-runner. Queued betyr ikke at skanningen kjorer.">
            {job ? (
              <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 text-sm">
                <p className="font-semibold text-white">{jobStatusText(job)}</p>
                <p className="mt-1 text-slate-400">Queued: {job.queued_at ? new Date(job.queued_at).toLocaleString("nb-NO") : "-"}</p>
                <p className="mt-1 text-slate-400">Started: {job.started_at ? new Date(job.started_at).toLocaleString("nb-NO") : "-"}</p>
                <p className="mt-1 text-slate-400">Completed: {job.completed_at ? new Date(job.completed_at).toLocaleString("nb-NO") : "-"}</p>
                <p className="mt-1 text-slate-400">Type: {job.scan_type}</p>
                {job.status === "queued" ? <p className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-amber-100">Runner har ikke plukket opp jobben ennaa. Kjor `npm run scanner:run` paa scanner-node, eller test manuelt med knappen under.</p> : null}
                {job.error_message || job.error ? <p className="mt-3 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-rose-100">{job.error_message || job.error}</p> : null}
                {jobMessage ? <p className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-emerald-100">{jobMessage}</p> : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  <SecondaryButton type="button" disabled={runningJob || job.status !== "queued" || job.scan_type !== "passive"} onClick={runPassiveJob}>
                    <Play size={16} />{runningJob ? "Kjorer..." : "Kjor passiv scan naa"}
                  </SecondaryButton>
                </div>
              </div>
            ) : <EmptyState text="Ingen jobb ennaa. Jobb opprettes automatisk naar kunden signerer." />}
          </PhoenixPanel>
        </>
      ) : null}
    </div>
  );
}
