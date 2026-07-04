// RDAP er den moderne, strukturerte erstatningen for WHOIS.
// rdap.org ruter automatisk til riktig register (.no -> Norid, .com -> Verisign, osv.)
export async function checkDomainRegistration(domain) {
  try {
    const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      headers: { accept: "application/rdap+json" },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { found: false };
    const data = await res.json();

    const events = data.events || [];
    const expiration = events.find((e) => e.eventAction === "expiration");
    const registration = events.find((e) => e.eventAction === "registration");

    let daysToExpiry = null;
    if (expiration?.eventDate) {
      daysToExpiry = Math.floor(
        (new Date(expiration.eventDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
    }

    return {
      found: true,
      registrar:
        (data.entities || []).find((e) => (e.roles || []).includes("registrar"))
          ?.vcardArray?.[1]?.find((v) => v[0] === "fn")?.[3] || null,
      registered: registration?.eventDate || null,
      expires: expiration?.eventDate || null,
      daysToExpiry,
    };
  } catch {
    return { found: false };
  }
}
