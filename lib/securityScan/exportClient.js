import { jsPDF } from "jspdf";
import {
  buildReportRecommendation,
  priorityLabel,
} from "@/lib/securityScan/recommendations";

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
const severityNo = { critical: "Kritisk", high: "Høy", medium: "Middels", low: "Lav", ok: "OK" };
const categoryNo = { web: "Web", email: "E-post", domain: "Domene", tls: "TLS", headers: "Headere" };
const spoofingNo = { low: "Lav", medium: "Middels", high: "Høy", critical: "Kritisk" };

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
  if (severity === "critical" || severity === "high" || severity === "urgent") return COLORS.rose;
  if (severity === "medium") return COLORS.amber;
  if (severity === "ok" || severity === "good") return COLORS.emerald;
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

function formatEvidence(evidence) {
  if (evidence == null) return "Ikke oppgitt";
  if (typeof evidence === "string") {
    const trimmed = evidence.trim();
    return trimmed || "Ikke oppgitt";
  }
  if (typeof evidence === "number" || typeof evidence === "boolean") {
    return String(evidence);
  }
  if (Array.isArray(evidence)) {
    const joined = evidence
      .filter((item) => item != null && item !== "")
      .map((item) => (typeof item === "object" ? formatEvidence(item) : String(item)))
      .filter((item) => item && item !== "Ikke oppgitt")
      .join(", ");
    return joined || "Ikke oppgitt";
  }
  if (typeof evidence !== "object") return "Ikke oppgitt";

  // DB wrapper from scan_findings: { id, status, raw } — prefer nested finding evidence
  if (evidence.raw && typeof evidence.raw === "object" && evidence.raw.evidence != null) {
    return formatEvidence(evidence.raw.evidence);
  }

  const keys = Object.keys(evidence);
  if (!keys.length) return "Ikke oppgitt";

  const skip = new Set(["raw", "id", "status", "scanner", "finding_id"]);
  const preferred = [
    "record",
    "value",
    "header",
    "host",
    "ip",
    "statusCode",
    "protocol",
    "expires",
    "selector",
    "selectors",
    "issuer",
    "daysToExpiry",
    "maxAge",
    "policy",
    "exchange",
    "ad",
    "dnssec",
  ];

  const parts = [];
  for (const key of preferred) {
    if (!(key in evidence) || skip.has(key)) continue;
    const value = evidence[key];
    if (value == null || value === "") continue;
    if (typeof value === "object") continue;
    parts.push(`${key}: ${String(value)}`);
  }

  if (!parts.length) {
    for (const [key, value] of Object.entries(evidence)) {
      if (skip.has(key) || value == null || value === "") continue;
      if (typeof value === "object") continue;
      parts.push(`${key}: ${String(value)}`);
    }
  }

  if (!parts.length) return "Ikke oppgitt";
  const text = parts.join(" · ");
  return text.length > 120 ? `${text.slice(0, 119)}…` : text;
}

function plainConsequence(item = {}) {
  const severity = severityOf(item);
  if (severity === "ok") return "Ingen tiltak nødvendig.";
  if (item.consequence) return item.consequence;
  if (item.risk) return item.risk;
  if (severity === "critical" || severity === "high") {
    return "Dette kan påvirke tillit, tilgjengelighet eller sikkerhet og bør håndteres først.";
  }
  if (severity === "medium") return "Dette bør planlegges som en forbedring for å redusere fremtidig risiko.";
  return "Kan påvirke sikkerhet, leveranse, omdømme eller tillit hvis det ikke følges opp.";
}

function recommendationFor(item = {}) {
  const severity = severityOf(item);
  if (severity === "ok") return "Ingen umiddelbar handling.";
  return item.fix || item.recommendation || "Verifiser funnet og planlegg anbefalt tiltak.";
}

function normalizeEffortNb(effort) {
  const text = String(effort || "").trim();
  if (!text) return text;
  // "1 timer" / "ca. 1 timer" → singular
  return text.replace(/\b(ca\.\s*)?1(\s+)timer\b/gi, (_, ca, space) => `${ca || ""}1${space}time`);
}

function estimatedWork(item = {}) {
  const severity = severityOf(item);
  if (severity === "ok") return null;
  if (item.effort) return normalizeEffortNb(item.effort);
  if (severity === "critical" || severity === "high") return "ca. 1–3 timer";
  if (severity === "medium") return "ca. 1–2 timer";
  if (severity === "low") return "under 1 time";
  return null;
}

function mainSummary(report, actions, recommendation) {
  const top = actions[0]?.title || "de viktigste sikkerhetstiltakene";
  const score = report.score ?? "-";
  const grade = report.grade || "-";
  const priority = recommendation?.priorityMeta || priorityLabel(report);
  return [
    `Vi har gjort en passiv ekstern sikkerhetsvurdering av ${report.domain || "domenet"}. Dette betyr at vi har sett på synlige tekniske signaler uten aktiv angrepstesting.`,
    `Resultatet er en score på ${score}/100 og karakter ${grade}. Scoren er ikke en fasit, men en indikator på teknisk modenhet basert på passive kontroller.`,
    `Vår vurdering er: ${priority.label}. ${recommendation?.firstStep || `Det viktigste nå er å starte med ${String(top).toLowerCase()}.`}`,
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
  const CONTENT_BOTTOM = 268;
  let y = 20;

  const logo = await loadImageDataUrl("/brand/hansen-it/logo/logo-horizontal.png");
  const documentDate = new Date(report.scannedAt || report.row?.created_at || Date.now()).toLocaleDateString("nb-NO");
  const actions = sortedActions(report).filter((action) => severityOf(action) !== "ok");
  const mainActions = actions.slice(0, 5);
  const findings = sortedFindings(report);
  const counts = severityCounts(report);
  const displayCustomer = customerName(report);
  const showCustomer = displayCustomer && displayCustomer.toLowerCase() !== String(report.domain || "").toLowerCase();
  const recommendation = buildReportRecommendation(report);
  const priority = recommendation.priorityMeta || priorityLabel(report);
  const recommendedPackages = Array.isArray(recommendation.packages)
    ? recommendation.packages.slice(0, 3)
    : [];

  const measure = (text, width, fontSize, lineHeight = 4.2) => {
    doc.setFontSize(fontSize);
    return doc.splitTextToSize(String(text || ""), width).length * lineHeight;
  };

  const headerFooter = () => {
    const total = doc.getNumberOfPages();
    for (let page = 2; page <= total; page += 1) {
      doc.setPage(page);
      doc.setDrawColor(...COLORS.border);
      doc.line(margin, 15, pageWidth - margin, 15);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COLORS.marine);
      doc.text("Hansen IT", margin, 10);
      doc.setFont("helvetica", "normal");
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
    if (y + needed > CONTENT_BOTTOM) {
      doc.addPage();
      y = 24;
    }
  };

  const section = (title, subtitle) => {
    ensurePage(24);
    y += 5;
    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.marine);
    doc.text(title, margin, y);
    y += 7;
    if (subtitle) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...COLORS.muted);
      y = addWrapped(doc, subtitle, margin, y, bodyWidth);
      y += 4;
    }
    doc.setFont("helvetica", "normal");
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
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.marine);
    doc.text(String(value ?? "-"), x + 6, top + h - 7);
    doc.setFont("helvetica", "normal");
  };

  const infoBox = (title, text, accent = COLORS.blue, minHeight = 28) => {
    const textWidth = bodyWidth - 14;
    const textTop = 15;
    const bottomPad = 5;
    const textHeight = measure(text, textWidth, 8.7, 4.3);
    const height = Math.max(minHeight, textTop + textHeight + bottomPad);

    ensurePage(height + 8);
    const top = y;
    doc.setFillColor(247, 250, 255);
    doc.setDrawColor(...COLORS.border);
    doc.roundedRect(margin, top, bodyWidth, height, 3, 3, "FD");
    doc.setFillColor(...accent);
    doc.roundedRect(margin, top, 3, height, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.marine);
    doc.text(title, margin + 7, top + 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.7);
    doc.setTextColor(...COLORS.muted);
    addWrapped(doc, text, margin + 7, top + 15, textWidth, 4.3);
    y += height + 7;
  };

  const actionCard = (action, index) => {
    const severity = severityOf(action);
    const leftText = plainConsequence(action);
    const rightText = recommendationFor(action);
    const leftHeight = measure(leftText, 78, 8.5, 4.2);
    const rightHeight = measure(rightText, 72, 8.5, 4.2);
    const textTop = 16;
    const bottomPad = 6;
    const height = Math.max(32, textTop + Math.max(leftHeight, rightHeight) + bottomPad);

    ensurePage(height + 6);
    const top = y;
    doc.setFillColor(...COLORS.white);
    doc.setDrawColor(...COLORS.border);
    doc.roundedRect(margin, top, bodyWidth, height, 3, 3, "FD");
    doc.setFillColor(...severityColor(severity));
    doc.roundedRect(margin, top, 4, height, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...COLORS.marine);
    const title = `${index + 1}. ${action.title || "Tiltak"}`;
    const titleLines = doc.splitTextToSize(title, bodyWidth - 45);
    doc.text(titleLines[0], margin + 8, top + 8);
    doc.setTextColor(...severityColor(severity));
    doc.text(severityNo[severity] || severity, margin + bodyWidth - 6, top + 8, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...COLORS.muted);
    addWrapped(doc, leftText, margin + 8, top + 16, 78, 4.2);
    addWrapped(doc, rightText, margin + 92, top + 16, 72, 4.2);
    y += height + 6;
  };

  const appendixFinding = (finding) => {
    const severity = severityOf(finding);
    const isOk = severity === "ok";
    const observation = finding.observation || finding.explain || "-";
    const meaning = isOk ? "Ingen tiltak nødvendig." : plainConsequence(finding);
    const recommendationText = recommendationFor(finding);
    const evidenceText = formatEvidence(finding.evidence);
    const work = estimatedWork(finding);
    const evidenceLine = isOk || !work ? evidenceText : `${evidenceText} · ${work}`;

    const obsHeight = measure(observation, 78, 8.4, 4.1);
    const meaningHeight = isOk ? measure(meaning, 76, 8.4, 4.1) : measure(meaning, 76, 8.4, 4.1);
    const row1Bottom = 22 + Math.max(obsHeight, meaningHeight);
    const nextYOffset = row1Bottom + 2;
    const recHeight = measure(recommendationText, 78, 8.4, 4.1);
    const evidenceHeight = measure(evidenceLine, 76, 8.4, 4.1);
    const contentBottom = nextYOffset + 5 + Math.max(recHeight, evidenceHeight);
    const bottomPad = 5;
    const height = Math.max(isOk ? 44 : 52, contentBottom + bottomPad);

    ensurePage(height + 8);
    const top = y;
    doc.setFillColor(...COLORS.white);
    doc.setDrawColor(...COLORS.border);
    doc.roundedRect(margin, top, bodyWidth, height, 3, 3, "FD");
    doc.setFillColor(...severityColor(severity));
    doc.roundedRect(margin, top, 4, height, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.marine);
    const titleLines = doc.splitTextToSize(finding.title || "Funn", bodyWidth - 45);
    doc.text(titleLines[0], margin + 8, top + 8);
    doc.setFontSize(8);
    doc.setTextColor(...severityColor(severity));
    doc.text(severityNo[severity] || severity, margin + bodyWidth - 6, top + 8, { align: "right" });

    const label = (text, x, lineY) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...COLORS.muted);
      doc.text(text, x, lineY);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.4);
      doc.setTextColor(...COLORS.marine);
    };

    label("Observasjon", margin + 8, top + 17);
    const obsY = addWrapped(doc, observation, margin + 8, top + 22, 78, 4.1);
    label(isOk ? "Status" : "Betydning", margin + 96, top + 17);
    const meaningY = addWrapped(doc, meaning, margin + 96, top + 22, 76, 4.1);
    const nextY = Math.max(obsY, meaningY) + 2;
    label("Anbefaling", margin + 8, nextY);
    addWrapped(doc, recommendationText, margin + 8, nextY + 5, 78, 4.1);
    label(isOk || !work ? "Evidens" : "Evidens / estimert arbeid", margin + 96, nextY);
    addWrapped(doc, evidenceLine, margin + 96, nextY + 5, 76, 4.1);
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
    doc.setFont("helvetica", "bold");
    doc.text("Hansen IT", margin, 32);
  }

  doc.setTextColor(...COLORS.blueLight);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("External Security Assessment", margin, 70);

  // Score card geometry — keep title/customer clear of this box.
  const CARD_X = 128;
  const CARD_Y = 74;
  const CARD_W = 58;
  const CARD_H = 66;
  const CARD_PAD = 6;
  const TITLE_MAX_W = CARD_X - margin - 8;

  // Draw card first so later text cannot paint under it.
  doc.setFillColor(...COLORS.white);
  doc.roundedRect(CARD_X, CARD_Y, CARD_W, CARD_H, 4, 4, "F");

  doc.setTextColor(...COLORS.muted);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("TEKNISK MODENHET", CARD_X + CARD_PAD, CARD_Y + 12);

  const scoreText = String(report.score ?? "-");
  doc.setTextColor(...COLORS.marine);
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.text(scoreText, CARD_X + CARD_PAD, 107);
  const scoreW = doc.getTextWidth(scoreText);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("/ 100", CARD_X + CARD_PAD + scoreW + 3, 107);

  const labelMaxW = CARD_W - CARD_PAD * 2;
  let labelSize = 12;
  doc.setFontSize(labelSize);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.blue);
  let labelLines = doc.splitTextToSize(priority.label, labelMaxW);
  while (labelLines.length > 2 && labelSize > 8) {
    labelSize -= 1;
    doc.setFontSize(labelSize);
    labelLines = doc.splitTextToSize(priority.label, labelMaxW);
  }
  const labelLineH = labelSize * 0.4;
  let labelY = 120;
  for (const line of labelLines) {
    doc.text(line, CARD_X + CARD_PAD, labelY);
    labelY += labelLineH;
  }

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.muted);
  doc.text(`Karakter ${report.grade || "-"} · teknisk modenhet`, CARD_X + CARD_PAD, CARD_Y + CARD_H - 7);

  // Title — never wider than TITLE_MAX_W (never into the card).
  doc.setTextColor(...COLORS.white);
  doc.setFont("helvetica", "bold");
  let titleSize = 30;
  let titleLines = [];
  while (titleSize >= 20) {
    doc.setFontSize(titleSize);
    titleLines = doc.splitTextToSize("Phoenix Security Report", TITLE_MAX_W);
    if (titleLines.length <= 2) break;
    titleSize -= 2;
  }
  const titleLineH = titleSize * 0.38;
  let titleY = 88;
  for (const line of titleLines) {
    doc.text(line, margin, titleY);
    titleY += titleLineH;
  }

  y = Math.max(108, titleY + 4);
  if (showCustomer) {
    doc.setFontSize(15);
    doc.setFont("helvetica", "normal");
    y = addWrapped(doc, displayCustomer, margin, y, TITLE_MAX_W, 7);
  }
  doc.setTextColor(...COLORS.blueLight);
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  y = addWrapped(doc, report.domain || "Ukjent domene", margin, y + 4, TITLE_MAX_W, 6);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(220, 229, 244);
  doc.setFontSize(10);
  doc.text(`Dokumentdato: ${documentDate}`, margin, 164);
  doc.text("Rapporttype: Ekstern sikkerhetsvurdering", margin, 173);
  addWrapped(doc, "Konfidensiell rapport. Første del er skrevet for kunde/ledelse. Tekniske detaljer ligger i appendix bakerst.", margin, 190, 160, 5);
  doc.setFontSize(8);
  doc.text("Infrastruktur · Nettverk · Support · Cybersikkerhet", margin, 282);

  doc.addPage();
  y = 24;

  section("A. Kundevennlig hovedrapport", "Denne delen forklarer hva vi sjekket, hva vi fant og hva som bør gjøres først.");
  infoBox(
    "Hva ble sjekket?",
    "Vi sjekket offentlig synlige forhold rundt domene, nettside, HTTPS/TLS, sikkerhetsheadere og e-postbeskyttelse. Dette er passive eksterne kontroller, ikke en aktiv sårbarhetstest.",
    COLORS.blue,
    30
  );

  section("Sammendrag");
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
  card(margin + 56, y, 48, 30, "Samlet prioritet", priority.label, severityColor(priority.level), 9);
  card(margin + 112, y, 30, 30, "Kritisk", counts.critical, COLORS.rose, 16);
  card(margin + 148, y, 30, 30, "Høy", counts.high, COLORS.rose, 16);
  y += 38;
  card(margin, y, 34, 24, "Middels", counts.medium, COLORS.amber, 13);
  card(margin + 42, y, 34, 24, "Lav", counts.low, COLORS.blue, 13);
  card(margin + 84, y, 34, 24, "OK", counts.ok, COLORS.emerald, 13);
  if (report.spoofingRisk) {
    card(
      margin + 126,
      y,
      52,
      24,
      "E-postrisiko",
      spoofingNo[report.spoofingRisk.level] || severityNo[report.spoofingRisk.level] || report.spoofingRisk.level,
      severityColor(report.spoofingRisk.level),
      10
    );
  }
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
    const packageLines = recommendedPackages
      .map((entry) => `${entry.name}${entry.reason ? ` — ${entry.reason}` : ""}`)
      .join("\n");
    infoBox(
      "Relevante produktpakker",
      packageLines,
      COLORS.blueLight,
      Math.min(42, 18 + recommendedPackages.length * 8)
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
