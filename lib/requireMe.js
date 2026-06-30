import { cookies } from "next/headers";

export function requireMe() {
  const raw = cookies().get("phoenixUser")?.value;
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
