"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Copy } from "lucide-react";
import { EmptyState, formatDate, PhoenixPageHeader, PhoenixPanel, SecondaryButton, StatusBadge } from "@/components/phoenix/PhoenixUi";

export default function ScanAuthorizationDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const portalUrl = useMemo(() => {
    if (!item?.token || typeof window === "undefined") return "";
    return `${window.location.origin}/portal/scan-authorization/${item.token}`;
  }, [item]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/admin/scan-authorizations/${id}`, { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Kunne ikke hente autorisasjon.");
        if (!cancelled) setItem(result.data);
      } catch (err) {
        if (!cancelled) setError(err.message || "Kunne ikke hente autorisasjon.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (id) load();
    return () => { cancelled = true; };
  }, [id]);

  const copyLink = async () => {
    await navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const scope = item?.scan_scopes?.[0];
  const job = item?.scan_jobs?.[0];

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PhoenixPageHeader
        eyebrow="Security"
        title="Scan Authorization"
        description="Detaljer, signert scope og eventuell queued scan_job."
        action={<SecondaryButton type="button" onClick={() => router.push("/admin/scan-authorizations")}><ArrowLeft size={16} />Tilbake</SecondaryButton>}
      />

      {loading ? <PhoenixPanel><EmptyState text="Henter autorisasjon..." /></PhoenixPanel> : null}
      {error ? <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div> : null}

      {item ? (
        <>
          <PhoenixPanel title={item.customer_name} description={`Signatar: ${item.signer_name || "-"} · ${item.signer_email}`}>
            <div className="flex flex-wrap gap-2">
              <StatusBadge>{item.status}</StatusBadge>
              {job ? <StatusBadge>scan_job: {job.status}</StatusBadge> : null}
              {item.signed_at ? <StatusBadge>signert {formatDate(item.signed_at)}</StatusBadge> : null}
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
              <p className="text-sm text-slate-400">Portal-lenke</p>
              <p className="mt-1 break-all text-sm text-cyan-200">{portalUrl}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <SecondaryButton type="button" onClick={copyLink}><Copy size={16} />{copied ? "Kopiert" : "Kopier lenke"}</SecondaryButton>
                <Link href={portalUrl} target="_blank"><SecondaryButton type="button">Åpne portal</SecondaryButton></Link>
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
                <div><p className="text-slate-400">Vilkår</p><p className="whitespace-pre-wrap text-slate-200">{item.terms_text}</p></div>
              </div>
            </PhoenixPanel>
          </div>

          <PhoenixPanel title="Scan job">
            {job ? (
              <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 text-sm">
                <p className="font-semibold text-white">{job.status}</p>
                <p className="mt-1 text-slate-400">Queued: {job.queued_at ? new Date(job.queued_at).toLocaleString("nb-NO") : "-"}</p>
                <p className="mt-1 text-slate-400">Type: {job.scan_type}</p>
              </div>
            ) : <EmptyState text="Ingen jobb ennå. Jobb opprettes automatisk når kunden signerer." />}
          </PhoenixPanel>
        </>
      ) : null}
    </div>
  );
}
