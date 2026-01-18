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
    <div className="mb-6">
      <div className="text-white font-semibold text-lg">Hei, {me.name}</div>
      <div className="text-brand-300 text-sm">
        {me.email} · Rolle: <span className="text-brand-200">{me.role}</span>
      </div>
      {!!(me.permissions?.length) && (
        <div className="text-brand-400 text-xs mt-1 truncate">
          Tilganger: {me.permissions.join(", ")}
        </div>
      )}
    </div>
  );
}
