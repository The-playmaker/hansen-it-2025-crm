"use client";
import { useEffect, useState } from "react";

export function useMe() {
  const [me, setMe] = useState(null);

  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  return { me };
}
