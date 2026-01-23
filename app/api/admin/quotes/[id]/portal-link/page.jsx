"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Copy, ExternalLink, RefreshCcw } from "lucide-react";

export default function PortalLinksPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/portal-links", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed");
      setRows(json.data || []);
    } catch (e) {
      console.error(e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-white">Portal links</h1>
          <p className="text-brand-300 text-sm mt-1">
            Tokens fra <code className="text-brand-200">quote_portal_tokens</code>.
          </p>
        </div>

        <Button variant="outline" onClick={load} className="gap-2">
          <RefreshCcw size={16} /> Refresh
        </Button>
      </div>

      <Card>
        {loading ? (
          <div className="py-10 text-center text-brand-300">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-brand-400">No portal links.</div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => {
              const url = `${origin}/portal/${r.token}`;
              return (
                <div
                  key={r.token}
                  className="border border-brand-800 rounded-lg p-3 bg-brand-900/30 flex items-start justify-between gap-3 flex-wrap"
                >
                  <div className="min-w-[280px]">
                    <div className="text-white font-medium">
                      {r.quote?.name || "Unknown"}{" "}
                      <span className="text-brand-500 text-xs font-mono">
                        ({r.quote_id})
                      </span>
                    </div>
                    <div className="text-brand-300 text-sm">{r.quote?.email || "-"}</div>
                    <div className="text-brand-500 text-xs mt-1">
                      Expires:{" "}
                      {r.expires_at ? new Date(r.expires_at).toLocaleString() : "-"}
                    </div>
                    <div className="text-brand-300 text-sm break-all mt-2">{url}</div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => navigator.clipboard.writeText(url)}
                    >
                      <Copy size={16} /> Copy
                    </Button>
                    <Button
                      className="gap-2"
                      onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
                    >
                      <ExternalLink size={16} /> Open
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
