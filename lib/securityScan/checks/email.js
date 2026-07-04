import { resolveTxt, resolveMx } from "./dns";

// Vanlige DKIM-selectorer: Microsoft 365, Google, og populære utsendere
const DKIM_SELECTORS = [
  "selector1",
  "selector2", // Microsoft 365
  "google", // Google Workspace
  "default",
  "dkim",
  "k1",
  "k2", // Mailchimp
  "s1",
  "s2", // SendGrid
  "mail",
  "resend", // Resend
  "zendesk1",
  "krs", // andre vanlige
];

export async function checkEmail(domain) {
  const [spfRecords, dmarcRecords, mx, mtaSts, tlsRpt] = await Promise.all([
    resolveTxt(domain),
    resolveTxt(`_dmarc.${domain}`),
    resolveMx(domain),
    resolveTxt(`_mta-sts.${domain}`),
    resolveTxt(`_smtp._tls.${domain}`),
  ]);

  // SPF
  const spf = spfRecords.find((t) => t.toLowerCase().startsWith("v=spf1"));
  const spfPolicy = spf
    ? spf.includes("-all")
      ? "strict"
      : spf.includes("~all")
        ? "soft"
        : spf.includes("?all")
          ? "neutral"
          : spf.includes("+all")
            ? "open"
            : "none"
    : null;

  // DMARC
  const dmarc = dmarcRecords.find((t) => t.toLowerCase().startsWith("v=dmarc1"));
  let dmarcPolicy = null;
  if (dmarc) {
    const m = dmarc.match(/p\s*=\s*(none|quarantine|reject)/i);
    dmarcPolicy = m ? m[1].toLowerCase() : "none";
  }

  // DKIM – prøver kjente selectorer parallelt
  const dkimResults = await Promise.all(
    DKIM_SELECTORS.map(async (sel) => {
      const txt = await resolveTxt(`${sel}._domainkey.${domain}`);
      const rec = txt.find((t) => t.includes("v=DKIM1") || t.includes("p="));
      return rec ? sel : null;
    })
  );
  const dkimSelectors = dkimResults.filter(Boolean);

  return {
    hasMx: mx.length > 0,
    mx: mx.map((m) => m.exchange),
    spf: { present: !!spf, policy: spfPolicy, record: spf || null },
    dmarc: { present: !!dmarc, policy: dmarcPolicy, record: dmarc || null },
    dkim: { present: dkimSelectors.length > 0, selectors: dkimSelectors },
    mtaSts: mtaSts.some((t) => t.toLowerCase().startsWith("v=stsv1")),
    tlsRpt: tlsRpt.some((t) => t.toLowerCase().startsWith("v=tlsrptv1")),
  };
}
