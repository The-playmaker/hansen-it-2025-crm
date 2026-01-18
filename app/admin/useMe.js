"use client";
import { useEffect, useState } from "react";

export function useMe() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMe(d))
      .finally(() => setLoading(false));
  }, []);

  return { me, loading };
}
