"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { supabase } from "@/lib/supabaseClient";
import { LogOut, Settings } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import DashboardHeader from "./DashboardHeader";

export default function AdminDashboard() {
  const router = useRouter();
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(null);

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

  useEffect(() => {
    fetchQuotes();

    const channel = supabase
      .channel("requests-changes-admin")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "requests" },
        () => fetchQuotes()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [statusFilter]);

  const fetchQuotes = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from("requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter) {
        query = query.eq("status", DB_STATUS_MAP[statusFilter]);
      }

      const { data } = await query;
      setQuotes(data || []);
    } catch (err) {
      console.error("Error fetching quotes:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await supabase
        .from("requests")
        .update({ status: DB_STATUS_MAP[newStatus] })
        .eq("id", id);

      fetchQuotes();
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
  };

  const getStatusValue = (dbStatus) =>
    REVERSE_DB_STATUS_MAP[dbStatus] || "new";

  const counts = {
    new: quotes.filter((q) => getStatusValue(q.status) === "new").length,
    in_progress: quotes.filter(
      (q) => getStatusValue(q.status) === "in_progress"
    ).length,
    completed: quotes.filter(
      (q) => getStatusValue(q.status) === "completed"
    ).length,
  };

  return (
    <AdminLayout title="Admin Dashboard">
      <div className="p-6 space-y-6">

        {/* 🔹 HEADER MED BRUKERNAVN + SETTINGS */}
        <DashboardHeader />

        {/* 🔹 TOP BAR */}
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold text-white">Admin Dashboard</h1>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => router.push("/admin/services")}
              className="flex items-center gap-2"
            >
              <Settings size={18} />
              Services
            </Button>

            <Button
              variant="secondary"
              onClick={handleLogout}
              className="flex items-center gap-2"
            >
              <LogOut size={18} />
              Logout
            </Button>
          </div>
        </div>

        {/* 🔹 STATS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <p className="text-brand-400 text-sm">New</p>
            <p className="text-3xl font-bold text-accent-blue">
              {counts.new}
            </p>
          </Card>
          <Card>
            <p className="text-brand-400 text-sm">In Progress</p>
            <p className="text-3xl font-bold text-accent-orange">
              {counts.in_progress}
            </p>
          </Card>
          <Card>
            <p className="text-brand-400 text-sm">Completed</p>
            <p className="text-3xl font-bold text-accent-emerald">
              {counts.completed}
            </p>
          </Card>
        </div>

        {/* 🔹 REQUESTS */}
        <Card>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-white">
                Quote Requests
              </h2>

              <select
                className="bg-brand-900 border border-brand-700 rounded px-3 py-2 text-white"
                value={statusFilter || ""}
                onChange={(e) =>
                  setStatusFilter(e.target.value || null)
                }
              >
                <option value="">All</option>
                <option value="new">New</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
              </div>
            ) : quotes.length ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-brand-700">
                    <th className="text-left py-3">Name</th>
                    <th className="text-left py-3">Email</th>
                    <th className="text-left py-3">Status</th>
                    <th className="text-left py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((q) => (
                    <tr key={q.id} className="border-b border-brand-800">
                      <td className="py-3">{q.name}</td>
                      <td className="py-3 text-brand-300">{q.email}</td>
                      <td className="py-3">
                        <select
                          value={getStatusValue(q.status)}
                          onChange={(e) =>
                            handleStatusChange(q.id, e.target.value)
                          }
                          className="bg-brand-900 border border-brand-700 rounded px-2 py-1"
                        >
                          <option value="new">New</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                        </select>
                      </td>
                      <td className="py-3">
                        <button
                          onClick={() =>
                            router.push(`/admin/quote/${q.id}`)
                          }
                          className="text-accent-blue hover:underline"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-brand-400 text-center py-8">
                No requests yet.
              </p>
            )}
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}
