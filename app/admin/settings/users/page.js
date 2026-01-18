"use client";

import { useEffect, useState } from "react";

export default function UsersSettings() {
  const [me, setMe] = useState(null);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const meRes = await fetch("/api/me", { cache: "no-store" });
    const meData = meRes.ok ? await meRes.json() : null;
    setMe(meData);

    const usersRes = await fetch("/api/users", { cache: "no-store" });
    const usersData = usersRes.ok ? await usersRes.json() : [];
    setUsers(usersData);

    const rolesRes = await fetch("/api/roles/all", { cache: "no-store" });
    const rolesData = rolesRes.ok ? await rolesRes.json() : [];
    setRoles(rolesData.map((r) => r.name));

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function updateRole(id, role) {
    await fetch(`/api/users/${id}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    load();
  }

  async function deleteUser(id) {
    if (!confirm("Slette brukeren?")) return;
    await fetch(`/api/users/${id}`, { method: "DELETE" });
    load();
  }

  if (loading) return <div>Laster…</div>;

  // Enkel gate: bare admin får inn
  if (!me || me.role !== "admin") {
    return <div>Ingen tilgang (admin only).</div>;
  }

  return (
    <div style={{ padding: 16 }}>
      <h1>Settings · Brukere</h1>

      <table border="1" cellPadding="8" style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>Navn</th>
            <th>E-post</th>
            <th>Rolle</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td>
                <select value={u.role} onChange={(e) => updateRole(u.id, e.target.value)}>
                  {roles.length
                    ? roles.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))
                    : ["admin", "manager", "worker"].map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                </select>
              </td>
              <td>
                <button onClick={() => deleteUser(u.id)}>Slett</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ marginTop: 12 }}>
        <a href="/admin/dashboard" style={{ textDecoration: "underline" }}>
          ← Tilbake til dashboard
        </a>
      </p>
    </div>
  );
}
