"use client";

import { useEffect, useState } from "react";

export default function UsersSettings() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  async function fetchUsers() {
    const res = await fetch("/api/users");
    const data = await res.json();
    setUsers(data);
    setLoading(false);
  }

  useEffect(() => {
    fetchUsers();
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
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="worker">Worker</option>
                  {/* Legg til nye roller her */}
                </select>
              </td>
              <td>
                <button onClick={() => deleteUser(user.id)}>Slett</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
