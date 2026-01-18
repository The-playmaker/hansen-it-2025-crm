"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function RolesSettings() {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [links, setLinks] = useState([]);
  const [activeRoleId, setActiveRoleId] = useState(null);
  const [q, setQ] = useState("");

  // create role
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");

  // create permission
  const [pKey, setPKey] = useState("");
  const [pLabel, setPLabel] = useState("");
  const [pDesc, setPDesc] = useState("");

  async function load() {
    const [rRes, pRes] = await Promise.all([
      fetch("/api/roles", { cache: "no-store" }),
      fetch("/api/permissions", { cache: "no-store" }),
    ]);

    const rJson = rRes.ok ? await rRes.json() : { roles: [], links: [] };
    const pJson = pRes.ok ? await pRes.json() : [];

    setRoles(rJson.roles || []);
    setLinks(rJson.links || []);
    setPermissions(pJson || []);

    if (!activeRoleId && (rJson.roles || []).length) {
      setActiveRoleId(rJson.roles[0].id);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeRole = useMemo(
    () => roles.find((r) => r.id === activeRoleId),
    [roles, activeRoleId]
  );

  const selectedPermissionIds = useMemo(() => {
    return new Set(links.filter((l) => l.role_id === activeRoleId).map((l) => l.permission_id));
  }, [links, activeRoleId]);

  const filteredPermissions = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return permissions;
    return permissions.filter(
      (p) =>
        p.key.toLowerCase().includes(s) ||
        p.label.toLowerCase().includes(s) ||
        (p.description || "").toLowerCase().includes(s)
    );
  }, [q, permissions]);

  async function saveRolePermissions(nextSet) {
    await fetch(`/api/roles/${activeRoleId}/permissions`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissionIds: Array.from(nextSet) }),
    });
    await load();
  }

  async function togglePermission(pid) {
    const next = new Set(selectedPermissionIds);
    if (next.has(pid)) next.delete(pid);
    else next.add(pid);
    await saveRolePermissions(next);
  }

  async function createRole(e) {
    e.preventDefault();
    const res = await fetch("/api/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newRoleName, description: newRoleDesc }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Could not create role");
      return;
    }

    setNewRoleName("");
    setNewRoleDesc("");
    await load();
  }

  async function createPermission(e) {
    e.preventDefault();
    const res = await fetch("/api/permissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: pKey, label: pLabel, description: pDesc }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Could not create permission");
      return;
    }

    setPKey("");
    setPLabel("");
    setPDesc("");
    await load();
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Settings · Roller & Tilgang</h1>
        <p className="text-brand-300">
          Lag nye permissions dynamisk og tildel dem til roller.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Roles list */}
        <Card className="lg:col-span-3">
          <div className="space-y-3">
            <div className="text-white font-semibold">Roller</div>
            <div className="space-y-1">
              {roles.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setActiveRoleId(r.id)}
                  className={`w-full text-left rounded px-3 py-2 text-sm transition ${
                    r.id === activeRoleId
                      ? "bg-accent-blue/10 text-accent-blue"
                      : "text-brand-300 hover:bg-brand-900/40"
                  }`}
                >
                  <div className="font-medium">{r.name}</div>
                  {r.description ? (
                    <div className="text-xs opacity-70">{r.description}</div>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Permissions */}
        <Card className="lg:col-span-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-white font-semibold">Permissions</div>
                <div className="text-xs text-brand-400">
                  Valgt rolle: <span className="text-brand-200">{activeRole?.name || "-"}</span>
                </div>
              </div>

              <input
                className="bg-brand-900 border border-brand-700 rounded px-3 py-2 text-white w-full max-w-xs"
                placeholder="Søk permissions…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {filteredPermissions.map((p) => {
                const checked = selectedPermissionIds.has(p.id);
                return (
                  <label
                    key={p.id}
                    className="flex items-start gap-3 p-3 rounded border border-brand-800 hover:bg-brand-900/30 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePermission(p.id)}
                      className="mt-1"
                    />
                    <div className="min-w-0">
                      <div className="text-white font-medium">
                        {p.label}{" "}
                        <span className="text-xs text-brand-400">({p.key})</span>
                      </div>
                      {p.description ? (
                        <div className="text-sm text-brand-300">{p.description}</div>
                      ) : null}
                    </div>
                  </label>
                );
              })}

              {!filteredPermissions.length && (
                <div className="text-brand-400 text-sm py-6 text-center">
                  Ingen permissions funnet.
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Create role/permission */}
        <div className="lg:col-span-3 space-y-6">
          <Card>
            <form onSubmit={createRole} className="space-y-3">
              <div className="text-white font-semibold">Ny rolle</div>
              <input
                className="bg-brand-900 border border-brand-700 rounded px-3 py-2 text-white w-full"
                placeholder="Rollenavn (f.eks. sales)"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                required
              />
              <input
                className="bg-brand-900 border border-brand-700 rounded px-3 py-2 text-white w-full"
                placeholder="Beskrivelse"
                value={newRoleDesc}
                onChange={(e) => setNewRoleDesc(e.target.value)}
              />
              <Button type="submit" className="w-full">
                Opprett rolle
              </Button>
            </form>
          </Card>

          <Card>
            <form onSubmit={createPermission} className="space-y-3">
              <div className="text-white font-semibold">Ny permission</div>
              <input
                className="bg-brand-900 border border-brand-700 rounded px-3 py-2 text-white w-full"
                placeholder='Key (f.eks. "manage_invoices")'
                value={pKey}
                onChange={(e) => setPKey(e.target.value)}
                required
              />
              <input
                className="bg-brand-900 border border-brand-700 rounded px-3 py-2 text-white w-full"
                placeholder='Label (f.eks. "Manage invoices")'
                value={pLabel}
                onChange={(e) => setPLabel(e.target.value)}
                required
              />
              <input
                className="bg-brand-900 border border-brand-700 rounded px-3 py-2 text-white w-full"
                placeholder="Beskrivelse"
                value={pDesc}
                onChange={(e) => setPDesc(e.target.value)}
              />
              <Button type="submit" className="w-full">
                Opprett permission
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
