const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, ok: 4, info: 4 };

export const servicePackageCategories = [
  "web",
  "email_security",
  "dns_domain",
  "microsoft_365",
  "security_followup",
  "monitoring",
  "support",
];

export const standardServicePackages = [
  { slug: "websidepakke-start", name: "Websidepakke Start", category: "web", description: "for å få grunnleggende websikkerhet på plass" },
  { slug: "websidepakke-pro", name: "Websidepakke Pro", category: "web", description: "for å heve websikkerhet og drift" },
  { slug: "epostsikkerhet-start", name: "E-postsikkerhet Start", category: "email_security", description: "for å etablere SPF, DKIM og DMARC" },
  { slug: "epostsikkerhet-pro", name: "E-postsikkerhet Pro", category: "email_security", description: "for å stramme inn e-postautentisering og DMARC" },
  { slug: "web-security-headers", name: "Web Security Headers-pakke", category: "web", description: "for å sette manglende sikkerhetsheadere" },
  { slug: "tls-https-forbedring", name: "Web/TLS forbedringspakke", category: "web", description: "for å sikre HTTPS og sertifikater" },
  { slug: "dns-domene-sikring", name: "DNS/domene-sikring", category: "dns_domain", description: "for å sikre DNS og domenestatus" },
  { slug: "maanedlig-sikkerhetskontroll", name: "Månedlig sikkerhetskontroll", category: "security_followup", description: "fordi grunnsikringen er på plass og bør holdes ved like" },
];

/** Norwegian labels for package category tags in UI. */
export const servicePackageCategoryLabels = {
  web: "Web",
  email_security: "E-postsikkerhet",
  dns_domain: "DNS/domene",
  microsoft_365: "Microsoft 365",
  security_followup: "Sikkerhetsoppfølging",
  monitoring: "Overvåking",
  support: "Support",
  anbefalt: "Anbefalt",
};

/**
 * Ferdigskrevne begrunnelsesfragmenter (uten «fordi») per funn-id.
 * Aldri interpoler funntitler inn i setninger.
 */
const packageReasons = {
  dmarc: "DMARC mangler",
  "dmarc-none": "DMARC står på p=none",
  "dmarc-no-rua": "DMARC mangler rapportering (rua)",
  "dmarc-pct": "DMARC bare gjelder en andel av e-posten",
  "dmarc-external-rua": "ekstern DMARC-rapportering mangler verifisering",
  spf: "SPF mangler",
  "spf-soft": "SPF ikke er streng",
  "spf-multiple": "domenet har flere SPF-records",
  "spf-lookup-limit": "SPF krever for mange DNS-oppslag",
  "spf-plus-all": "SPF tillater alle avsendere (+all)",
  "spf-ptr": "SPF bruker utdatert ptr-mekanisme",
  dkim: "DKIM mangler",
  "email-spoofing-risk": "risikoen for e-postforfalskning er forhøyet",
  mx: "MX-oppsettet er ufullstendig",
  "mx-unresolved": "MX peker til verter som ikke resolver",
  "mx-ip-literal": "MX peker direkte på IP-adresse",
  "mx-starttls-missing": "primær MX mangler STARTTLS",
  "mx-missing-with-auth": "SPF/DMARC finnes uten MX",
  csp: "nettsiden mangler Content-Security-Policy",
  hsts: "nettsiden mangler HSTS",
  nosniff: "nettsiden mangler X-Content-Type-Options",
  frame: "nettsiden mangler klikkjacking-beskyttelse",
  referrer: "nettsiden mangler Referrer-Policy",
  "powered-by": "serveren avslører teknologi via X-Powered-By",
  https: "nettstedet svarer ikke på HTTPS",
  "http-redirect": "HTTP videresendes ikke til HTTPS",
  cert: "TLS-sertifikatet er ugyldig",
  "cert-expiry": "TLS-sertifikatet utløper snart",
  "tls-legacy": "utdaterte TLS-versjoner er aktivert",
  dnssec: "DNSSEC ikke er aktivert på domenet",
  expiry: "domenet nærmer seg utløp",
  "domain-registered-empty": "domenet er registrert uten aktive tjenester",
  "subdomains-discovered": "flere subdomener er synlige i DNS",
};

/** Lengre enkeltbegrunnelser når bare ett funn matcher. */
const packageReasonsSolo = {
  "dmarc-none": "DMARC står på p=none og ikke stopper forfalsket e-post",
  spf: "SPF mangler og hvem som helst kan sende e-post i deres navn",
};

const packageCountLabels = {
  email: "e-postkontroller",
  headers: "sikkerhetsheadere",
  tls: "TLS/HTTPS-punkter",
  dns: "DNS/domenepunkter",
};

function severityOf(item = {}) {
  return item.severity || item.status || "low";
}

function sortedActions(report = {}) {
  return [...(report.actions || [])].sort(
    (a, b) => (severityOrder[severityOf(a)] ?? 9) - (severityOrder[severityOf(b)] ?? 9)
  );
}

function countSeverity(items = []) {
  return items.reduce(
    (counts, item) => {
      const severity = severityOf(item);
      counts[severity] = (counts[severity] || 0) + 1;
      return counts;
    },
    { critical: 0, high: 0, medium: 0, low: 0, ok: 0, info: 0 }
  );
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
    item.consequence,
    item.fix,
    item.recommendation,
    typeof item.evidence === "string" ? item.evidence : JSON.stringify(item.evidence || ""),
    item.observation,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function hasScopeWarning(report = {}) {
  const { all } = reportItems(report);
  const combined = [report.domain, report.summary, ...all.map(textOf)].join(" ").toLowerCase();
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
  if (severity === "critical") return { min: 2, max: 4 };
  if (severity === "high") return { min: 1, max: 3 };
  if (severity === "medium") return { min: 0.5, max: 2 };
  if (severity === "low" || severity === "info") return { min: 0.25, max: 1 };
  return { min: 0, max: 0 };
}

function formatHours(value) {
  const rounded = Math.round(value * 2) / 2;
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded).replace(".", ",");
}

/**
 * Single source for total work estimate (non-OK findings only).
 */
export function estimateTotalWork(findings = []) {
  const relevant = (findings || []).filter((item) => {
    const severity = severityOf(item);
    return severity !== "ok";
  });

  if (!relevant.length) {
    return { minHours: 0, maxHours: 0, label: "Ingen umiddelbar utbedring anbefalt" };
  }

  const totals = relevant.reduce(
    (sum, item) => {
      const parsed = parseEffort(item.effort || item.estimate || item.estimated_work) || effortFallback(item);
      return { min: sum.min + parsed.min, max: sum.max + parsed.max };
    },
    { min: 0, max: 0 }
  );

  const minHours = Math.max(0.5, Math.round(totals.min * 2) / 2);
  const maxHours = Math.max(minHours, Math.round(totals.max * 2) / 2);

  const label =
    minHours === maxHours
      ? `ca. ${formatHours(minHours)} ${minHours === 1 ? "time" : "timer"}`
      : `ca. ${formatHours(minHours)}–${formatHours(maxHours)} timer`;

  return { minHours, maxHours, label };
}

/**
 * Single source for report priority (score + worst finding).
 * @returns {{ level: string, label: string, reason: string }}
 */
export function priorityLabel(report = {}) {
  if (typeof report === "number" || (report != null && typeof report !== "object")) {
    // Backward-compat: old callers passed score only
    const score = Number(report || 0);
    if (score < 40) return { level: "urgent", label: "Krever rask oppfølging", reason: "Lav score." };
    if (score < 50) return { level: "high", label: "Prioritet: Høy", reason: "Lav score." };
    if (score < 75) return { level: "medium", label: "Prioritet: Medium", reason: "Middels score." };
    return { level: "good", label: "God grunnsikring", reason: "God score." };
  }

  const score = Number(report.score || 0);
  const findings = Array.isArray(report.findings) ? report.findings : [];
  const hasCritical = findings.some((item) => severityOf(item) === "critical");
  const hasHigh = findings.some((item) => severityOf(item) === "high");

  if (hasCritical) {
    return {
      level: "urgent",
      label: "Krever rask oppfølging",
      reason: "Minst ett kritisk funn krever umiddelbar handling.",
    };
  }
  if (hasHigh || score < 50) {
    return {
      level: "high",
      label: "Prioritet: Høy",
      reason: hasHigh ? "Det finnes funn med høy alvorlighetsgrad." : "Samlet score er under 50.",
    };
  }
  if (score < 75) {
    return {
      level: "medium",
      label: "Prioritet: Medium",
      reason: "Score og funn tilsier planlagt oppfølging, ikke nødtiltak.",
    };
  }
  return {
    level: "good",
    label: "God grunnsikring",
    reason: "De viktigste passive kontrollene ser ut til å være på plass.",
  };
}

function packageMeta(slug) {
  return standardServicePackages.find((entry) => entry.slug === slug) || { slug, name: slug };
}

function reasonKeyForFinding(finding = {}) {
  const id = String(finding.id || "");
  if (id === "dmarc") {
    const none =
      String(finding.evidence?.record || "").includes("p=none") ||
      /p=none/i.test(finding.explain || "") ||
      /p=none/i.test(finding.title || "");
    if (none) return "dmarc-none";
    if (finding.status === "fail" || finding.severity === "high" || finding.severity === "critical") return "dmarc";
    return "dmarc";
  }
  if (id === "spf") {
    if (/ikke streng/i.test(finding.title || "")) return "spf-soft";
    if (/mangler/i.test(finding.title || "") || finding.status === "fail") return "spf";
    if (/svekket/i.test(finding.title || "")) return "spf";
    return "spf-soft";
  }
  if (id.startsWith("dkim-")) return "dkim";
  return id;
}

function fragmentForFinding(finding = {}) {
  const key = reasonKeyForFinding(finding);
  if (!packageReasons[key]) return null;
  return { key, text: packageReasons[key] };
}

/**
 * Combine up to two fragments into a natural Norwegian "fordi …" sentence.
 * Three or more → count fallback. No known fragments → package description / null.
 */
function composePackageReason(findings = [], countLabel = "kontroller", packageSlug = "") {
  const fragments = [];
  for (const finding of findings) {
    const fragment = fragmentForFinding(finding);
    if (fragment && !fragments.some((entry) => entry.key === fragment.key)) fragments.push(fragment);
  }

  if (fragments.length === 1) {
    const solo = packageReasonsSolo[fragments[0].key] || fragments[0].text;
    return `fordi ${solo}`;
  }
  if (fragments.length === 2) return `fordi ${fragments[0].text} og ${fragments[1].text}`;
  if (fragments.length > 2) return `fordi ${fragments.length} ${countLabel} mangler`;

  const meta = packageMeta(packageSlug);
  return meta.description || null;
}

/**
 * Max 2–3 matching packages with a short Norwegian why-sentence.
 * @returns {{ slug: string, name: string, reason: string, category: string }[]}
 */
export function inferServicePackagesForReport(report = {}) {
  const { findings } = reportItems(report);
  const problems = findings.filter((item) => {
    const severity = severityOf(item);
    return severity !== "ok";
  });
  if (!problems.length) return [];

  const picked = [];
  const push = (slug, matchingFindings, countLabel) => {
    if (picked.some((item) => item.slug === slug)) return;
    if (picked.length >= 3) return;
    const meta = packageMeta(slug);
    const reason = composePackageReason(matchingFindings, countLabel, slug);
    if (!reason) return;
    picked.push({
      slug,
      name: meta.name,
      category: meta.category,
      reason,
    });
  };

  const dmarcFinding = problems.find((item) => item.id === "dmarc");
  const dmarcNone =
    dmarcFinding &&
    (String(dmarcFinding.evidence?.record || "").includes("p=none") ||
      /p=none/i.test(dmarcFinding.explain || "") ||
      /p=none/i.test(dmarcFinding.title || ""));
  const emailProblems = problems.filter(
    (item) =>
      item.category === "email" ||
      /^(spf|dkim|dmarc|mx|email-spoofing)/.test(item.id || "")
  );
  if (dmarcNone) {
    push("epostsikkerhet-pro", emailProblems.length ? emailProblems : [dmarcFinding], packageCountLabels.email);
  } else if (emailProblems.length) {
    push("epostsikkerhet-start", emailProblems, packageCountLabels.email);
  }

  const headerProblems = problems.filter(
    (item) =>
      /^(hsts|csp|nosniff|frame|referrer|powered-by)/.test(item.id || "") ||
      (item.category === "web" && /header|hsts|csp|referrer|frame/i.test(textOf(item)))
  );
  if (headerProblems.length) {
    push("web-security-headers", headerProblems, packageCountLabels.headers);
  }

  const tlsProblems = problems.filter(
    (item) =>
      /^(https|cert|tls|http-redirect)/.test(item.id || "") ||
      (/https|tls|sertifikat/i.test(textOf(item)) && !/^(hsts|csp)/.test(item.id || ""))
  );
  if (tlsProblems.length && picked.length < 3) {
    push("tls-https-forbedring", tlsProblems, packageCountLabels.tls);
  }

  const dnsProblems = problems.filter(
    (item) =>
      /^(dnssec|expiry|domain-registered|subdomains)/.test(item.id || "") ||
      (item.category === "domain" && severityOf(item) !== "info" && severityOf(item) !== "ok")
  );
  if (dnsProblems.length && picked.length < 3) {
    push("dns-domene-sikring", dnsProblems, packageCountLabels.dns);
  }

  return picked.slice(0, 3);
}

/** @deprecated Prefer inferServicePackagesForReport — returns slug strings only. */
export function inferServicePackageSlugsForReport(report = {}) {
  return inferServicePackagesForReport(report).map((item) => item.slug);
}

export function buildReportRecommendation(report = {}) {
  const { findings, actions } = reportItems(report);
  const counts = countSeverity(findings.length ? findings : actions);
  const topActions = sortedActions(report)
    .filter((action) => severityOf(action) !== "ok")
    .slice(0, 5);
  const priority = priorityLabel(report);
  const work = estimateTotalWork(findings.length ? findings : actions);
  const packages = inferServicePackagesForReport(report);

  if (hasScopeWarning(report)) {
    return {
      level: "scope_warning",
      title: "Kontroller scope før tiltak",
      text: "Domenet ser ikke ut til å ha forventede DNS-records. Dette kan skyldes skrivefeil, inaktivt domene eller at domenet ikke er satt opp ennå. Vi anbefaler å bekrefte domenet før tiltak prises.",
      cta: "Ønsker du at Hansen IT kontrollerer scope og domenestatus først?",
      estimate: "Etter avtale",
      work,
      priority: priority.label,
      priorityMeta: priority,
      firstStep: "Bekreft riktig domene og DNS-status før rapporten brukes som grunnlag for tiltak.",
      packageSlugs: packages.map((item) => item.slug),
      packages,
      suggestions: ["Bekreft domene med kunden", "Sjekk DNS-records", "Kjør ny passiv scan etter korrigert scope"],
    };
  }

  if (priority.level === "urgent" || counts.critical || counts.high) {
    return {
      level: "urgent",
      title: "Anbefalt første tiltakspakke",
      text: "Vi anbefaler å starte med de viktigste funnene først. Dette gjelder særlig funn som kan påvirke tillit, tilgjengelighet, e-postleveranse eller sikkerhet.",
      cta: "Ønsker du at Hansen IT utarbeider en konkret tiltakspakke?",
      estimate: work.label,
      work,
      priority: priority.label,
      priorityMeta: priority,
      firstStep: topActions[0]?.title
        ? `Start med: ${topActions[0].title}`
        : "Start med funnene som har høyest alvorlighetsgrad.",
      packageSlugs: packages.map((item) => item.slug),
      packages,
      suggestions: topActions.map((action) => action.title).filter(Boolean).slice(0, 5),
    };
  }

  if (priority.level === "good") {
    return {
      level: "followup",
      title: "Anbefalt videre oppfølging",
      text: "Denne passive kontrollen viser at de viktigste grunnsikringene ser ut til å være på plass. Vi anbefaler videre jevnlig kontroll, dokumentasjon og enkel overvåking.",
      cta: "Ønsker du at Hansen IT følger dette opp videre?",
      estimate: work.maxHours ? work.label : "Ingen umiddelbar utbedring anbefalt",
      work,
      priority: priority.label,
      priorityMeta: priority,
      firstStep: "Avtal periodisk kontroll og enkel overvåking.",
      packageSlugs: packages.length ? packages.map((item) => item.slug) : ["maanedlig-sikkerhetskontroll"],
      packages: packages.length
        ? packages
        : [
            {
              slug: "maanedlig-sikkerhetskontroll",
              name: "Månedlig sikkerhetskontroll",
              reason: "fordi grunnsikringen er på plass og bør holdes ved like",
            },
          ],
      suggestions: [
        "Kvartalsvis sikkerhetssjekk",
        "DNS/e-post-kontroll",
        "Sertifikat- og domeneovervåking",
        "Endringslogg og dokumentasjon",
      ],
    };
  }

  return {
    level: "improvement",
    title: "Anbefalt forbedringspakke",
    text: "Det er ikke funnet kritiske forhold i denne passive kontrollen, men det finnes forbedringer som kan øke teknisk modenhet og redusere fremtidig risiko.",
    cta: "Hansen IT kan hjelpe med en forbedringspakke for web, e-post og sikkerhetsoppsett.",
    estimate: work.label,
    work,
    priority: priority.label,
    priorityMeta: priority,
    firstStep: topActions[0]?.title
      ? `Planlegg først: ${topActions[0].title}`
      : "Planlegg forbedringene som en samlet pakke.",
    packageSlugs: packages.map((item) => item.slug),
    packages,
    suggestions: topActions.map((action) => action.title).filter(Boolean).slice(0, 5),
  };
}
