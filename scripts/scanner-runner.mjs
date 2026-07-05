#!/usr/bin/env node

import { Resolver } from "node:dns/promises";
import tls from "node:tls";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Scanner runner must run server-side only.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
const resolver = new Resolver({ timeout: 4000, tries: 2 });
resolver.setServers(["1.1.1.1", "8.8.8.8"]);

const domainPattern = /^(?!-)[a-z0-9æøå-]{1,63}(\.[a-z0-9æøå-]{1,63})+$/i;
const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, ok: 4 };

function normalizeDomain(input) {
  return String(input || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].split(":")[0];
}

function safeError(error) {
  return error?.message ? String(error.message).slice(0, 500) : "Unknown scanner error.";
}

async function resolveA(domain) {
  try {
    return await resolver.resolve4(domain);
  } catch {
    return [];
  }
}

async function resolveTxt(name) {
  try {
    const records = await resolver.resolveTxt(name);
    return records.map((chunks) => chunks.join(""));
  } catch {
    return [];
  }
}

async function resolveMx(domain) {
  try {
    return (await resolver.resolveMx(domain)).sort((a, b) => a.priority - b.priority);
  } catch {
    return [];
  }
}

async function fetchWeb(domain) {
  const headers = { "user-agent": "PhoenixScanRunner/1.0 (+https://scan.hansen-it.com)" };
  const result = { reachable: false, httpRedirectsToHttps: null, headers: {} };
  try {
    const https = await fetch(`https://${domain}/`, { method: "GET", redirect: "manual", headers, signal: AbortSignal.timeout(8000) });
    result.reachable = https.status < 500;
    result.headers = {
      hsts: Boolean(https.headers.get("strict-transport-security")),
      csp: Boolean(https.headers.get("content-security-policy")),
      xContentTypeOptions: (https.headers.get("x-content-type-options") || "").toLowerCase() === "nosniff",
      frameProtection: Boolean(https.headers.get("x-frame-options")) || (https.headers.get("content-security-policy") || "").includes("frame-ancestors"),
      referrerPolicy: Boolean(https.headers.get("referrer-policy"))
    };
  } catch {}

  try {
    const http = await fetch(`http://${domain}/`, { method: "GET", redirect: "manual", headers, signal: AbortSignal.timeout(8000) });
    if ([301, 302, 307, 308].includes(http.status)) result.httpRedirectsToHttps = (http.headers.get("location") || "").startsWith("https://");
    else result.httpRedirectsToHttps = false;
  } catch {}

  return result;
}

function checkTls(domain) {
  return new Promise((resolve) => {
    const socket = tls.connect({ host: domain, port: 443, servername: domain, rejectUnauthorized: false, timeout: 6000 }, () => {
      const cert = socket.getPeerCertificate();
      const daysToExpiry = cert?.valid_to ? Math.floor((new Date(cert.valid_to).getTime() - Date.now()) / 86400000) : null;
      const result = { ok: true, protocol: socket.getProtocol(), certValid: socket.authorized, issuer: cert?.issuer?.O || cert?.issuer?.CN || null, daysToExpiry };
      socket.destroy();
      resolve(result);
    });
    socket.on("error", () => resolve({ ok: false }));
    socket.on("timeout", () => {
      socket.destroy();
      resolve({ ok: false });
    });
  });
}

async function checkEmail(domain) {
  const [txt, dmarcTxt, mx] = await Promise.all([resolveTxt(domain), resolveTxt(`_dmarc.${domain}`), resolveMx(domain)]);
  const spf = txt.find((record) => record.toLowerCase().startsWith("v=spf1"));
  const dmarc = dmarcTxt.find((record) => record.toLowerCase().startsWith("v=dmarc1"));
  const dmarcPolicy = dmarc?.match(/p\s*=\s*(none|quarantine|reject)/i)?.[1]?.toLowerCase() || null;
  return { hasMx: mx.length > 0, mx: mx.map((record) => record.exchange), spf: { present: Boolean(spf), record: spf || null }, dmarc: { present: Boolean(dmarc), policy: dmarcPolicy, record: dmarc || null } };
}

function addFinding(findings, finding) {
  findings.push(finding);
}

function buildReport(domain, { a, web, tlsInfo, email }) {
  const findings = [];
  let score = 0;

  if (a.length) score += 10;
  addFinding(findings, { id: "dns-a", category: "domain", title: a.length ? "DNS A-records funnet" : "Ingen DNS A-records funnet", severity: a.length ? "ok" : "high", explain: a.length ? `Domenet peker til ${a.length} IPv4-adresse(r).` : "Domenet ser ikke ut til å peke til en webserver.", fix: a.length ? null : "Kontroller DNS-oppsettet." });

  if (web.reachable) score += 20;
  addFinding(findings, { id: "https", category: "web", title: web.reachable ? "Nettstedet svarer på HTTPS" : "Nettstedet svarer ikke på HTTPS", severity: web.reachable ? "ok" : "high", explain: web.reachable ? "Besøkende kan nå nettstedet via sikker tilkobling." : "Nettstedet ser ikke ut til å være tilgjengelig via sikker HTTPS-forbindelse. Dette kan gjøre at besøkende mister tillit, og at nettlesere viser advarsler.", fix: web.reachable ? null : "Sett opp gyldig TLS-sertifikat og kontroller webserver/CDN." });

  if (web.httpRedirectsToHttps === true) score += 10;
  addFinding(findings, { id: "http-redirect", category: "web", title: web.httpRedirectsToHttps === true ? "HTTP videresendes til HTTPS" : "HTTP videresendes ikke til HTTPS", severity: web.httpRedirectsToHttps === true ? "ok" : "medium", explain: web.httpRedirectsToHttps === true ? "Besøkende sendes automatisk til sikker versjon." : "Besøkende kan ende på usikret versjon av nettstedet.", fix: web.httpRedirectsToHttps === true ? null : "Sett opp redirect fra HTTP til HTTPS." });

  if (tlsInfo.ok && tlsInfo.certValid) score += 20;
  addFinding(findings, { id: "tls", category: "web", title: tlsInfo.ok && tlsInfo.certValid ? "TLS-sertifikatet validerer" : "TLS-sertifikatet bør kontrolleres", severity: tlsInfo.ok && tlsInfo.certValid ? "ok" : "high", explain: tlsInfo.ok && tlsInfo.certValid ? `Sertifikatet er gyldig${tlsInfo.daysToExpiry != null ? ` og utløper om ${tlsInfo.daysToExpiry} dager` : ""}.` : "Sertifikatet kunne ikke valideres trygt i denne passive kontrollen.", fix: tlsInfo.ok && tlsInfo.certValid ? null : "Kontroller sertifikat, kjede og automatisk fornyelse." });

  const headerKeys = Object.values(web.headers || {}).filter(Boolean).length;
  score += Math.min(15, headerKeys * 3);
  addFinding(findings, { id: "headers", category: "web", title: `${headerKeys} sikkerhetsheadere observert`, severity: headerKeys >= 4 ? "ok" : "medium", explain: headerKeys >= 4 ? "Flere viktige web-headere er på plass." : "Noen vanlige sikkerhetsheadere mangler eller bør kontrolleres.", fix: headerKeys >= 4 ? null : "Legg til HSTS, CSP, X-Content-Type-Options, frame protection og Referrer-Policy der det passer." });

  if (email.hasMx) score += 5;
  if (email.spf.present) score += 10;
  if (email.dmarc.present && email.dmarc.policy !== "none") score += 10;
  addFinding(findings, { id: "email-protection", category: "email", title: "E-postbeskyttelse kontrollert", severity: email.hasMx && email.spf.present && email.dmarc.present ? "ok" : "high", explain: email.hasMx ? `MX: ${email.mx.slice(0, 2).join(", ") || "funnet"}. SPF ${email.spf.present ? "er satt" : "mangler"}. DMARC ${email.dmarc.present ? `er satt (${email.dmarc.policy || "ukjent policy"})` : "mangler"}.` : "Domenet ser ikke ut til å motta e-post.", fix: email.hasMx && email.spf.present && email.dmarc.present ? null : "Sett opp eller stram inn SPF og DMARC. Legg til DKIM i e-postplattformen." });

  const roundedScore = Math.max(0, Math.min(100, Math.round(score)));
  const actions = findings.filter((finding) => finding.fix).sort((a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9));
  return {
    domain,
    scannedAt: new Date().toISOString(),
    score: roundedScore,
    grade: roundedScore >= 90 ? "A" : roundedScore >= 75 ? "B" : roundedScore >= 60 ? "C" : roundedScore >= 40 ? "D" : "E",
    categories: { web: { score: Math.min(60, score), max: 60 }, email: { score: email.hasMx ? 25 : 10, max: 25 }, domain: { score: a.length ? 15 : 0, max: 15 } },
    findings,
    actions,
    summary: roundedScore >= 75 ? "Grunnsikringen ser god ut. Se appendix for forbedringer." : "Noen viktige punkter bør følges opp før sikkerheten vurderes som moden."
  };
}

async function claimOldestQueuedJob() {
  const { data: queued, error } = await supabase.from("scan_jobs").select("*").eq("status", "queued").order("queued_at", { ascending: true }).limit(1).maybeSingle();
  if (error) throw error;
  if (!queued) return null;

  const startedAt = new Date().toISOString();
  const { data: claimed, error: claimError } = await supabase
    .from("scan_jobs")
    .update({ status: "running", started_at: startedAt, error: null, error_message: null, metadata: { ...(queued.metadata || {}), runner: "scripts/scanner-runner.mjs", runner_started_at: startedAt, runner_egress_ip: process.env.SCANNER_EGRESS_IP || null } })
    .eq("id", queued.id)
    .eq("status", "queued")
    .select("*")
    .single();
  if (claimError) throw claimError;
  return claimed;
}

async function failJob(job, error) {
  const message = safeError(error);
  await supabase.from("scan_jobs").update({ status: "failed", completed_at: new Date().toISOString(), error: message, error_message: message }).eq("id", job.id);
  console.error(`scan_job ${job.id} failed: ${message}`);
}

async function completeJob(job, domains) {
  await supabase.from("scan_jobs").update({ status: "completed", completed_at: new Date().toISOString(), error: null, error_message: null, metadata: { ...(job.metadata || {}), passive_domains_scanned: domains } }).eq("id", job.id);
}

async function persist(job, authorization, report) {
  const { data: result, error: resultError } = await supabase.from("scan_results").insert({ job_id: job.id, authorization_id: authorization.id, status: "completed", summary: report.summary, raw_result: report }).select("*").single();
  if (resultError) throw resultError;

  const findings = report.findings.map((finding) => ({ result_id: result.id, job_id: job.id, authorization_id: authorization.id, title: finding.title, description: finding.explain || null, severity: ["critical", "high", "medium", "low"].includes(finding.severity) ? finding.severity : "info", category: finding.category || null, recommendation: finding.fix || null, evidence: { raw: finding }, status: "open" }));
  if (findings.length) {
    const { error } = await supabase.from("scan_findings").insert(findings);
    if (error) throw error;
  }

  const { error: reportError } = await supabase.from("scan_reports").insert({ job_id: job.id, authorization_id: authorization.id, title: `Phoenix Security Report: ${report.domain}`, report });
  if (reportError) throw reportError;
}

async function runOnce() {
  const job = await claimOldestQueuedJob();
  if (!job) {
    console.log("No queued scan_jobs.");
    return;
  }

  try {
    const { data: authorization, error: authError } = await supabase.from("scan_authorizations").select("*").eq("id", job.authorization_id).single();
    if (authError || !authorization) throw new Error("Missing scan_authorization.");
    if (authorization.status !== "signed") throw new Error("Scan authorization is not signed.");
    if (job.scan_type !== "passive") throw new Error(`Runner MVP only supports scan_type='passive'. Got '${job.scan_type}'.`);

    const domains = (job.domains || []).map(normalizeDomain).filter(Boolean);
    if (!domains.length) throw new Error("Passive scan requires at least one domain.");

    const completedDomains = [];
    for (const domain of domains) {
      if (!domainPattern.test(domain)) throw new Error(`Invalid domain in scope: ${domain}`);
      const a = await resolveA(domain);
      const [web, tlsInfo, email] = await Promise.all([fetchWeb(domain), checkTls(domain), checkEmail(domain)]);
      const report = buildReport(domain, { a, web, tlsInfo, email });
      await persist(job, authorization, report);
      completedDomains.push(domain);
    }
    await completeJob(job, completedDomains);
    console.log(`scan_job ${job.id} completed for ${completedDomains.join(", ")}`);
  } catch (error) {
    await failJob(job, error);
  }
}

await runOnce();
