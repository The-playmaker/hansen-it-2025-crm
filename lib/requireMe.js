import { cookies, headers } from "next/headers";

export function requireMe() {
  const headerValue = headers().get("x-phoenix-admin");

  if (headerValue) {
    try {
      return JSON.parse(decodeURIComponent(headerValue));
    } catch {
      return null;
    }
  }

  const demoAllowed = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  if (!demoAllowed) return null;

  const raw = cookies().get("phoenixUser")?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
