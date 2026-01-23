"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function QuotesPage() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  const DB_STATUS_MAP = {
    new: "Ny",
    in_progress: "Pågår",
    completed: "Fullført",
  };

  const REVERSE_DB_STATUS_MAP = {
    Ny: "new",
    Pågår: "in_progress",
    Fullført: "completed",
  };

  const getStatusValue = (dbStatus) => REVERSE_DB_STATUS_MAP[dbStatus] || "new";
  const toDbStatus = (uiStatus) => DB_STATUS_MAP[uiStatus] || uiStatus;

  const filtered = useMemo(() => {
    if (!statusFilter) return rows;
    const dbStatus = toDbStatus(statusFilter);
    return rows.filter((r) => (r.status || "Ny") === dbStatus);
  }, [rows, statusFilter]);

  const refresh = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("requests")
        .select("id,name,email,phone,status,created_at,priority")
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
    refresh();

    const channel = supabase
      .channel("requests-changes-quotes")
      .on("postgres_changes", { event: "*", schema: "public", table: "requests" }, () => {
        refresh();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateStatus = async (id, uiStatus) => {
    const dbStatus = toDbStatus(uiStatus);
    try {
      const { error } = await supabase.from("requests").update({ status: dbStatus }).eq("id", id);
      if (error) throw error;

      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: dbStatus } : r)));
    } catch (e) {
      console.error("updateStatus error:", e);
      alert(e?.message || "Kunne ikke oppdatere status");
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-white">Quotes</h1>
          <p className="text-brand-300 text-sm mt-1">Oversikt over alle requests/tilbud.</p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-brand-900 border border-brand-700 rounded-lg px-4 py-2 text-white"
          >
            <option value="">All</option>
            <option value="new">New</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
          </select>

          <button
            onClick={refresh}
            className="bg-brand-900 border border-brand-700 rounded-lg px-4 py-2 text-white hover:bg-brand-800"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-10 text-center text-brand-300">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center text-brand-400">No quotes.</div>
      ) : (
        <div className="overflow-x-auto border border-brand-800 rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-brand-900/60">
              <tr className="border-b border-brand-800">
                <th className="text-left py-3 px-4 font-semibold text-white">Name</th>
                <th className="text-left py-3 px-4 font-semibold text-white">Email</th>
                <th className="text-left py-3 px-4 font-semibold text-white">Phone</th>
                <th className="text-left py-3 px-4 font-semibold text-white">Status</th>
                <th className="text-left py-3 px-4 font-semibold text-white">Created</th>
                <th className="text-left py-3 px-4 font-semibold text-white">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-brand-800 hover:bg-brand-900/40">
                  <td className="py-3 px-4 text-white">{r.name || "No name"}</td>
                  <td className="py-3 px-4 text-brand-300">{r.email || "-"}</td>
                  <td className="py-3 px-4 text-brand-300">{r.phone || "-"}</td>
                  <td className="py-3 px-4">
                    <select
                      value={getStatusValue(r.status || "Ny")}
                      onChange={(e) => updateStatus(r.id, e.target.value)}
                      className="bg-brand-950 border border-brand-700 rounded-lg px-3 py-1 text-white"
                    >
                      <option value="new">New</option>
                      <option value="in_progress">In progress</option>
                      <option value="completed">Completed</option>
                    </select>
                  </td>
                  <td className="py-3 px-4 text-brand-400 text-xs">
                    {r.created_at ? new Date(r.created_at).toLocaleString() : "-"}
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => router.push(`/admin/quotes/${r.id}`)}
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
    </div>
  );
}
