"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

const STATUSES = ["Ny", "Pågår", "Fullført"];

export default function KanbanPage() {
  const [quotes, setQuotes] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");

  useEffect(() => {
    fetchAll();

    const channel = supabase
      .channel("requests-kanban")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "requests" },
        () => fetchQuotes()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchQuotes(), fetchEmployees()]);
    setLoading(false);
  };

  const fetchQuotes = async () => {
    try {
      const { data, error } = await supabase
        .from("requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setQuotes(data || []);
    } catch (e) {
      console.error("Error fetching requests:", e);
      setQuotes([]);
    }
  };

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("id,name,email,role")
        .order("name", { ascending: true });

      if (error) throw error;
      setEmployees(data || []);
    } catch (e) {
      console.error("Error fetching employees:", e);
      setEmployees([]);
    }
  };

  const filteredQuotes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return quotes;

    return quotes.filter((r) => {
      const hay = [
        r.name,
        r.email,
        r.company,
        r.phone,
        r.description,
        r.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [quotes, query]);

  const getEmployeeName = (empId) => {
    if (!empId) return null;
    const emp = employees.find((e) => e.id === empId);
    return emp ? emp.name : null;
  };

  const getColumnQuotes = (status) =>
    filteredQuotes.filter((q) => (q.status || "Ny") === status);

  const setStatus = async (id, newStatus) => {
    try {
      const { error } = await supabase
        .from("requests")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;
      // channel refreshes, but keep it snappy:
      setQuotes((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
      );
    } catch (e) {
      console.error("Error updating status:", e);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Kanban</h1>
          <p className="text-brand-300 text-sm mt-1">
            Drag/drop kan vi legge på senere – nå får du et stabilt status-board.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="bg-brand-900 border border-brand-700 rounded-lg px-4 py-2 text-white w-72"
          />
          <Button variant="outline" onClick={fetchAll}>
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-10 text-center text-brand-300">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {STATUSES.map((status) => {
            const items = getColumnQuotes(status);

            return (
              <Card key={status}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white">{status}</h2>
                  <span className="text-xs text-brand-300">{items.length}</span>
                </div>

                <div className="space-y-3">
                  {items.length === 0 ? (
                    <div className="text-sm text-brand-400">Ingen saker her.</div>
                  ) : (
                    items.map((q) => (
                      <div
                        key={q.id}
                        className="rounded-lg border border-brand-800 bg-brand-900/40 p-3 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-white font-medium">
                              {q.name || "No name"}
                            </div>
                            <div className="text-xs text-brand-300">
                              {q.email || "-"}
                              {q.company ? ` · ${q.company}` : ""}
                            </div>
                          </div>

                          <select
                            value={q.status || "Ny"}
                            onChange={(e) => setStatus(q.id, e.target.value)}
                            className="bg-brand-950 border border-brand-700 rounded px-2 py-1 text-xs text-white"
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>

                        {q.employee_id ? (
                          <div className="text-xs text-brand-300">
                            Assigned:{" "}
                            <span className="text-white">
                              {getEmployeeName(q.employee_id) || q.employee_id}
                            </span>
                          </div>
                        ) : null}

                        {q.description ? (
                          <div className="text-xs text-brand-300 line-clamp-3">
                            {q.description}
                          </div>
                        ) : null}

                        <div className="text-[11px] text-brand-500">
                          {q.created_at
                            ? new Date(q.created_at).toLocaleString()
                            : ""}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
