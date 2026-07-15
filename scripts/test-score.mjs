#!/usr/bin/env node
/**
 * Regression lock for lib/securityScan/score.js (buildSecurityReport).
 *
 * Run: node scripts/test-score.mjs
 * (also via npm run test:score)
 *
 * If this fails after an intentional scoring change, update EXPECTED_* below
 * in the same PR — never silently drift.
 */

import { buildSecurityReport } from "../lib/securityScan/score.js";

/** Fixed fixture — do not use live network data. */
const FIXTURE = {
  domain: "fixture.example",
  web: {
    reachable: true,
    finalHost: "fixture.example",
    httpRedirectsToHttps: true,
    headers: {
      hsts: { present: true, maxAge: 31536000, value: "max-age=31536000" },
      csp: true,
      xContentTypeOptions: true,
      frameProtection: true,
      referrerPolicy: true,
      permissionsPolicy: true,
      server: null,
      poweredBy: null,
    },
  },
  tlsInfo: {
    ok: true,
    protocol: "TLSv1.3",
    certValid: true,
    issuer: "Fixture CA",
    daysToExpiry: 90,
    acceptsTls10: false,
    acceptsTls11: false,
  },
  email: {
    hasMx: true,
    mx: ["mail.fixture.example"],
    spf: {
      present: true,
      policy: "strict",
      exceedsLookupLimit: false,
      multipleRecords: false,
      hasPtr: false,
      lookupCount: 2,
    },
    dmarc: { present: true, policy: "reject", hasReporting: true, spInherit: true },
    dkim: {
      present: true,
      selectors: ["selector1"],
      selectorDetails: [{ selector: "selector1", keyBits: 2048, revoked: false, testMode: false }],
    },
    mtaSts: true,
    tlsRpt: true,
    mxHealth: null,
    bimi: { present: false },
  },
  dnssec: { enabled: true },
  rdap: { found: true, expires: "2030-01-01T00:00:00.000Z", daysToExpiry: 1200 },
  subdomains: [],
  exposedBackend: null,
};

/** Locked expectations — update deliberately when changing score.js weights. */
const EXPECTED_SCORE = 100;
const EXPECTED_GRADE = "A";
const EXPECTED_CATEGORIES = {
  web: { score: 40, max: 40 },
  email: { score: 40, max: 40 },
  domain: { score: 20, max: 20 },
};
const EXPECTED_FINDING_IDS = [
  "https",
  "http-redirect",
  "cert",
  "tls-modern",
  "hsts",
  "csp",
  "nosniff",
  "frame",
  "referrer",
  "mx",
  "spf",
  "dkim",
  "dmarc",
  "dmarc-sp-inherit",
  "mta-sts",
  "email-spoofing-risk",
  "dnssec",
  "expiry",
  "subdomains-discovered",
];

function assertEqual(label, actual, expected) {
  const a = typeof actual === "object" ? JSON.stringify(actual) : actual;
  const e = typeof expected === "object" ? JSON.stringify(expected) : expected;
  if (a !== e) {
    throw new Error(`${label}: expected ${e}, got ${a}`);
  }
}

const report = buildSecurityReport(FIXTURE);

assertEqual("score", report.score, EXPECTED_SCORE);
assertEqual("grade", report.grade, EXPECTED_GRADE);
assertEqual("categories", report.categories, EXPECTED_CATEGORIES);
assertEqual(
  "finding ids",
  report.findings.map((f) => f.id),
  EXPECTED_FINDING_IDS
);

const okInActions = (report.actions || []).filter(
  (item) => item.severity === "ok" || item.status === "ok"
);
if (okInActions.length) {
  throw new Error(
    `actions must not include OK findings, got: ${okInActions.map((i) => i.id || i.title).join(", ")}`
  );
}

console.log(`[test-score] OK — score=${report.score} grade=${report.grade} findings=${report.findings.length}`);
