"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { RefreshCcw } from "lucide-react";

function isoDate(d) {
  // yyyy-mm-dd
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function CalendarPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedDate, setSelectedDate] = useState(isoDate(new Date()));

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("requests")
        .select("id,name,email,status,created_at,scheduled_date")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (e) {
      console.error("calendar fetch error:", e);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const scheduledForSelected = useMemo(() => {
    return requests.filter((r) => (r.scheduled_date || "") === selectedDate);
  }, [requests, selectedDate]);

  const unscheduled = useMemo(() => {
    return requests.filter((r) => !r.scheduled_date);
  }, [requests]);

  const setScheduledDate = async (id, dateStr) => {
    try {
      const { error } = await supabase
        .from("requests")
        .update({ scheduled_date: dateStr })
        .eq("id", id);

      if (error) throw error;

      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, scheduled_date: dateStr } : r))
      );
    } catch (e) {
      console.error("setScheduledDate error:", e);
      alert(
        e?.message ||
          "Kunne ikke sette dato. Sjekk at requests.scheduled_date finnes i databasen."
      );
    }
  };

  const clearScheduledDate = async (id) => {
    try {
      const { error } = await supabase
        .from("requests")
        .update({ scheduled_date: null })
        .eq("id", id);

      if (error) throw error;

      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, scheduled_date: null } : r))
      );
    } catch (e) {
      console.error("clearScheduledDate error:", e);
      alert(e?.message || "Kunne ikke fjerne dato.");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Calendar / Planner</h1>
          <p className="text-brand-300 text-sm mt-1">
            Planlegg requests på dato (scheduled_date).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-brand-900 border border-brand-700 rounded-lg px-4 py-2 text-white"
          />
          <Button variant="outline" onClick={refresh} className="gap-2">
            <RefreshCcw size={16} /> Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-10 text-center text-brand-300">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h2 className="text-xl font-bold text-white mb-2">
              Scheduled for {selectedDate}
            </h2>
            <p className="text-brand-300 text-sm mb-4">
              {scheduledForSelected.length} item(s)
            </p>

            <div className="space-y-2">
              {scheduledForSelected.length === 0 ? (
                <div className="text-sm text-brand-400">No scheduled items.</div>
              ) : (
                scheduledForSelected.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-lg border border-brand-800 bg-brand-900/40 p-3"
                  >
                    <div className="text-white font-medium">{r.name || "No name"}</div>
                    <div className="text-xs text-brand-300">{r.email || "-"}</div>
                    <div className="text-xs text-brand-400 mt-1">
                      Status: <span className="text-white">{r.status || "Ny"}</span>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <Button variant="outline" onClick={() => clearScheduledDate(r.id)}>
                        Remove date
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card>
            <h2 className="text-xl font-bold text-white mb-2">Unscheduled</h2>
            <p className="text-brand-300 text-sm mb-4">
              Sett dato = {selectedDate}
            </p>

            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {unscheduled.length === 0 ? (
                <div className="text-sm text-brand-400">No unscheduled items.</div>
              ) : (
                unscheduled.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-lg border border-brand-800 bg-brand-900/40 p-3"
                  >
                    <div className="text-white font-medium">{r.name || "No name"}</div>
                    <div className="text-xs text-brand-300">{r.email || "-"}</div>
                    <div className="text-xs text-brand-500 mt-2">
                      Created:{" "}
                      {r.created_at ? new Date(r.created_at).toLocaleString() : "-"}
                    </div>

                    <div className="mt-3 flex gap-2">
                      <Button onClick={() => setScheduledDate(r.id, selectedDate)}>
                        Set date
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="text-xs text-brand-400 mt-4">
              Krever `requests.scheduled_date` (date eller text yyyy-mm-dd).
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
