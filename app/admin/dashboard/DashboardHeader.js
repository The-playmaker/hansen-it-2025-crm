"use client";

import { useEffect, useState } from "react";

export default function DashboardHeader() {
  const [me, setMe] = useState(null);

  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMe(d))
      .catch(() => setMe(null));
  }, []);

  if (!me) return null;

  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <div>
        <div style={{ fontWeight: 700 }}>Hei, {me.name}</div>
        <div style={{ opacity: 0.7, fontSize: 12 }}>
          {me.email} · Rolle: {me.role}
        </div>
      </div>

      <a href="/admin/settings/users" style={{ textDecoration: "underline" }}>
        Settings
      </a>
    </div>
  );
}
