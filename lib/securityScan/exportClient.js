import { jsPDF } from "jspdf";

const COLORS = {
  marine: [21, 33, 73],
  marineDeep: [27, 42, 82],
  blue: [29, 111, 224],
  blueLight: [63, 161, 255],
  muted: [58, 74, 107],
  grayLight: [139, 150, 172],
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
const severityHours = { critical: 5, high: 3, medium: 2, low: 1, ok: 0 };

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

function addWrapped(doc, text, x, y, width, lineHeight = 5.2) {
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

function severityCounts(report = {}) {
  return (report.findings || []).reduce((counts, finding) => {
    const severity = finding.severity || finding.status || "low";
    counts[severity] = (counts[severity] || 0) + 1;
    return counts;
  }, { critical: 0, high: 0, medium: 0, low: 0, ok: 0 });
}

function customerName(report = {}) {
  return report.row?.customer?.company_name || report.row?.request?.company || report.customerName || "";
}

function sortedActions(report = {}) {
  return [...(report.actions || [])].sort((a, b) => (severityOrder[a.severity || a.status] ?? 9) - (severityOrder[b.severity || b.status] ?? 9));
}

function estimatedHours(actions = []) {
  return actions.reduce((sum, action) => sum + (severityHours[action.severity || action.status] ?? 1), 0);
}

function priorityLabel(score) {
  const value = Number(score || 0);
  if (value < 40) return "Kritisk prioritet";
  if (value < 60) return "Høy prioritet";
  if (value < 80) return "Medium prioritet";
  return "Normal oppfølging";
}

function severityColor(severity) {
  if (severity === "critical" || severity === "high") return COLORS.rose;
  if (severity === "medium") return COLORS.amber;
  if (severity === "ok") return COLORS.emerald;
  return COLORS.blue;
}

function executiveText(report, actions) {
  const firstAction = actions[0]?.title || "gjennomgå de høyest prioriterte sikkerhetsfunnene";
  return [
    `Denne rapporten viser den eksterne sikkerhetsprofilen for ${report.domain || "domenet"} basert på passive kontroller av web, domene, TLS, sikkerhetsheadere og e-postoppsett.`,
    `Security score er ${report.score ?? "-"}/100 med karakter ${report.grade || "-"}, som gir ${priorityLabel(report.score).toLowerCase()} for oppfølging.`,
    "For ledelsen betyr funnene først og fremst risiko for redusert tillit, feil e-postlevering, spoofing, omdømmetap og unødvendig eksponering av tjenester.",
    `Det første som bør gjøres er å ${String(firstAction).toLowerCase()}, før lavere prioriterte forbedringer planlegges.`,
    "Funnene bør verifiseres teknisk før endelig risikovurdering og gjennomføring."
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
    actions: report.actions
  };
  downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), filename(report.domain, "json"));
}

export async function downloadSecurityReportPdf(input, options = {}) {
  const report = safeReport(input);
  const doc = new jsPDF();
  const margin = 16;
  const pageWidth = 210;
  const bodyWidth = 178;
  let y = 20;
  const logo = await loadImageDataUrl("/brand/hansen-it/logo/logo-horizontal.png");
  const documentDate = new Date(report.scannedAt || report.row?.created_at || Date.now()).toLocaleDateString("nb-NO");
  const actions = sortedActions(report);
  const counts = severityCounts(report);
  const totalHours = estimatedHours(actions);
  const displayCustomer = customerName(report);
  const showCustomer = displayCustomer && displayCustomer.toLowerCase() !== String(report.domain || "").toLowerCase();

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
      doc.text("Konfidensiell rapport", 90, 10);
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
    ensurePage(22);
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
      y += 3;
    }
    doc.setFont(undefined, "normal");
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.marine);
  };

  const card = (x, top, w, h, label, value, accent = COLORS.blue, valueSize = 16) => {
    doc.setFillColor(...COLORS.soft);
    doc.setDrawColor(...COLORS.border);
    doc.roundedRect(x, top, w, h, 3, 3, "FD");
    doc.setFillColor(...accent);
    doc.roundedRect(x, top, 2.5, h, 1, 1, "F");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.text(label, x + 6, top + 8);
    doc.setFontSize(valueSize);
    doc.setFont(undefined, "bold");
    doc.setTextColor(...COLORS.marine);
    doc.text(String(value ?? "-"), x + 6, top + h - 7);
    doc.setFont(undefined, "normal");
  };

  const infoBox = (title, text, accent = COLORS.blue) => {
    ensurePage(28);
    doc.setFillColor(247, 250, 255);
    doc.setDrawColor(...COLORS.border);
    const boxTop = y;
    doc.roundedRect(margin, boxTop, bodyWidth, 25, 3, 3, "FD");
    doc.setFillColor(...accent);
    doc.roundedRect(margin, boxTop, 3, 25, 1, 1, "F");
    doc.setFont(undefined, "bold");
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.marine);
    doc.text(title, margin + 7, boxTop + 8);
    doc.setFont(undefined, "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...COLORS.muted);
    addWrapped(doc, text, margin + 7, boxTop + 15, bodyWidth - 14, 4.2);
    y += 31;
  };

  const labeledLine = (label, value, x, top, w) => {
    doc.setFont(undefined, "bold");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.text(label, x, top);
    doc.setFont(undefined, "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.marine);
    return addWrapped(doc, value || "-", x, top + 5, w, 4.5);
  };

  doc.setFillColor(...COLORS.marine);
  doc.rect(0, 0, pageWidth, 297, "F");
  doc.setFillColor(...COLORS.marineDeep);
  doc.rect(0, 205, pageWidth, 92, "F");
  doc.setFillColor(...COLORS.blue);
  doc.rect(0, 0, 8, 297, "F");

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
  doc.roundedRect(132, 74, 50, 58, 4, 4, "F");
  doc.setTextColor(...COLORS.muted);
  doc.setFontSize(8);
  doc.text("SECURITY SCORE", 138, 86);
  doc.setTextColor(...COLORS.marine);
  doc.setFontSize(28);
  doc.setFont(undefined, "bold");
  doc.text(String(report.score ?? "-"), 138, 107);
  doc.setFontSize(10);
  doc.text("/ 100", 162, 107);
  doc.setTextColor(...COLORS.blue);
  doc.setFontSize(18);
  doc.text(`Grade ${report.grade || "-"}`, 138, 123);

  doc.setFont(undefined, "normal");
  doc.setTextColor(220, 229, 244);
  doc.setFontSize(10);
  doc.text(`Dokumentdato: ${documentDate}`, margin, 164);
  doc.text("Rapporttype: External Security Assessment", margin, 173);
  addWrapped(doc, "Konfidensiell rapport. Innholdet er beregnet for kunden og Hansen IT, og skal ikke deles videre uten avtale.", margin, 190, 160, 5);
  doc.setFontSize(8);
  doc.text("Infrastruktur · Nettverk · Support · Cybersikkerhet", margin, 282);

  doc.addPage();
  y = 24;

  section("Executive summary", "Lederrettet sammendrag av forretningsrisiko, prioritet og anbefalt rekkefølge.");
  for (const line of executiveText(report, actions)) {
    y = addWrapped(doc, line, margin, y, bodyWidth);
    y += 2;
  }
  y += 3;
  infoBox("Metode og scope", "Denne rapporten er basert på passive eksterne kontroller. Funn bør verifiseres før endelig risikovurdering.", COLORS.blue);

  section("Ledelsesvurdering");
  card(margin, y, 54, 28, "Anbefalt prioritet", priorityLabel(report.score), severityColor(actions[0]?.severity || "low"), 11);
  card(margin + 62, y, 52, 28, "Estimert arbeid", `ca. ${totalHours || 1} timer`, COLORS.blue, 13);
  card(margin + 122, y, 56, 28, "Hva først?", actions[0]?.title || "Verifiser funn", COLORS.amber, 9);
  y += 36;

  section("Score dashboard");
  card(margin, y, 55, 34, "Security score", `${report.score ?? "-"}/100`, COLORS.blue, 20);
  card(margin + 62, y, 38, 34, "Grade", report.grade || "-", COLORS.blueLight, 22);
  card(margin + 108, y, 34, 34, "Kritisk", counts.critical, COLORS.rose, 18);
  card(margin + 148, y, 30, 34, "Høy", counts.high, COLORS.rose, 18);
  y += 42;
  card(margin, y, 34, 24, "Medium", counts.medium, COLORS.amber, 14);
  card(margin + 42, y, 34, 24, "Lav", counts.low, COLORS.blue, 14);
  card(margin + 84, y, 34, 24, "OK", counts.ok, COLORS.emerald, 14);
  if (report.spoofingRisk) card(margin + 126, y, 52, 24, "Spoofing-risk", severityNo[report.spoofingRisk.level] || report.spoofingRisk.level, severityColor(report.spoofingRisk.level), 10);
  y += 34;

  const categoryEntries = ["web", "email", "domain", "tls", "headers"].map((key) => {
    const category = report.categories?.[key];
    return [key, category ? `${category.score}/${category.max}` : "-"];
  });
  categoryEntries.forEach(([key, value], index) => {
    card(margin + (index % 5) * 36, y, 32, 24, categoryNo[key] || key, value, COLORS.blueLight, 12);
  });
  y += 32;

  section("Prioritert tiltaksplan", "Tiltakene er sortert etter alvorlighet. Tabellen er egnet som grunnlag for oppgaver eller tilbudskladd i Phoenix CRM.");
  if (!actions.length) {
    doc.text("Ingen prioriterte tiltak.", margin, y);
    y += 8;
  }
  actions.forEach((action, index) => {
    ensurePage(42);
    const top = y;
    const severity = action.severity || action.status || "low";
    doc.setFillColor(...COLORS.soft);
    doc.setDrawColor(...COLORS.border);
    doc.roundedRect(margin, top, bodyWidth, 38, 3, 3, "FD");
    doc.setFillColor(...severityColor(severity));
    doc.roundedRect(margin, top, 4, 38, 1, 1, "F");
    doc.setFont(undefined, "bold");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.marine);
    doc.text(`#${index + 1}`, margin + 8, top + 8);
    doc.text(action.title || "Tiltak", margin + 22, top + 8);
    doc.setTextColor(...severityColor(severity));
    doc.text(severityNo[severity] || severity, margin + 150, top + 8);
    doc.setFont(undefined, "normal");
    doc.setTextColor(...COLORS.muted);
    addWrapped(doc, `Hvorfor: ${action.explain || "Reduserer eksponering og operasjonell risiko."}`, margin + 8, top + 16, 78, 4.2);
    addWrapped(doc, `Løsning: ${action.fix || "Planlegg og gjennomfør anbefalt tiltak."}`, margin + 92, top + 16, 72, 4.2);
    doc.setFontSize(8);
    doc.text(`Estimert arbeid: ${action.effort || `ca. ${severityHours[severity] || 1} timer`}`, margin + 8, top + 34);
    y += 45;
  });

  section("Teknisk appendix", "Strukturert oversikt over funn, observasjon, risiko, anbefaling og evidens.");
  for (const finding of report.findings || []) {
    ensurePage(56);
    const severity = finding.severity || finding.status || "low";
    const top = y;
    doc.setFillColor(...COLORS.white);
    doc.setDrawColor(...COLORS.border);
    doc.roundedRect(margin, top, bodyWidth, 50, 3, 3, "FD");
    doc.setFillColor(...severityColor(severity));
    doc.roundedRect(margin, top, 4, 50, 1, 1, "F");
    doc.setFont(undefined, "bold");
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.marine);
    doc.text(finding.title || "Finding", margin + 8, top + 8);
    doc.setFontSize(8);
    doc.setTextColor(...severityColor(severity));
    doc.text(severityNo[severity] || severity, margin + 150, top + 8);
    const leftY = labeledLine("Observation", finding.explain || finding.observation || "-", margin + 8, top + 17, 80);
    const rightY = labeledLine("Risk", finding.risk || "Kan påvirke sikkerhet, leveranse, omdømme eller tillit hvis det ikke følges opp.", margin + 96, top + 17, 76);
    const recY = labeledLine("Recommendation", finding.fix || finding.recommendation || "Verifiser funnet og planlegg anbefalt tiltak.", margin + 8, Math.max(leftY, rightY) + 2, 80);
    labeledLine("Evidence / estimated work", `${finding.evidence || "Ikke oppgitt"} · ${finding.effort || `ca. ${severityHours[severity] || 1} timer`}`, margin + 96, Math.max(leftY, rightY) + 2, 76);
    y = Math.max(top + 56, recY + 8);
  }

  if (report.subdomains?.length) {
    section("Subdomener observert");
    y = addWrapped(doc, report.subdomains.map((item) => item.host).join(", "), margin, y, bodyWidth);
  }

  section("Anbefalt neste steg");
  infoBox(
    "Fix with Hansen IT",
    "Hansen IT kan gjøre funnene om til konkrete oppgaver og tilbud i Project Phoenix. Dette er en kontrollert CRM/quote-flow og ikke automatisk teknisk retting.",
    COLORS.blue
  );
  y = addWrapped(doc, "Kontakt: post@hansen-it.com", margin, y, bodyWidth);
  if (options.shareUrl) y = addWrapped(doc, `Rapportportal: ${options.shareUrl}`, margin, y + 3, bodyWidth);

  headerFooter();
  doc.save(filename(report.domain, "pdf"));
}
