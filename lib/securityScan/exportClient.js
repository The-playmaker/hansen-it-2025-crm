import { jsPDF } from "jspdf";

const COLORS = {
  marine: [21, 33, 73],
  blue: [29, 111, 224],
  blueLight: [63, 161, 255],
  muted: [58, 74, 107],
  grayLight: [139, 150, 172],
  white: [255, 255, 255]
};

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

function addWrapped(doc, text, x, y, width, lineHeight = 5.5) {
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
    if (severity === "critical" || severity === "high") counts.high += 1;
    else if (severity === "medium") counts.medium += 1;
    else if (severity === "low") counts.low += 1;
    return counts;
  }, { high: 0, medium: 0, low: 0 });
}

function customerName(report = {}) {
  return report.row?.customer?.company_name || report.row?.request?.company || report.customerName || report.domain || "Ukjent kunde";
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
  const margin = 18;
  const width = 174;
  let y = 20;
  const logo = await loadImageDataUrl("/brand/hansen-it/logo/logo-horizontal.png");
  const counts = severityCounts(report);
  const documentDate = new Date(report.scannedAt || report.row?.created_at || Date.now()).toLocaleDateString("nb-NO");

  const ensurePage = (needed = 20) => {
    if (y + needed > 278) {
      doc.addPage();
      y = 20;
      footer();
    }
  };

  const footer = () => {
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.text("Infrastruktur · Nettverk · Support · Cybersikkerhet", margin, 288);
    doc.text("Konfidensiell rapport for mottaker", 140, 288);
    doc.setTextColor(...COLORS.marine);
  };

  const section = (title, subtitle) => {
    ensurePage(20);
    y += 5;
    doc.setFontSize(14);
    doc.setFont(undefined, "bold");
    doc.setTextColor(...COLORS.marine);
    doc.text(title, margin, y);
    y += 7;
    if (subtitle) {
      doc.setFont(undefined, "normal");
      doc.setFontSize(9);
      doc.setTextColor(...COLORS.muted);
      y = addWrapped(doc, subtitle, margin, y, width);
      y += 3;
    }
    doc.setFont(undefined, "normal");
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.marine);
  };

  const statBox = (label, value, x, top, boxWidth = 38) => {
    doc.setFillColor(246, 249, 255);
    doc.setDrawColor(220, 229, 244);
    doc.roundedRect(x, top, boxWidth, 22, 2, 2, "FD");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.text(label, x + 4, top + 7);
    doc.setFontSize(13);
    doc.setFont(undefined, "bold");
    doc.setTextColor(...COLORS.marine);
    doc.text(String(value ?? "-"), x + 4, top + 17);
    doc.setFont(undefined, "normal");
  };

  doc.setFillColor(...COLORS.marine);
  doc.rect(0, 0, 210, 297, "F");
  if (logo) {
    doc.addImage(logo, "PNG", margin, y, 78, 22);
  } else {
    doc.setTextColor(...COLORS.white);
    doc.setFontSize(18);
    doc.setFont(undefined, "bold");
    doc.text("Hansen IT", margin, y + 10);
  }
  y = 72;
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(12);
  doc.setFont(undefined, "normal");
  doc.text("Phoenix Security Report", margin, y);
  y += 16;
  doc.setFontSize(28);
  doc.setFont(undefined, "bold");
  y = addWrapped(doc, customerName(report), margin, y, 126, 10);
  doc.setFontSize(14);
  doc.setFont(undefined, "normal");
  doc.setTextColor(...COLORS.blueLight);
  doc.text(report.domain || "Ukjent domene", margin, y + 2);
  y += 18;
  doc.setFillColor(...COLORS.blue);
  doc.roundedRect(margin, y, 74, 34, 4, 4, "F");
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(10);
  doc.text("Security score", margin + 6, y + 10);
  doc.setFontSize(22);
  doc.setFont(undefined, "bold");
  doc.text(`${report.score ?? "-"}/100`, margin + 6, y + 25);
  doc.setFontSize(18);
  doc.text(report.grade || "-", margin + 54, y + 25);
  y += 48;
  doc.setFontSize(10);
  doc.setFont(undefined, "normal");
  doc.setTextColor(220, 229, 244);
  doc.text(`Dokumentdato: ${documentDate}`, margin, y);
  y += 8;
  y = addWrapped(doc, "Konfidensiell rapport. Innholdet er beregnet for kunden og Hansen IT, og skal ikke deles videre uten avtale.", margin, y, 150);
  footer();

  doc.addPage();
  y = 20;
  footer();

  section("Executive summary", "Lederrettet sammendrag av risiko, prioritering og anbefalt neste steg.");
  y = addWrapped(doc, report.summary || "Rapporten viser status for web, domene, TLS, sikkerhetsheadere og e-postsikkerhet basert på passive kontroller.", margin, y, width);

  section("Topp 3 risikoer");
  const topRisks = (report.actions || []).slice(0, 3);
  if (!topRisks.length) {
    doc.text("Ingen kritiske tiltak identifisert.", margin, y);
    y += 7;
  }
  for (const risk of topRisks) {
    ensurePage(18);
    doc.setFont(undefined, "bold");
    y = addWrapped(doc, risk.title, margin, y, width);
    doc.setFont(undefined, "normal");
    y = addWrapped(doc, risk.fix || risk.explain || "Vurder tiltak sammen med Hansen IT.", margin, y + 1, width);
    y += 3;
  }

  section("Anbefalt neste steg");
  y = addWrapped(doc, "Bruk funnene til å prioritere konkrete oppgaver eller en tilbudskladd i Phoenix CRM. 'Fix with Hansen IT' betyr kontrollert rådgivning, oppgave- og tilbudsflyt, ikke automatisk retting.", margin, y, width);

  section("Score dashboard");
  statBox("Total", `${report.score ?? "-"}/100`, margin, y);
  statBox("Grade", report.grade || "-", margin + 44, y);
  statBox("High", counts.high, margin + 88, y);
  statBox("Medium", counts.medium, margin + 132, y);
  y += 30;
  const categoryEntries = Object.entries(report.categories || {});
  categoryEntries.forEach(([key, category], index) => {
    const x = margin + (index % 4) * 44;
    const top = y + Math.floor(index / 4) * 26;
    statBox(key, `${category.score}/${category.max}`, x, top);
  });
  y += Math.ceil(Math.max(categoryEntries.length, 1) / 4) * 28;

  if (report.spoofingRisk) {
    section("Email spoofing risk");
    y = addWrapped(doc, `${report.spoofingRisk.level}: ${report.spoofingRisk.reason}`, margin, y, width);
  }

  section("Prioriterte tiltak");
  const actions = report.actions || [];
  if (!actions.length) {
    doc.text("Ingen prioriterte tiltak.", margin, y);
    y += 6;
  }
  for (const action of actions) {
    ensurePage(28);
    doc.setFont(undefined, "bold");
    y = addWrapped(doc, `${action.title} (${action.severity || action.status || "ukjent"})`, margin, y, width);
    doc.setFont(undefined, "normal");
    y = addWrapped(doc, action.fix || action.explain || "", margin, y + 1, width);
    if (action.effort) {
      doc.setTextColor(...COLORS.muted);
      doc.text(`Estimert arbeid: ${action.effort}`, margin, y + 1);
      doc.setTextColor(...COLORS.marine);
      y += 7;
    }
    y += 3;
  }

  if (report.subdomains?.length) {
    section("Subdomener");
    y = addWrapped(doc, report.subdomains.map((item) => item.host).join(", "), margin, y, width);
  }

  section("Technical appendix", "Alle funn fra passive kontroller. Evidens og forklaring brukes som grunnlag for oppgaver eller tilbud.");
  for (const finding of report.findings || []) {
    ensurePage(24);
    doc.setFont(undefined, "bold");
    y = addWrapped(doc, `${finding.title} (${finding.severity || finding.status || "ukjent"})`, margin, y, width);
    doc.setFont(undefined, "normal");
    y = addWrapped(doc, finding.explain || "", margin, y + 1, width);
    if (finding.evidence) y = addWrapped(doc, `Evidens: ${finding.evidence}`, margin, y + 1, width);
    y += 3;
  }

  section("Fix with Hansen IT");
  y = addWrapped(doc, "Hansen IT kan hjelpe med å gjøre funnene om til prioriterte oppgaver, tilbud og konkrete forbedringer. Kontakt: post@hansen-it.com", margin, y, width);
  if (options.shareUrl) {
    y = addWrapped(doc, `Rapportportal: ${options.shareUrl}`, margin, y + 2, width);
  }

  doc.save(filename(report.domain, "pdf"));
}
