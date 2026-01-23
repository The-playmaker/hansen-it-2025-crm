"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { AdminShell } from "@/components/admin/AdminShell";

export default function QuotesPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("requests")
        .select("id,name,email,status,created_at,priority")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRows(data || []);
    } catch (e) {
      console.error("quotes fetch error:", e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <AdminShell>
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-white">Quotes</h1>
            <p className="text-brand-300 text-sm mt-1">
              Alle forespørsler (requests) – trykk for å åpne.
            </p>
          </div>

          <button
            onClick={load}
            className="px-4 py-2 rounded-lg border border-brand-700 text-white hover:bg-brand-900/40"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="py-10 text-center text-brand-300">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-brand-400">Ingen requests enda.</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-brand-800">
            <table className="w-full text-sm">
              <thead className="bg-brand-900/40">
                <tr className="border-b border-brand-800">
                  <th className="text-left py-3 px-4 font-semibold text-white">Name</th>
                  <th className="text-left py-3 px-4 font-semibold text-white">Email</th>
                  <th className="text-left py-3 px-4 font-semibold text-white">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-white">Created</th>
                  <th className="text-left py-3 px-4 font-semibold text-white">Open</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-brand-800 hover:bg-brand-900/30">
                    <td className="py-3 px-4 text-white">{r.name || "—"}</td>
                    <td className="py-3 px-4 text-brand-300">{r.email || "—"}</td>
                    <td className="py-3 px-4 text-brand-300">{r.status || "Ny"}</td>
                    <td className="py-3 px-4 text-brand-400 text-xs">
                      {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                    </td>
                    <td className="py-3 px-4">
                      <Link
                        href={`/admin/quote/${r.id}`}
                        className="text-accent-blue hover:text-accent-cyan underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
