"use client";

import { useEffect, useState } from "react";

export default function UsersSettings() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  async function fetchUsers() {
    const res = await fetch("/api/users");
    const data = await res.json();
    setUsers(data);
  }

  async function fetchRoles() {
    const res = await fetch("/api/roles/all");
    const data = await res.json();
    setRoles(data.map(r => r.name));
  }

  useEffect(() => {
    Promise.all([fetchUsers(), fetchRoles()]).then(() => setLoading(false));
  }, []);

  async function updateRole(id, role) {
    await fetch(`/api/users/${id}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role })
    });
    fetchUsers();
  }

  async function deleteUser(id) {
    if (!confirm("Er du sikker på at du vil slette denne brukeren?")) return;
    await fetch(`/api/users/${id}`, { method: "DELETE" });
    fetchUsers();
  }

  if (loading) return <div>Laster...</div>;

  return (
    <div>
      <h1>Brukeradministrasjon</h1>
      <table border="1" cellPadding="5">
        <thead>
          <tr>
            <th>Navn</th>
            <th>E-post</th>
            <th>Rolle</th>
            <th>Handlinger</th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr key={user.id}>
              <td>{user.name}</td>
              <td>{user.email}</td>
              <td>
                <select value={user.role} onChange={e => updateRole(user.id, e.target.value)}>
                  {roles.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </td>
              <td>
                <button onClick={() => deleteUser(user.id)}>Slett</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Opprett ny rolle</h2>
      <NewRoleForm fetchRoles={fetchRoles} />
    </div>
  );
}

function NewRoleForm({ fetchRoles }) {
  const [name, setName] = useState("");
  const [permissions, setPermissions] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    await fetch("/api/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, permissions })
    });
    setName("");
    setPermissions("");
    fetchRoles();
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        placeholder="Rollenavn"
        value={name}
        onChange={e => setName(e.target.value)}
        required
      />
      <input
        placeholder="Permissions (comma-separated)"
        value={permissions}
        onChange={e => setPermissions(e.target.value)}
      />
      <button type="submit">Opprett rolle</button>
    </form>
  );
}
