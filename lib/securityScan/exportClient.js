import { jsPDF } from "jspdf";
import { buildReportRecommendation, standardServicePackages } from "@/lib/securityScan/recommendations";

const COLORS = {
  marine: [21, 33, 73],
  marineDeep: [27, 42, 82],
  blue: [29, 111, 224],
  blueLight: [63, 161, 255],
  muted: [58, 74, 107],
  border: [218, 226, 240],
  soft: [245, 248, 253],
  white: [255, 255, 255],
  rose: [190, 18, 60],
  amber: [180, 83, 9],
  emerald: [4, 120, 87]
};

const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, ok: 4 };
const severityNo = { critical: "Kritisk", high: "Høy", medium: "Medium", low: "Lav", ok: "OK" };
const categoryNo = { web: "Web", email: "E-post", domain: "Domene", tls: "TLS", headers: "Headere" };

function safeReport(input = {}) {
  return input.report && typeof input.report === "object"
    ? { ...input.report, reportId: input.id || input.reportId || input.report.id, row: input }
    : input;
}

function filename(domain, ext) {
  const clean = String(domain || "security-report").replace(/[^a-z0-9.-]+/gi, "-").toLowerCase();
  return `phoenix-security-report-${clean}.${ext}`;
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function addWrapped(doc, text, x, y, width, lineHeight = 5.1) {
  const lines = doc.splitTextToSize(String(text || ""), width);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

async function loadImageDataUrl(path) {
  try {
    const response = await fetch(path);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function severityOf(item = {}) {
  return item.severity || item.status || "low";
}

function severityColor(severity) {
  if (severity === "critical" || severity === "high") return COLORS.rose;
  if (severity === "medium") return COLORS.amber;
  if (severity === "ok") return COLORS.emerald;
  return COLORS.blue;
}

function severityCounts(report = {}) {
  return (report.findings || []).reduce((counts, finding) => {
    const severity = severityOf(finding);
    counts[severity] = (counts[severity] || 0) + 1;
    return counts;
  }, { critical: 0, high: 0, medium: 0, low: 0, ok: 0 });
}

function customerName(report = {}) {
  return report.row?.customer?.company_name || report.row?.request?.company || report.customerName || "";
}

function sortedActions(report = {}) {
  return [...(report.actions || [])].sort((a, b) => (severityOrder[severityOf(a)] ?? 9) - (severityOrder[severityOf(b)] ?? 9));
}

function sortedFindings(report = {}) {
  return [...(report.findings || [])].sort((a, b) => (severityOrder[severityOf(a)] ?? 9) - (severityOrder[severityOf(b)] ?? 9));
}

function priorityLabel(score) {
  const value = Number(score || 0);
  if (value < 40) return "Krever rask oppfølging";
  if (value < 60) return "Prioritet: Høy";
  if (value < 80) return "Prioritet: Medium";
  return "Prioritet: Normal";
}

function groupLabel(severity) {
  if (severity === "critical" || severity === "high") return "Kritisk / fiks først";
  if (severity === "medium") return "Viktig / planlegg";
  if (severity === "low") return "Forbedringer";
  return "OK / observert";
}

function groupActions(actions = []) {
  return actions.reduce((groups, action) => {
    const label = groupLabel(severityOf(action));
    groups[label] = groups[label] || [];
    groups[label].push(action);
    return groups;
  }, {});
}

function plainConsequence(item = {}) {
  const severity = severityOf(item);
  if (severity === "ok") return "Dette er på plass. Ingen umiddelbar handling er nødvendig.";
  if (item.explain) return item.explain;
  if (item.risk) return item.risk;
  if (severity === "critical" || severity === "high") {
    return "Dette kan påvirke tillit, tilgjengelighet eller sikkerhet og bør håndteres først.";
  }
  if (severity === "medium") return "Dette bør planlegges som en forbedring for å redusere fremtidig risiko.";
  return "Dette er en forbedring som kan tas når de viktigste tiltakene er håndtert.";
}

function recommendationFor(item = {}) {
  const severity = severityOf(item);
  if (severity === "ok") return "Ingen umiddelbar handling. Vurder forbedring senere ved behov.";
  return item.fix || item.recommendation || "Verifiser funnet og planlegg anbefalt tiltak.";
}

function estimatedWork(item = {}) {
  const severity = severityOf(item);
  if (item.effort) return item.effort;
  if (severity === "critical" || severity === "high") return "ca. 1-3 timer";
  if (severity === "medium") return "ca. 1-2 timer";
  if (severity === "low") return "under 1 time";
  return "ingen umiddelbar handling";
}

function mainSummary(report, actions, recommendation) {
  const top = actions[0]?.title || "de viktigste sikkerhetstiltakene";
  const score = report.score ?? "-";
  const grade = report.grade || "-";
  return [
    `Vi har gjort en passiv ekstern sikkerhetsvurdering av ${report.domain || "domenet"}. Dette betyr at vi har sett på synlige tekniske signaler uten aktiv angrepstesting.`,
    `Resultatet er en score på ${score}/100 og karakter ${grade}. Scoren er ikke en fasit, men en indikator på teknisk modenhet basert på passive kontroller.`,
    `Vår vurdering er: ${recommendation?.priority || priorityLabel(report.score)}. ${recommendation?.firstStep || `Det viktigste nå er å starte med ${String(top).toLowerCase()}.`}`,
    recommendation?.text || "Vi anbefaler å starte med HTTPS/TLS og e-postbeskyttelse der dette er relevant. Dette er normalt overkommelig arbeid og gir høy sikkerhetsgevinst.",
    "Hansen IT kan gjøre funnene om til konkrete oppgaver, en tiltakspakke eller et tilbud før noe teknisk endres."
  ];
}

export function downloadSecurityReportJson(input) {
  const report = safeReport(input);
  const payload = {
    domain: report.domain,
    scannedAt: report.scannedAt,
    score: report.score,
    grade: report.grade,
    categories: report.categories,
    spoofingRisk: report.spoofingRisk,
    subdomains: report.subdomains,
    findings: report.findings,
    actions: report.actions,
    recommendation: buildReportRecommendation(report)
  };
  downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), filename(report.domain, "json"));
}

export async function downloadSecurityReportPdf(input, options = {}) {
  const report = safeReport(input);
  const doc = new jsPDF();
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 16;
  const bodyWidth = 178;
  let y = 20;

  const logo = await loadImageDataUrl("/brand/hansen-it/logo/logo-horizontal.png");
  const documentDate = new Date(report.scannedAt || report.row?.created_at || Date.now()).toLocaleDateString("nb-NO");
  const actions = sortedActions(report);
  const mainActions = actions.filter((action) => severityOf(action) !== "ok").slice(0, 5);
  const findings = sortedFindings(report);
  const counts = severityCounts(report);
  const displayCustomer = customerName(report);
  const showCustomer = displayCustomer && displayCustomer.toLowerCase() !== String(report.domain || "").toLowerCase();
  const recommendation = buildReportRecommendation(report);
  const recommendedPackages = standardServicePackages.filter((entry) => recommendation.packageSlugs?.includes(entry.slug));

  const headerFooter = () => {
    const total = doc.getNumberOfPages();
    for (let page = 2; page <= total; page += 1) {
      doc.setPage(page);
      doc.setDrawColor(...COLORS.border);
      doc.line(margin, 15, pageWidth - margin, 15);
      doc.setFontSize(8);
      doc.setFont(undefined, "bold");
      doc.setTextColor(...COLORS.marine);
      doc.text("Hansen IT", margin, 10);
      doc.setFont(undefined, "normal");
      doc.setTextColor(...COLORS.muted);
      doc.text("Konfidensiell rapport", 86, 10);
      doc.text("post@hansen-it.com", pageWidth - margin, 10, { align: "right" });
      doc.line(margin, 276, pageWidth - margin, 276);
      doc.text("Infrastruktur · Nettverk · Support · Cybersikkerhet", margin, 284);
      doc.text(`Side ${page} av ${total}`, pageWidth - margin, 284, { align: "right" });
    }
    doc.setPage(total);
  };

  const ensurePage = (needed = 24) => {
    if (y + needed > 268) {
      doc.addPage();
      y = 24;
    }
  };

  const section = (title, subtitle) => {
    ensurePage(24);
    y += 5;
    doc.setFontSize(15);
    doc.setFont(undefined, "bold");
    doc.setTextColor(...COLORS.marine);
    doc.text(title, margin, y);
    y += 7;
    if (subtitle) {
      doc.setFont(undefined, "normal");
      doc.setFontSize(9);
      doc.setTextColor(...COLORS.muted);
      y = addWrapped(doc, subtitle, margin, y, bodyWidth);
      y += 4;
    }
    doc.setFont(undefined, "normal");
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.marine);
  };

  const card = (x, top, w, h, label, value, accent = COLORS.blue, valueSize = 15) => {
    doc.setFillColor(...COLORS.soft);
    doc.setDrawColor(...COLORS.border);
    doc.roundedRect(x, top, w, h, 3, 3, "FD");
    doc.setFillColor(...accent);
    doc.roundedRect(x, top, 3, h, 1, 1, "F");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.text(label, x + 6, top + 8);
    doc.setFontSize(valueSize);
    doc.setFont(undefined, "bold");
    doc.setTextColor(...COLORS.marine);
    doc.text(String(value ?? "-"), x + 6, top + h - 7);
    doc.setFont(undefined, "normal");
  };

  const infoBox = (title, text, accent = COLORS.blue, height = 28) => {
    ensurePage(height + 8);
    const top = y;
    doc.setFillColor(247, 250, 255);
    doc.setDrawColor(...COLORS.border);
    doc.roundedRect(margin, top, bodyWidth, height, 3, 3, "FD");
    doc.setFillColor(...accent);
    doc.roundedRect(margin, top, 3, height, 1, 1, "F");
    doc.setFont(undefined, "bold");
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.marine);
    doc.text(title, margin + 7, top + 8);
    doc.setFont(undefined, "normal");
    doc.setFontSize(8.7);
    doc.setTextColor(...COLORS.muted);
    addWrapped(doc, text, margin + 7, top + 15, bodyWidth - 14, 4.3);
    y += height + 7;
  };

  const actionCard = (action, index) => {
    ensurePage(38);
    const severity = severityOf(action);
    const top = y;
    doc.setFillColor(...COLORS.white);
    doc.setDrawColor(...COLORS.border);
    doc.roundedRect(margin, top, bodyWidth, 32, 3, 3, "FD");
    doc.setFillColor(...severityColor(severity));
    doc.roundedRect(margin, top, 4, 32, 1, 1, "F");
    doc.setFont(undefined, "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...COLORS.marine);
    doc.text(`${index + 1}. ${action.title || "Tiltak"}`, margin + 8, top + 8);
    doc.setTextColor(...severityColor(severity));
    doc.text(severityNo[severity] || severity, margin + 150, top + 8);
    doc.setFont(undefined, "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...COLORS.muted);
    addWrapped(doc, plainConsequence(action), margin + 8, top + 16, 78, 4.2);
    addWrapped(doc, recommendationFor(action), margin + 92, top + 16, 72, 4.2);
    y += 38;
  };

  const appendixFinding = (finding) => {
    ensurePage(58);
    const severity = severityOf(finding);
    const top = y;
    const height = 52;
    doc.setFillColor(...COLORS.white);
    doc.setDrawColor(...COLORS.border);
    doc.roundedRect(margin, top, bodyWidth, height, 3, 3, "FD");
    doc.setFillColor(...severityColor(severity));
    doc.roundedRect(margin, top, 4, height, 1, 1, "F");
    doc.setFont(undefined, "bold");
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.marine);
    doc.text(finding.title || "Funn", margin + 8, top + 8);
    doc.setFontSize(8);
    doc.setTextColor(...severityColor(severity));
    doc.text(severityNo[severity] || severity, margin + 150, top + 8);

    const label = (text, x, lineY) => {
      doc.setFont(undefined, "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...COLORS.muted);
      doc.text(text, x, lineY);
      doc.setFont(undefined, "normal");
      doc.setFontSize(8.4);
      doc.setTextColor(...COLORS.marine);
    };

    label("Observasjon", margin + 8, top + 17);
    const obsY = addWrapped(doc, finding.observation || finding.explain || "-", margin + 8, top + 22, 78, 4.1);
    label("Betydning", margin + 96, top + 17);
    const meaningY = addWrapped(doc, plainConsequence(finding), margin + 96, top + 22, 76, 4.1);
    const nextY = Math.max(obsY, meaningY) + 2;
    label("Anbefaling", margin + 8, nextY);
    addWrapped(doc, recommendationFor(finding), margin + 8, nextY + 5, 78, 4.1);
    label("Evidens / estimert arbeid", margin + 96, nextY);
    addWrapped(doc, `${finding.evidence || "Ikke oppgitt"} · ${estimatedWork(finding)}`, margin + 96, nextY + 5, 76, 4.1);
    y += height + 8;
  };

  doc.setFillColor(...COLORS.marine);
  doc.rect(0, 0, pageWidth, pageHeight, "F");
  doc.setFillColor(...COLORS.marineDeep);
  doc.rect(0, 205, pageWidth, 92, "F");
  doc.setFillColor(...COLORS.blue);
  doc.rect(0, 0, 8, pageHeight, "F");

  if (logo) {
    doc.addImage(logo, "PNG", margin, 20, 76, 21);
  } else {
    doc.setTextColor(...COLORS.white);
    doc.setFontSize(18);
    doc.setFont(undefined, "bold");
    doc.text("Hansen IT", margin, 32);
  }

  doc.setTextColor(...COLORS.blueLight);
  doc.setFontSize(10);
  doc.setFont(undefined, "bold");
  doc.text("External Security Assessment", margin, 70);
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(30);
  doc.text("Phoenix Security Report", margin, 88);

  y = 108;
  if (showCustomer) {
    doc.setFontSize(15);
    doc.setFont(undefined, "normal");
    y = addWrapped(doc, displayCustomer, margin, y, 120, 7);
  }
  doc.setTextColor(...COLORS.blueLight);
  doc.setFontSize(14);
  doc.text(report.domain || "Ukjent domene", margin, y + 4);

  doc.setFillColor(...COLORS.white);
  doc.roundedRect(132, 74, 50, 64, 4, 4, "F");
  doc.setTextColor(...COLORS.muted);
  doc.setFontSize(8);
  doc.text("TEKNISK MODENHET", 138, 86);
  doc.setTextColor(...COLORS.marine);
  doc.setFontSize(28);
  doc.setFont(undefined, "bold");
  doc.text(String(report.score ?? "-"), 138, 107);
  doc.setFontSize(10);
  doc.text("/ 100", 162, 107);
  doc.setTextColor(...COLORS.blue);
  doc.setFontSize(12);
  doc.text(priorityLabel(report.score), 138, 124);
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  doc.text(`Karakter ${report.grade || "-"} er en indikator`, 138, 133);

  doc.setFont(undefined, "normal");
  doc.setTextColor(220, 229, 244);
  doc.setFontSize(10);
  doc.text(`Dokumentdato: ${documentDate}`, margin, 164);
  doc.text("Rapporttype: External Security Assessment", margin, 173);
  addWrapped(doc, "Konfidensiell rapport. Første del er skrevet for kunde/ledelse. Tekniske detaljer ligger i appendix bakerst.", margin, 190, 160, 5);
  doc.setFontSize(8);
  doc.text("Infrastruktur · Nettverk · Support · Cybersikkerhet", margin, 282);

  doc.addPage();
  y = 24;

  section("Oppsummering for kunde", "Denne delen forklarer hva vi sjekket, hva vi fant og hva som bør gjøres først.");
  infoBox(
    "Hva ble sjekket?",
    "Vi sjekket offentlig synlige forhold rundt domene, nettside, HTTPS/TLS, sikkerhetsheadere og e-postbeskyttelse. Dette er passive eksterne kontroller, ikke en aktiv sårbarhetstest.",
    COLORS.blue,
    30
  );

  section("Executive summary");
  for (const line of mainSummary(report, mainActions, recommendation)) {
    y = addWrapped(doc, line, margin, y, bodyWidth);
    y += 2.5;
  }
  y += 2;
  infoBox(
    "Score forklart",
    "Score er ikke en fasit, men en indikator på teknisk modenhet basert på passive kontroller. Den bør brukes til å prioritere oppfølging, ikke som endelig risikovurdering alene.",
    COLORS.blue,
    28
  );

  section("Hvor alvorlig er det?");
  card(margin, y, 48, 30, "Score", `${report.score ?? "-"}/100`, COLORS.blue, 18);
  card(margin + 56, y, 48, 30, "Samlet prioritet", recommendation.priority || priorityLabel(report.score), severityColor(mainActions[0] ? severityOf(mainActions[0]) : "low"), 9);
  card(margin + 112, y, 30, 30, "Kritisk", counts.critical, COLORS.rose, 16);
  card(margin + 148, y, 30, 30, "Høy", counts.high, COLORS.rose, 16);
  y += 38;
  card(margin, y, 34, 24, "Medium", counts.medium, COLORS.amber, 13);
  card(margin + 42, y, 34, 24, "Lav", counts.low, COLORS.blue, 13);
  card(margin + 84, y, 34, 24, "OK", counts.ok, COLORS.emerald, 13);
  if (report.spoofingRisk) card(margin + 126, y, 52, 24, "E-post risiko", severityNo[report.spoofingRisk.level] || report.spoofingRisk.level, severityColor(report.spoofingRisk.level), 10);
  y += 34;

  const categoryEntries = ["web", "email", "domain", "tls", "headers"].map((key) => {
    const category = report.categories?.[key];
    return [key, category ? `${category.score}/${category.max}` : "-"];
  });
  categoryEntries.forEach(([key, value], index) => {
    card(margin + (index % 5) * 36, y, 32, 24, categoryNo[key] || key, value, COLORS.blueLight, 12);
  });
  y += 32;

  doc.addPage();
  y = 24;
  section("Hva fant vi?", "Funnene er gruppert etter hva kunden bør gjøre med dem. Maks fem hovedtiltak vises her; resten ligger i teknisk appendix.");

  const grouped = groupActions(actions);
  const groupOrder = ["Kritisk / fiks først", "Viktig / planlegg", "Forbedringer", "OK / observert"];
  let shown = 0;
  for (const group of groupOrder) {
    const groupItems = (grouped[group] || []).filter((item) => severityOf(item) !== "ok");
    const remaining = Math.max(0, 5 - shown);
    if (!groupItems.length || remaining <= 0) continue;
    section(group);
    groupItems.slice(0, remaining).forEach((action) => {
      actionCard(action, shown);
      shown += 1;
    });
  }
  if (!shown) {
    infoBox("Ingen kritiske hovedtiltak", "De viktigste passive kontrollene ser ut til å være på plass. Se teknisk appendix for detaljer og mindre forbedringer.", COLORS.emerald, 27);
  }
  if (actions.length > shown) {
    infoBox("Flere detaljer finnes bakerst", `${actions.length - shown} mindre tiltak eller observasjoner er flyttet til teknisk appendix for å holde hovedrapporten kundevennlig.`, COLORS.blue, 25);
  }

  section("Hva bør gjøres først?");
  infoBox(
    recommendation.title,
    `${recommendation.text} Estimert arbeid: ${recommendation.estimate}. ${recommendation.firstStep}`,
    recommendation.level === "followup" ? COLORS.emerald : recommendation.level === "scope_warning" ? COLORS.amber : COLORS.blue,
    34
  );

  section("Hva kan Hansen IT hjelpe med?");
  infoBox(
    recommendation.cta,
    "Hansen IT kan lage en konkret tiltakspakke basert på funnene. Dette kan gjøres som fjernarbeid eller avtalt gjennomgang, uten at noe teknisk endres før tiltak er avtalt.",
    COLORS.blue,
    34
  );
  if (recommendedPackages.length) {
    infoBox(
      "Relevante produktpakker",
      recommendedPackages.map((entry) => entry.name).join(", "),
      COLORS.blueLight,
      24
    );
  }
  y = addWrapped(doc, "Kontakt: post@hansen-it.com", margin, y, bodyWidth);
  if (options.shareUrl) y = addWrapped(doc, `Rapportportal: ${options.shareUrl}`, margin, y + 3, bodyWidth);

  doc.addPage();
  y = 24;
  section("B. Teknisk appendix", "Alle tekniske funn vises her med observasjon, betydning, anbefaling, evidens og estimert arbeid.");
  infoBox(
    "Metode og scope",
    "Denne rapporten er basert på passive eksterne kontroller. Funn bør verifiseres før endelig risikovurdering.",
    COLORS.blue,
    27
  );
  for (const finding of findings) appendixFinding(finding);

  if (report.subdomains?.length) {
    section("Subdomener observert");
    y = addWrapped(doc, report.subdomains.map((item) => item.host).join(", "), margin, y, bodyWidth);
  }

  headerFooter();
  doc.save(filename(report.domain, "pdf"));
}
