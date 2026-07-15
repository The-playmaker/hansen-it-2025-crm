/**
 * RFC 9116 security.txt (crm.hansen-it.com)
 *
 * Expires is hardcoded on purpose: it must go stale within one year so we
 * renew the file deliberately. Do NOT use new Date() here.
 *
 * Calendar reminder: renew before 2027-07-15 (update Expires + this comment).
 */
export const dynamic = "force-static";

const EXPIRES = "2027-07-15T00:00:00.000Z";

const BODY = [
  "Contact: mailto:security@hansen-it.com",
  "Contact: https://hansen-it.com/contact",
  `Expires: ${EXPIRES}`,
  "Preferred-Languages: no, en",
  "Canonical: https://crm.hansen-it.com/.well-known/security.txt",
  "Policy: https://crm.hansen-it.com/security-policy",
  "",
].join("\n");

export function GET() {
  return new Response(BODY, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
