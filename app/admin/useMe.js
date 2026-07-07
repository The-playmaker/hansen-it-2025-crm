"use client";
import { useEffect, useState } from "react";

export function useMe() {
  const [me, setMe] = useState(null);

  useEffect(() => {
    fetch("/api/admin/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setMe(data?.admin || null))
      .catch(() => setMe(null));
  }, []);

  return { me };
}
