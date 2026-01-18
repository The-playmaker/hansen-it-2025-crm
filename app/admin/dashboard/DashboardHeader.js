"use client";

import { useEffect, useState } from "react";

export default function DashboardHeader() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch("/api/me")
      .then(res => res.json())
      .then(data => setUser(data));
  }, []);

  if (!user) return <div>Loading...</div>;

  return <div>Hei, {user.name}! (Rolle: {user.role})</div>;
}
