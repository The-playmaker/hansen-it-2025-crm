"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { RefreshCcw, Search, ExternalLink } from "lucide-react";

export default function QuotesPage() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/quotes?search=${encodeURIComponent(q)}`, {
        cache: "no-store",
      });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-white">Quotes</h1>
          <p className="text-brand-300 text-sm mt-1">
            Oversikt over alle requests/tilbud (requests-tabellen).
          </p>
        </div>

        <div className="flex gap-2 items-center flex-wrap">
          <div className="relative">
            <Search className="w-4 h-4 text-brand-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Søk navn / email / id…"
              className="pl-9 w-[280px]"
            />
          </div>
          <Button variant="outline" onClick={load} className="gap-2">
            <RefreshCcw size={16} /> Refresh
          </Button>
        </div>
      </div>

      <Card>
        {loading ? (
          <div className="py-10 text-center text-brand-300">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-brand-400">No quotes found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-800">
                  <th className="text-left py-3 px-4 text-white font-semibold">Name</th>
                  <th className="text-left py-3 px-4 text-white font-semibold">Email</th>
                  <th className="text-left py-3 px-4 text-white font-semibold">Status</th>
                  <th className="text-left py-3 px-4 text-white font-semibold">Created</th>
                  <th className="text-left py-3 px-4 text-white font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-brand-900 hover:bg-brand-900/40">
                    <td className="py-3 px-4 text-white">{r.name || "No name"}</td>
                    <td className="py-3 px-4 text-brand-300">{r.email || "-"}</td>
                    <td className="py-3 px-4 text-brand-300">{r.status || "Ny"}</td>
                    <td className="py-3 px-4 text-brand-500 text-xs">
                      {r.created_at ? new Date(r.created_at).toLocaleString() : "-"}
                    </td>
                    <td className="py-3 px-4">
                      <Button
                        variant="outline"
                        className="gap-2"
                        onClick={() => router.push(`/admin/quotes/${r.id}`)}
                      >
                        <ExternalLink size={16} /> Open
                      </Button>
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
