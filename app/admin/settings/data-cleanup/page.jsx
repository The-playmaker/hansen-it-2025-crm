"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SectionCard } from "@/components/ui/SectionCard";
import { useMe } from "@/app/admin/useMe";

function CountTable({ counts = [] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10">
      <table className="w-full text-left text-sm">
        <thead className="bg-white/5 text-slate-300">
          <tr><th className="px-3 py-2">Område</th><th className="px-3 py-2">Antall</th><th className="px-3 py-2">Status</th></tr>
        </thead>
        <tbody>
          {counts.map((item) => (
            <tr key={item.key} className="border-t border-white/10">
              <td className="px-3 py-2 text-white">{item.key}</td>
              <td className="px-3 py-2 text-slate-200">{item.count}</td>
              <td className="px-3 py-2 text-slate-400">{item.error || "OK"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DataCleanupPage() {
  const { me, loading } = useMe();
  const [kind, setKind] = useState("test");
  const [counts, setCounts] = useState([]);
  const [confirmation, setConfirmation] = useState("");
  const [fullRistesund, setFullRistesund] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadCounts = useCallback(async (nextKind = kind) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/settings/data-cleanup?kind=${nextKind}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Kunne ikke hente antall.");
      setCounts(json.counts || []);
    } catch (err) {
      setError(err.message || "Kunne ikke hente antall.");
    } finally {
      setBusy(false);
    }
  }, [kind]);

  useEffect(() => { if (me?.role === "admin") loadCounts(kind); }, [me, kind, loadCounts]);

  const runCleanup = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/settings/data-cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, confirmation, fullRistesund }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Opprydding feilet.");
      setCounts(json.counts || []);
      setMessage(`Opprydding ferdig. ${json.deleted?.reduce((sum, item) => sum + Number(item.deleted || 0), 0) || 0} rader slettet.`);
      setConfirmation("");
    } catch (err) {
      setError(err.message || "Opprydding feilet.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="p-6 text-slate-300">Laster...</div>;
  if (me?.role !== "admin") return <div className="p-6 text-slate-300">Kun admin har tilgang.</div>;

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div>
        <p className="text-sm uppercase tracking-wide text-cyan-200">Admin cleanup</p>
        <h1 className="mt-2 text-3xl font-bold text-white">Data-opprydding</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">Trygg opprydding av testdata. Systemdata som produktpakker slettes ikke.</p>
      </div>

      <SectionCard title="Velg opprydding" description="Standardvalg sletter bare test/demo-data. Ristesund reset er eksplisitt fordi det er en konkret testflyt.">
        <div className="flex flex-wrap gap-2">
          <Button variant={kind === "test" ? "primary" : "outline"} onClick={() => { setKind("test"); setFullRistesund(false); }}>Testdata-opprydding</Button>
          <Button variant={kind === "ristesund" ? "primary" : "outline"} onClick={() => setKind("ristesund")}>Ristesund reset</Button>
          <Button variant="outline" onClick={() => loadCounts(kind)} disabled={busy}><RefreshCw size={16} /> Oppdater antall</Button>
        </div>
        {kind === "ristesund" ? (
          <label className="mt-4 flex items-center gap-2 text-sm text-amber-100">
            <input type="checkbox" checked={fullRistesund} onChange={(event) => setFullRistesund(event.target.checked)} />
            Full reset av Ristesund testflow, inkludert customer/contact/request. Bruk bare hvis du virkelig vil starte helt på nytt.
          </label>
        ) : null}
      </SectionCard>

      <SectionCard title="Forhåndsvisning" description="Dette er antall rader som matcher oppryddingsreglene.">
        <CountTable counts={counts} />
      </SectionCard>

      <SectionCard title="Bekreft sletting" description="Skriv SLETT TESTDATA for å aktivere knappen.">
        <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          <div className="flex items-start gap-2"><AlertTriangle size={18} /><span>Ingen generell delete-all finnes her. Opprydding er begrenset til test/demo-regler eller eksplisitt Ristesund reset.</span></div>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="SLETT TESTDATA" />
          <Button onClick={runCleanup} disabled={busy || confirmation !== "SLETT TESTDATA"} className="gap-2 bg-rose-500 hover:bg-rose-400">
            <Trash2 size={16} /> {busy ? "Sletter..." : "Slett valgte testdata"}
          </Button>
        </div>
        {message ? <p className="mt-3 text-sm text-emerald-200">{message}</p> : null}
        {error ? <p className="mt-3 text-sm text-rose-200">{error}</p> : null}
      </SectionCard>
    </div>
  );
}
