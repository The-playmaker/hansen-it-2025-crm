import { jsPDF } from "jspdf";

function safeReport(input = {}) {
  return input.report && typeof input.report === "object" ? { ...input.report, reportId: input.id || input.reportId || input.report.id } : input;
}

function filename(domain, ext) {
  const clean = String(domain || "security-report").replace(/[^a-z0-9.-]+/gi, "-").toLowerCase();
  return `phoenix-scan-${clean}.${ext}`;
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

function addWrapped(doc, text, x, y, width, lineHeight = 6) {
  const lines = doc.splitTextToSize(String(text || ""), width);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
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

export function downloadSecurityReportPdf(input) {
  const report = safeReport(input);
  const doc = new jsPDF();
  const margin = 18;
  const width = 174;
  let y = 20;

  const ensurePage = (needed = 20) => {
    if (y + needed > 280) {
      doc.addPage();
      y = 20;
    }
  };

  const section = (title) => {
    ensurePage(16);
    y += 4;
    doc.setFontSize(13);
    doc.setFont(undefined, "bold");
    doc.text(title, margin, y);
    y += 8;
    doc.setFont(undefined, "normal");
    doc.setFontSize(10);
  };

  doc.setFontSize(18);
  doc.setFont(undefined, "bold");
  doc.text(`Phoenix Scan: ${report.domain || "ukjent domene"}`, margin, y);
  y += 10;
  doc.setFontSize(11);
  doc.setFont(undefined, "normal");
  doc.text(`Score: ${report.score ?? "-"} / 100 (${report.grade || "-"})`, margin, y);
  y += 7;
  if (report.scannedAt) {
    doc.text(`Skannet: ${new Date(report.scannedAt).toLocaleString("nb-NO")}`, margin, y);
    y += 7;
  }
  y = addWrapped(doc, report.summary || "Ingen sammendrag.", margin, y + 2, width);

  section("Kategorier");
  for (const [label, item] of Object.entries(report.categories || {})) {
    doc.text(`${label}: ${item.score}/${item.max}`, margin, y);
    y += 6;
  }

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
    ensurePage(24);
    doc.setFont(undefined, "bold");
    y = addWrapped(doc, `${action.title} (${action.severity || action.status || "ukjent"})`, margin, y, width);
    doc.setFont(undefined, "normal");
    y = addWrapped(doc, action.fix || action.explain || "", margin, y + 1, width);
    if (action.effort) {
      doc.text(`Estimert arbeid: ${action.effort}`, margin, y + 1);
      y += 7;
    }
    y += 3;
  }

  if (report.subdomains?.length) {
    section("Subdomener");
    y = addWrapped(doc, report.subdomains.map((item) => item.host).join(", "), margin, y, width);
  }

  section("Funn");
  for (const finding of report.findings || []) {
    ensurePage(20);
    doc.setFont(undefined, "bold");
    y = addWrapped(doc, `${finding.title} (${finding.severity || finding.status || "ukjent"})`, margin, y, width);
    doc.setFont(undefined, "normal");
    y = addWrapped(doc, finding.explain || "", margin, y + 1, width);
    y += 3;
  }

  doc.save(filename(report.domain, "pdf"));
}
