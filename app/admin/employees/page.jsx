"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Trash2, Plus, RefreshCcw, UserPlus } from "lucide-react";

const ROLES = ["admin", "manager", "worker"];

export default function EmployeesPage() {
  const [me, setMe] = useState(null);

  const [employees, setEmployees] = useState([]);

  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "worker",
  });

  // assignment panel
  const [assignEmpId, setAssignEmpId] = useState("");
  const [assignRequestId, setAssignRequestId] = useState("");
  const [assignStatus, setAssignStatus] = useState("Ny");

  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMe(d))
      .catch(() => setMe(null));
  }, []);

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshAll = async () => {
    setLoading(true);
    await fetchEmployees();
    setLoading(false);
  };

  const fetchEmployees = async () => {
    try {
      const response = await fetch("/api/admin/employees");
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch employees");
      }
      setEmployees(result.data || []);
    } catch (e) {
      console.error("fetchEmployees error:", e);
      setEmployees([]);
    }
  };

  const filteredEmployees = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => {
      const hay = `${e.name || ""} ${e.email || ""} ${e.role || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [employees, query]);

  const resetForm = () => {
    setForm({ name: "", email: "", role: "worker" });
    setEditingId(null);
    setShowForm(false);
  };

  const startCreate = () => {
    setForm({ name: "", email: "", role: "worker" });
    setEditingId(null);
    setShowForm(true);
  };

  const startEdit = (emp) => {
    setForm({
      name: emp.name || "",
      email: emp.email || "",
      role: emp.role || "worker",
    });
    setEditingId(emp.id);
    setShowForm(true);
  };

  const saveEmployee = async (e) => {
    e.preventDefault();

    if (me?.role !== "admin") {
      alert("Kun admin kan endre ansatte/roller.");
      return;
    }

    try {
      const url = editingId ? `/api/admin/employees/${editingId}` : "/api/admin/employees";
      const method = editingId ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to save employee");
      }

      await fetchEmployees();
      resetForm();
    } catch (err) {
      console.error("saveEmployee error:", err);
      alert(err?.message || "Kunne ikke lagre.");
    }
  };

  const deleteEmployee = async (id) => {
    if (me?.role !== "admin") {
      alert("Kun admin kan slette ansatte.");
      return;
    }
    if (!confirm("Slette ansatt?")) return;

    try {
      const response = await fetch(`/api/admin/employees/${id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to delete employee");
      }

      await fetchEmployees();
    } catch (err) {
      console.error("deleteEmployee error:", err);
      alert(err?.message || "Kunne ikke slette.");
    }
  };

  const changeRoleInline = async (empId, role) => {
    if (me?.role !== "admin") {
      alert("Kun admin kan endre roller.");
      return;
    }
    try {
      const response = await fetch(`/api/admin/employees/${empId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to change role");
      }

      setEmployees((prev) => prev.map((e) => (e.id === empId ? { ...e, role } : e)));
    } catch (err) {
      console.error("changeRoleInline error:", err);
      alert(err?.message || "Kunne ikke endre rolle.");
    }
  };

  const unassignedRequests = useMemo(() => {
    return requests.filter((r) => !r.employee_id);
  }, [requests]);

  const assignRequest = async () => {
    if (me?.role !== "admin" && me?.role !== "manager") {
      alert("Kun admin/manager kan assign requests.");
      return;
    }
    if (!assignEmpId || !assignRequestId) {
      alert("Velg ansatt og request.");
      return;
    }

    try {
      const { error } = await supabase
        .from("requests")
        .update({
          employee_id: assignEmpId,
          status: assignStatus || "Ny",
        })
        .eq("id", assignRequestId);

      if (error) throw error;

      setAssignEmpId("");
      setAssignRequestId("");
      setAssignStatus("Ny");
      await fetchRequests();
    } catch (err) {
      console.error("assignRequest error:", err);
      alert(err?.message || "Kunne ikke assign.");
    }
  };

  const empNameById = (id) => employees.find((e) => e.id === id)?.name || id;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Team / Employees</h1>
          <p className="text-brand-300 text-sm mt-1">
            CRUD + rolle-endring + assignment av requests.
          </p>
          <p className="text-brand-400 text-xs mt-1">
            Innlogget: {me?.email || "…"} · Rolle: {me?.role || "…"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="bg-brand-900 border border-brand-700 rounded-lg px-4 py-2 text-white w-64"
          />
          <Button variant="outline" onClick={refreshAll} className="gap-2">
            <RefreshCcw size={16} /> Refresh
          </Button>

          <Button onClick={startCreate} className="gap-2">
            <UserPlus size={16} /> New employee
          </Button>
        </div>
      </div>

      {/* Create/Edit form */}
      {showForm && (
        <Card>
          <form onSubmit={saveEmployee} className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-brand-200">Name</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-brand-200">Email</label>
                <Input
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-brand-200">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                  className="bg-brand-900 border border-brand-700 rounded-lg px-4 py-2 text-white"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <Button type="submit">{editingId ? "Save changes" : "Create employee"}</Button>
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            </div>

            {me?.role !== "admin" ? (
              <div className="text-xs text-yellow-300">
                Merk: Kun admin kan lagre endringer. (Dette er UI-sperre – du bør også sperre på server/RLS.)
              </div>
            ) : null}
          </form>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Employees table */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Employees</h2>
            <span className="text-xs text-brand-300">{filteredEmployees.length}</span>
          </div>

          {loading ? (
            <div className="py-6 text-center text-brand-300">Loading…</div>
          ) : filteredEmployees.length === 0 ? (
            <div className="py-6 text-center text-brand-300">No employees.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-brand-800">
                    <th className="text-left py-3 px-3 text-white">Name</th>
                    <th className="text-left py-3 px-3 text-white">Email</th>
                    <th className="text-left py-3 px-3 text-white">Role</th>
                    <th className="text-right py-3 px-3 text-white">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((e) => (
                    <tr key={e.id} className="border-b border-brand-800 hover:bg-brand-900/40">
                      <td className="py-3 px-3 text-white">{e.name}</td>
                      <td className="py-3 px-3 text-brand-300">{e.email}</td>
                      <td className="py-3 px-3">
                        <select
                          value={e.role || "worker"}
                          onChange={(ev) => changeRoleInline(e.id, ev.target.value)}
                          className="bg-brand-950 border border-brand-700 rounded px-2 py-1 text-xs text-white"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => startEdit(e)}>
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => deleteEmployee(e.id)}
                            className="gap-2"
                          >
                            <Trash2 size={16} />
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Assignment panel */}
        <Card>
          <h2 className="text-xl font-bold text-white mb-2">Assign request</h2>
          <p className="text-brand-300 text-sm mb-4">
            Sett request → employee + status.
          </p>

          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm text-brand-200">Employee</label>
              <select
                value={assignEmpId}
                onChange={(e) => setAssignEmpId(e.target.value)}
                className="bg-brand-900 border border-brand-700 rounded-lg px-4 py-2 text-white w-full"
              >
                <option value="">Choose…</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({e.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-brand-200">Request (unassigned)</label>
              <select
                value={assignRequestId}
                onChange={(e) => setAssignRequestId(e.target.value)}
                className="bg-brand-900 border border-brand-700 rounded-lg px-4 py-2 text-white w-full"
              >
                <option value="">Choose…</option>
                {unassignedRequests.map((r) => (
                  <option key={r.id} value={r.id}>
                    {(r.name || "No name") + " · " + (r.email || "-")}{" "}
                    {r.status ? `· ${r.status}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-brand-200">Set status</label>
              <select
                value={assignStatus}
                onChange={(e) => setAssignStatus(e.target.value)}
                className="bg-brand-900 border border-brand-700 rounded-lg px-4 py-2 text-white w-full"
              >
                <option value="Ny">Ny</option>
                <option value="Pågår">Pågår</option>
                <option value="Fullført">Fullført</option>
              </select>
            </div>

            <Button onClick={assignRequest} className="gap-2">
              <Plus size={16} />
              Assign
            </Button>

            <div className="text-xs text-brand-400">
              Krever `requests.employee_id` i databasen.
            </div>
          </div>
        </Card>

        {/* Requests overview */}
        <Card>
          <h2 className="text-xl font-bold text-white mb-2">Requests overview</h2>
          <p className="text-brand-300 text-sm mb-4">
            Rask oversikt hvem som eier hva.
          </p>

          <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
            {requests.slice(0, 80).map((r) => (
              <div
                key={r.id}
                className="rounded-lg border border-brand-800 bg-brand-900/40 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-white font-medium">{r.name || "No name"}</div>
                    <div className="text-xs text-brand-300">{r.email || "-"}</div>
                    <div className="text-xs text-brand-400 mt-1">
                      Status: <span className="text-white">{r.status || "Ny"}</span>
                      {" · "}
                      Assigned:{" "}
                      <span className="text-white">
                        {r.employee_id ? empNameById(r.employee_id) : "—"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-brand-500 mt-2">
                  {r.created_at ? new Date(r.created_at).toLocaleString() : ""}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
