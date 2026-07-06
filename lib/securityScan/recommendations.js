const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, ok: 4 };

export const servicePackageCategories = [
  "web",
  "email_security",
  "dns_domain",
  "microsoft_365",
  "security_followup",
  "monitoring",
  "support"
];

export const standardServicePackages = [
  { slug: "websidepakke-start", name: "Websidepakke Start", category: "web" },
  { slug: "websidepakke-pro", name: "Websidepakke Pro", category: "web" },
  { slug: "epostsikkerhet-start", name: "E-postsikkerhet Start", category: "email_security" },
  { slug: "epostsikkerhet-pro", name: "E-postsikkerhet Pro", category: "email_security" },
  { slug: "web-security-headers", name: "Web Security Headers-pakke", category: "web" },
  { slug: "tls-https-forbedring", name: "Web/TLS forbedringspakke", category: "web" },
  { slug: "dns-domene-sikring", name: "DNS/domene-sikring", category: "dns_domain" },
  { slug: "maanedlig-sikkerhetskontroll", name: "Månedlig sikkerhetskontroll", category: "security_followup" }
];

function severityOf(item = {}) {
  return item.severity || item.status || "low";
}

function sortedActions(report = {}) {
  return [...(report.actions || [])].sort((a, b) => (severityOrder[severityOf(a)] ?? 9) - (severityOrder[severityOf(b)] ?? 9));
}

function countSeverity(items = []) {
  return items.reduce((counts, item) => {
    const severity = severityOf(item);
    counts[severity] = (counts[severity] || 0) + 1;
    return counts;
  }, { critical: 0, high: 0, medium: 0, low: 0, ok: 0 });
}

function reportItems(report = {}) {
  const findings = Array.isArray(report.findings) ? report.findings : [];
  const actions = Array.isArray(report.actions) ? report.actions : [];
  return { findings, actions, all: [...findings, ...actions] };
}

function textOf(item = {}) {
  return [
    item.id,
    item.title,
    item.category,
    item.description,
    item.explain,
    item.fix,
    item.recommendation,
    item.evidence,
    item.observation
  ].filter(Boolean).join(" ").toLowerCase();
}

function hasScopeWarning(report = {}) {
  const { all } = reportItems(report);
  const combined = [
    report.domain,
    report.summary,
    ...all.map(textOf)
  ].join(" ").toLowerCase();
  return (
    combined.includes("ingen dns") ||
    combined.includes("no dns") ||
    combined.includes("nxdomain") ||
    combined.includes("not found") ||
    combined.includes("scope") ||
    combined.includes("skrivefeil") ||
    combined.includes("typo")
  );
}

function parseEffort(value) {
  const text = String(value || "").replace(",", ".");
  const numbers = text.match(/\d+(\.\d+)?/g)?.map(Number) || [];
  if (!numbers.length) return null;
  if (numbers.length === 1) return { min: numbers[0], max: numbers[0] };
  return { min: Math.min(numbers[0], numbers[1]), max: Math.max(numbers[0], numbers[1]) };
}

function effortFallback(item = {}) {
  const severity = severityOf(item);
  if (severity === "critical") return { min: 2, max: 5 };
  if (severity === "high") return { min: 1.5, max: 4 };
  if (severity === "medium") return { min: 1, max: 2 };
  if (severity === "low") return { min: 0.5, max: 1 };
  return { min: 0, max: 0 };
}

function formatHours(value) {
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 2) / 2).replace(".", ",");
}

function estimateFromActions(actions = [], mode = "normal") {
  const relevant = actions.filter((action) => severityOf(action) !== "ok").slice(0, 5);
  if (!relevant.length) return "Ingen umiddelbar utbedring anbefalt";

  const totals = relevant.reduce((sum, action) => {
    const parsed = parseEffort(action.effort || action.estimate || action.estimated_work) || effortFallback(action);
    return { min: sum.min + parsed.min, max: sum.max + parsed.max };
  }, { min: 0, max: 0 });

  if (!totals.max) return mode === "followup" ? "Etter avtale" : "Ingen umiddelbar utbedring anbefalt";
  return `ca. ${formatHours(Math.max(1, totals.min))}-${formatHours(Math.max(1, totals.max))} timer`;
}

export function inferServicePackageSlugsForReport(report = {}) {
  const { all } = reportItems(report);
  const combined = all.map(textOf).join(" ");
  const slugs = new Set();

  if (/\b(dmarc|spf|dkim|mx|spoof|epost|e-post|mail|microsoft 365)\b/.test(combined)) {
    slugs.add("epostsikkerhet-start");
    if (combined.includes("dmarc") || combined.includes("policy") || combined.includes("quarantine") || combined.includes("reject")) {
      slugs.add("epostsikkerhet-pro");
    }
  }

  if (/header|hsts|csp|content-security-policy|x-content-type|referrer|frame/.test(combined)) {
    slugs.add("web-security-headers");
  }

  if (/https|tls|ssl|sertifikat|certificate/.test(combined)) {
    slugs.add("tls-https-forbedring");
  }

  if (/dnssec|dns|ns|nameserver|domene|domain/.test(combined)) {
    slugs.add("dns-domene-sikring");
  }

  if (!slugs.size || Number(report.score || 0) >= 85) {
    slugs.add("maanedlig-sikkerhetskontroll");
  }

  return [...slugs];
}

export function buildReportRecommendation(report = {}) {
  const { findings, actions } = reportItems(report);
  const counts = countSeverity(findings.length ? findings : actions);
  const topActions = sortedActions(report).filter((action) => severityOf(action) !== "ok").slice(0, 5);
  const score = Number(report.score || 0);
  const packages = inferServicePackageSlugsForReport(report);

  if (hasScopeWarning(report)) {
    return {
      level: "scope_warning",
      title: "Kontroller scope før tiltak",
      text: "Domenet ser ikke ut til å ha forventede DNS-records. Dette kan skyldes skrivefeil, inaktivt domene eller at domenet ikke er satt opp ennå. Vi anbefaler å bekrefte domenet før tiltak prises.",
      cta: "Ønsker du at Hansen IT kontrollerer scope og domenestatus først?",
      estimate: "Etter avtale",
      priority: "Avklar scope",
      firstStep: "Bekreft riktig domene og DNS-status før rapporten brukes som grunnlag for tiltak.",
      packageSlugs: ["dns-domene-sikring"],
      suggestions: ["Bekreft domene med kunden", "Sjekk DNS-records", "Kjør ny passiv scan etter korrigert scope"]
    };
  }

  if (counts.critical || counts.high) {
    return {
      level: "urgent",
      title: "Anbefalt første tiltakspakke",
      text: "Vi anbefaler å starte med de viktigste funnene først. Dette gjelder særlig funn som kan påvirke tillit, tilgjengelighet, e-postleveranse eller sikkerhet.",
      cta: "Ønsker du at Hansen IT utarbeider en konkret tiltakspakke?",
      estimate: estimateFromActions(topActions, "urgent"),
      priority: "Prioritet: Høy",
      firstStep: topActions[0]?.title ? `Start med: ${topActions[0].title}` : "Start med funnene som har høyest alvorlighetsgrad.",
      packageSlugs: packages,
      suggestions: topActions.map((action) => action.title).filter(Boolean).slice(0, 5)
    };
  }

  if (score >= 85 || (!counts.critical && !counts.high && !counts.medium)) {
    return {
      level: "followup",
      title: "Anbefalt videre oppfølging",
      text: "Denne passive kontrollen viser at de viktigste grunnsikringene ser ut til å være på plass. Vi anbefaler videre jevnlig kontroll, dokumentasjon og enkel overvåking.",
      cta: "Ønsker du at Hansen IT følger dette opp videre?",
      estimate: actions.some((action) => severityOf(action) !== "ok") ? "Etter avtale" : "Ingen umiddelbar utbedring anbefalt",
      priority: "Prioritet: Normal",
      firstStep: "Avtal periodisk kontroll og enkel overvåking.",
      packageSlugs: ["maanedlig-sikkerhetskontroll"],
      suggestions: [
        "Kvartalsvis sikkerhetssjekk",
        "DNS/e-post-kontroll",
        "Sertifikat- og domeneovervåking",
        "Endringslogg og dokumentasjon"
      ]
    };
  }

  return {
    level: "improvement",
    title: "Anbefalt forbedringspakke",
    text: "Det er ikke funnet kritiske forhold i denne passive kontrollen, men det finnes forbedringer som kan øke teknisk modenhet og redusere fremtidig risiko.",
    cta: "Hansen IT kan hjelpe med en forbedringspakke for web, e-post og sikkerhetsoppsett.",
    estimate: estimateFromActions(topActions, "improvement"),
    priority: "Prioritet: Medium",
    firstStep: topActions[0]?.title ? `Planlegg først: ${topActions[0].title}` : "Planlegg forbedringene som en samlet pakke.",
    packageSlugs: packages,
    suggestions: topActions.map((action) => action.title).filter(Boolean).slice(0, 5)
  };
}
