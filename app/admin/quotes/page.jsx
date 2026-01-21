"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function QuotesPage() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("requests")
          .select("id, name, email, status, created_at")
          .order("created_at", { ascending: false })
          .limit(200);

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

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Quotes</h1>
        <p className="text-sm text-brand-300">Open a quote to edit, assign and create portal link.</p>
      </div>

      <Card>
        {loading ? (
          <div className="py-10 text-center text-brand-300">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-brand-300">No quotes yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-800">
                  <th className="text-left py-3 px-4 text-white">Customer</th>
                  <th className="text-left py-3 px-4 text-white">Email</th>
                  <th className="text-left py-3 px-4 text-white">Status</th>
                  <th className="text-left py-3 px-4 text-white">Created</th>
                  <th className="text-right py-3 px-4 text-white">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-brand-800 hover:bg-brand-900/40">
                    <td className="py-3 px-4 text-white">{r.name || "-"}</td>
                    <td className="py-3 px-4 text-brand-300">{r.email || "-"}</td>
                    <td className="py-3 px-4 text-brand-300">{r.status || "-"}</td>
                    <td className="py-3 px-4 text-brand-400 text-xs">
                      {r.created_at ? new Date(r.created_at).toLocaleString() : "-"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button onClick={() => router.push(`/admin/quote/${r.id}`)}>Open</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
