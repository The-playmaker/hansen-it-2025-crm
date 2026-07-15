#!/usr/bin/env node
/**
 * Smoke-test PDF cover layout constraints (title vs score card).
 * Run: node scripts/test-pdf-cover.mjs
 */
import { jsPDF } from "jspdf";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const margin = 16;
const CARD_X = 128;
const CARD_Y = 74;
const CARD_W = 58;
const CARD_H = 66;
const CARD_PAD = 6;
const TITLE_MAX_W = CARD_X - margin - 8;

function priorityLabel(score) {
  const value = Number(score || 0);
  if (value < 40) return "Krever rask oppfølging";
  if (value < 60) return "Prioritet: Høy";
  if (value < 80) return "Prioritet: Medium";
  return "Prioritet: Normal";
}

function layoutCover(doc, { domain, score, grade, customer }) {
  // Card first
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(CARD_X, CARD_Y, CARD_W, CARD_H, 4, 4, "F");

  const scoreText = String(score ?? "-");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(10, 30, 60);
  doc.text(scoreText, CARD_X + CARD_PAD, 107);
  const scoreW = doc.getTextWidth(scoreText);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("/ 100", CARD_X + CARD_PAD + scoreW + 3, 107);
  const scoreBlockRight = CARD_X + CARD_PAD + scoreW + 3 + doc.getTextWidth("/ 100");

  const labelMaxW = CARD_W - CARD_PAD * 2;
  let labelSize = 12;
  doc.setFontSize(labelSize);
  doc.setFont("helvetica", "bold");
  let labelLines = doc.splitTextToSize(priorityLabel(score), labelMaxW);
  while (labelLines.length > 2 && labelSize > 8) {
    labelSize -= 1;
    doc.setFontSize(labelSize);
    labelLines = doc.splitTextToSize(priorityLabel(score), labelMaxW);
  }
  let labelY = 120;
  const labelLineH = labelSize * 0.4;
  for (const line of labelLines) {
    doc.text(line, CARD_X + CARD_PAD, labelY);
    labelY += labelLineH;
  }

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const gradeLine = `Karakter ${grade || "-"} · teknisk modenhet`;
  doc.text(gradeLine, CARD_X + CARD_PAD, CARD_Y + CARD_H - 7);
  const gradeW = doc.getTextWidth(gradeLine);

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

  let y = Math.max(108, titleY + 4);
  if (customer) {
    doc.setFontSize(15);
    doc.setFont("helvetica", "normal");
    const customerLines = doc.splitTextToSize(customer, TITLE_MAX_W);
    for (const line of customerLines) {
      doc.text(line, margin, y);
      y += 7;
    }
  }
  doc.setFontSize(14);
  const domainLines = doc.splitTextToSize(domain, TITLE_MAX_W);
  for (const line of domainLines) {
    doc.text(line, margin, y + 4);
    y += 6;
  }

  return {
    titleSize,
    titleLines,
    titleMaxLineW: Math.max(
      ...titleLines.map((line) => {
        doc.setFontSize(titleSize);
        doc.setFont("helvetica", "bold");
        return doc.getTextWidth(line);
      })
    ),
    labelSize,
    labelLines,
    scoreBlockRight,
    gradeW,
    domainLines,
  };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const fixtures = [
  { name: "short-domain", domain: "vg.no", score: 72, grade: "B", customer: null },
  { name: "long-domain", domain: "autodiscover.hansen-it.com", score: 55, grade: "C", customer: null },
  { name: "score-0", domain: "vg.no", score: 0, grade: "E", customer: null },
  { name: "score-100", domain: "vg.no", score: 100, grade: "A", customer: null },
  { name: "with-customer", domain: "vg.no", score: 40, grade: "D", customer: "Ristesund Transport AS" },
  {
    name: "long-customer",
    domain: "autodiscover.hansen-it.com",
    score: 0,
    grade: "E",
    customer: "Vestlandet Industri og Maritim Teknologigruppe AS",
  },
];

const outDir = join(process.cwd(), "tmp", "pdf-cover-smoke");
mkdirSync(outDir, { recursive: true });

for (const fixture of fixtures) {
  const doc = new jsPDF();
  doc.setFillColor(11, 31, 58);
  doc.rect(0, 0, 210, 297, "F");
  const metrics = layoutCover(doc, fixture);

  assert(metrics.titleLines.length <= 2, `${fixture.name}: title > 2 lines`);
  assert(
    metrics.titleMaxLineW <= TITLE_MAX_W + 0.5,
    `${fixture.name}: title line width ${metrics.titleMaxLineW.toFixed(1)} > TITLE_MAX_W ${TITLE_MAX_W}`
  );
  assert(metrics.labelLines.length <= 2, `${fixture.name}: priority label > 2 lines`);
  assert(
    metrics.scoreBlockRight <= CARD_X + CARD_W - CARD_PAD + 0.5,
    `${fixture.name}: score+"/ 100" overflows card (right=${metrics.scoreBlockRight.toFixed(1)}, edge=${CARD_X + CARD_W - CARD_PAD})`
  );
  assert(
    metrics.gradeW <= CARD_W - CARD_PAD * 2 + 1,
    `${fixture.name}: grade line width ${metrics.gradeW.toFixed(1)} overflows card`
  );

  for (const line of metrics.domainLines) {
    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    const w = doc.getTextWidth(line);
    assert(w <= TITLE_MAX_W + 0.5, `${fixture.name}: domain line overflows (${w.toFixed(1)})`);
  }

  const path = join(outDir, `cover-${fixture.name}.pdf`);
  writeFileSync(path, Buffer.from(doc.output("arraybuffer")));
  console.log(`[ok] ${fixture.name} → ${path}`);
}

console.log("[test-pdf-cover] all fixtures passed");
