"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card } from "@/components/ui/Card";

export default function AdminQuotesPage() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  const fetchRows = async () => {
    try {
      setLoading(true);

      let q = supabase
        .from("requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter) q = q.eq("status", statusFilter);

      const { data, error } = await q;
      if (error) throw error;

      setRows(data || []);
    } catch (e) {
      console.error(e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();

    const channel = supabase
      .channel("requests-changes-quotes")
      .on("postgres_changes", { event: "*", schema: "public", table: "requests" }, () => {
        fetchRows();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  return (
    <AdminLayout title="Quotes">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-3xl font-bold text-white">Quotes</h1>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-brand-900 border border-brand-700 rounded-lg px-4 py-2 text-white"
          >
            <option value="">All</option>
            <option value="Ny">Ny</option>
            <option value="Pågår">Pågår</option>
            <option value="Fullført">Fullført</option>
          </select>
        </div>

        <Card>
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 rounded-full border-2 border-accent-blue border-t-transparent animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-brand-400">No quotes yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-brand-700">
                    <th className="text-left py-3 px-4 font-semibold text-white">Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-white">Email</th>
                    <th className="text-left py-3 px-4 font-semibold text-white">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-white">Created</th>
                    <th className="text-left py-3 px-4 font-semibold text-white">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-brand-800 hover:bg-brand-900/40">
                      <td className="py-3 px-4 text-white">{r.name || "-"}</td>
                      <td className="py-3 px-4 text-brand-300">{r.email || "-"}</td>
                      <td className="py-3 px-4 text-brand-300">{r.status || "Ny"}</td>
                      <td className="py-3 px-4 text-brand-300 text-xs">
                        {r.created_at ? new Date(r.created_at).toLocaleString() : "-"}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => router.push(`/admin/quote/${r.id}`)}
                          className="text-accent-blue hover:text-accent-cyan font-medium"
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
}
