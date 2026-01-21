"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function PortalLinksPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const base = useMemo(() => {
    // fungerer både lokalt og på prod
    if (typeof window === "undefined") return "";
    return window.location.origin;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);

        const { data, error } = await supabase
          .from("quote_portal_tokens")
          .select("id, token, quote_id, expires_at, created_at")
          .order("created_at", { ascending: false })
          .limit(100);

        if (error) throw error;

        setRows(data || []);
      } catch (e) {
        console.error(e);
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const isExpired = (expires_at) => {
    if (!expires_at) return false;
    return new Date(expires_at) < new Date();
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Portal links</h1>
        <p className="text-sm text-brand-300">
          Klikk “Open” for å teste kundeportalen. (Token må finnes.)
        </p>
      </div>

      <Card>
        {loading ? (
          <div className="py-10 text-center text-brand-300">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-brand-300">
            No portal tokens yet. Create one from a quote.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-800">
                  <th className="text-left py-3 px-4 text-white">Quote</th>
                  <th className="text-left py-3 px-4 text-white">Expires</th>
                  <th className="text-left py-3 px-4 text-white">Created</th>
                  <th className="text-right py-3 px-4 text-white">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const expired = isExpired(r.expires_at);
                  const url = `${base}/portal/${r.token}`;

                  return (
                    <tr key={r.id} className="border-b border-brand-800 hover:bg-brand-900/40">
                      <td className="py-3 px-4 text-white">
                        <div className="font-medium">{r.quote_id}</div>
                        <div className="text-xs text-brand-500 break-all">{r.token}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-xs px-2 py-1 rounded border ${
                            expired
                              ? "border-red-500/40 bg-red-500/10 text-red-200"
                              : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                          }`}
                        >
                          {r.expires_at ? new Date(r.expires_at).toLocaleString() : "No expiry"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-brand-400 text-xs">
                        {r.created_at ? new Date(r.created_at).toLocaleString() : "-"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            onClick={() => navigator.clipboard.writeText(url)}
                          >
                            Copy
                          </Button>
                          <Button
                            onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
                            disabled={!base || expired}
                          >
                            Open
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
