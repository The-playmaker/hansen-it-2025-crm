"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FileText, RefreshCcw } from "lucide-react";

export default function QuotesPage() {
  const router = useRouter();
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  const fetchQuotes = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("requests")
        .select("id,name,email,status,created_at")
        .order("created_at", { ascending: false });

      if (statusFilter) {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      setQuotes(data || []);
    } catch (e) {
      console.error("quotes fetch error:", e);
      setQuotes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-white">Quotes</h1>
          <p className="text-brand-300 text-sm mt-1">
            Alle innkommende forespørsler / tilbud
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-brand-900 border border-brand-700 rounded-lg px-3 py-2 text-white text-sm"
          >
            <option value="">Alle statuser</option>
            <option value="Ny">Ny</option>
            <option value="Pågår">Pågår</option>
            <option value="Fullført">Fullført</option>
          </select>

          <Button variant="outline" onClick={fetchQuotes} className="gap-2">
            <RefreshCcw size={16} /> Refresh
          </Button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-10 text-center text-brand-300">Loading…</div>
      ) : quotes.length === 0 ? (
        <div className="text-brand-400 text-sm">Ingen quotes funnet.</div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {quotes.map((q) => (
            <Card
              key={q.id}
              className="flex items-center justify-between gap-4 hover:bg-brand-900/40 transition cursor-pointer"
              onClick={() => router.push(`/admin/quotes/${q.id}`)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-5 h-5 text-accent-blue shrink-0" />

                <div className="min-w-0">
                  <div className="text-white font-medium truncate">
                    {q.name || "No name"}
                  </div>
                  <div className="text-xs text-brand-400 truncate">
                    {q.email || "-"}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <span
                  className={`text-xs px-2 py-1 rounded-full border ${
                    q.status === "Ny"
                      ? "border-blue-500/40 bg-blue-500/10 text-blue-200"
                      : q.status === "Pågår"
                      ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-200"
                      : q.status === "Fullført"
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                      : "border-brand-700 bg-brand-800 text-brand-300"
                  }`}
                >
                  {q.status || "Ny"}
                </span>

                <div className="text-xs text-brand-500">
                  {q.created_at
                    ? new Date(q.created_at).toLocaleDateString()
                    : "-"}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
