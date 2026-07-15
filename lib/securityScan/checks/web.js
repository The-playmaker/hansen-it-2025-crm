const UA = "PhoenixScan/1.0 (+https://scan.hansen-it.com)";

async function fetchHead(url) {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      headers: { "user-agent": UA },
      signal: AbortSignal.timeout(8000),
    });
    return res;
  } catch {
    return null;
  }
}

export async function checkWeb(domain) {
  // 1. Svarer domenet på HTTPS?
  let httpsRes = await fetchHead(`https://${domain}/`);
  let finalHost = domain;

  // Følg opptil 3 redirects manuelt (f.eks. -> www.)
  let hops = 0;
  while (httpsRes && [301, 302, 307, 308].includes(httpsRes.status) && hops < 3) {
    const loc = httpsRes.headers.get("location");
    if (!loc) break;
    const next = new URL(loc, `https://${finalHost}/`);
    if (next.protocol !== "https:") break;
    finalHost = next.hostname;
    httpsRes = await fetchHead(next.href);
    hops++;
  }

  const httpsOk = !!httpsRes && httpsRes.status < 500;

  // 2. Redirecter HTTP til HTTPS?
  let httpRedirects = null;
  const httpRes = await fetchHead(`http://${domain}/`);
  if (httpRes) {
    if ([301, 302, 307, 308].includes(httpRes.status)) {
      const loc = httpRes.headers.get("location") || "";
      httpRedirects = loc.startsWith("https://");
    } else {
      httpRedirects = false; // serverer innhold over ren HTTP
    }
  }

  // 3. Security headers (fra endelig HTTPS-respons)
  const h = httpsRes ? httpsRes.headers : new Headers();
  const hsts = h.get("strict-transport-security");
  const hstsMaxAge = hsts ? parseInt((hsts.match(/max-age=(\d+)/i) || [])[1] || "0", 10) : 0;
  const cspValue = h.get("content-security-policy");

  return {
    reachable: httpsOk,
    finalHost,
    httpRedirectsToHttps: httpRedirects,
    headers: {
      hsts: { present: !!hsts, maxAge: hstsMaxAge, value: hsts },
      csp: Boolean(cspValue),
      cspValue: cspValue || null,
      xContentTypeOptions:
        (h.get("x-content-type-options") || "").toLowerCase() === "nosniff",
      frameProtection:
        !!h.get("x-frame-options") ||
        (cspValue || "").includes("frame-ancestors"),
      referrerPolicy: !!h.get("referrer-policy"),
      permissionsPolicy: !!h.get("permissions-policy"),
      server: h.get("server") || null,
      poweredBy: h.get("x-powered-by") || null,
    },
  };
}
