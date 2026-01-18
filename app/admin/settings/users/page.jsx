"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function UsersSettings() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  // create user form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("worker");

  async function load() {
    setLoading(true);
    const [uRes, rRes] = await Promise.all([
      fetch("/api/users", { cache: "no-store" }),
      fetch("/api/roles/all", { cache: "no-store" }),
    ]);

    const u = uRes.ok ? await uRes.json() : [];
    const r = rRes.ok ? await rRes.json() : [];

    setUsers(u);
    setRoles(r.map((x) => x.name));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter(
      (u) =>
        (u.name || "").toLowerCase().includes(s) ||
        (u.email || "").toLowerCase().includes(s) ||
        (u.role || "").toLowerCase().includes(s)
    );
  }, [q, users]);

  async function updateRole(id, newRole) {
    await fetch(`/api/users/${id}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    load();
  }

  async function deleteUser(id) {
    if (!confirm("Slette brukeren?")) return;
    await fetch(`/api/users/${id}`, { method: "DELETE" });
    load();
  }

  async function createUser(e) {
    e.preventDefault();
    const res = await fetch("/api/users/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, role }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Kunne ikke opprette bruker");
      return;
    }

    setName("");
    setEmail("");
    setRole("worker");
    load();
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Settings · Brukere</h1>
        <p className="text-brand-300">Opprett brukere, sett roller og fjern tilgang.</p>
      </div>

      <Card>
        <form onSubmit={createUser} className="space-y-4">
          <div className="text-white font-semibold">Legg til bruker</div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              className="bg-brand-900 border border-brand-700 rounded px-3 py-2 text-white"
              placeholder="Navn"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              className="bg-brand-900 border border-brand-700 rounded px-3 py-2 text-white"
              placeholder="E-post"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <select
              className="bg-brand-900 border border-brand-700 rounded px-3 py-2 text-white"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {(roles.length ? roles : ["admin", "manager", "worker"]).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            <Button type="submit">Opprett</Button>
          </div>

          <div className="text-brand-400 text-sm">
            Tips: etter vi syncer til Casdoor kan brukeren logge inn med Casdoor-konto.
          </div>
        </form>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="text-white font-semibold">Brukerliste</div>
          <input
            className="bg-brand-900 border border-brand-700 rounded px-3 py-2 text-white w-full max-w-md"
            placeholder="Søk på navn, e-post eller rolle…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="py-8 text-brand-300">Loading…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-700 text-brand-300">
                  <th className="text-left py-3 px-2">Navn</th>
                  <th className="text-left py-3 px-2">E-post</th>
                  <th className="text-left py-3 px-2">Rolle</th>
                  <th className="text-right py-3 px-2">Handling</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="border-b border-brand-800">
                    <td className="py-3 px-2 text-white">{u.name}</td>
                    <td className="py-3 px-2 text-brand-300">{u.email}</td>
                    <td className="py-3 px-2">
                      <select
                        className="bg-brand-900 border border-brand-700 rounded px-2 py-1 text-white"
                        value={u.role}
                        onChange={(e) => updateRole(u.id, e.target.value)}
                      >
                        {(roles.length ? roles : ["admin", "manager", "worker"]).map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <button
                        onClick={() => deleteUser(u.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        Slett
                      </button>
                    </td>
                  </tr>
                ))}

                {!filtered.length && (
                  <tr>
                    <td colSpan="4" className="py-8 text-center text-brand-400">
                      Ingen treff.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
