function severityFor(status, priority = 9) {
  if (status === "fail" && priority <= 1) return "critical";
  if (status === "fail") return "high";
  if (status === "warn" && priority <= 2) return "high";
  if (status === "warn") return "medium";
  if (status === "info") return "low";
  return "ok";
}

function spoofingRisk(email) {
  if (!email.hasMx) return { level: "low", score: 15, reason: "Domenet ser ikke ut til å motta e-post." };
  let risk = 0;
  const reasons = [];
  if (!email.spf.present) { risk += 35; reasons.push("mangler SPF"); }
  else if (email.spf.policy !== "strict") { risk += 12; reasons.push("SPF er ikke streng"); }
  if (!email.dkim.present) { risk += 20; reasons.push("mangler DKIM"); }
  if (!email.dmarc.present) { risk += 35; reasons.push("mangler DMARC"); }
  else if (email.dmarc.policy === "none") { risk += 25; reasons.push("DMARC står på p=none"); }
  else if (email.dmarc.policy === "quarantine") { risk += 8; reasons.push("DMARC er quarantine, ikke reject"); }
  const level = risk >= 70 ? "critical" : risk >= 45 ? "high" : risk >= 20 ? "medium" : "low";
  return { level, score: Math.min(risk, 100), reason: reasons.length ? reasons.join(", ") : "SPF, DKIM og DMARC ser ut til å være på plass." };
}

export function buildSecurityReport({ domain, web, tlsInfo, email, dnssec, rdap, subdomains = [] }) {
  const findings = [];
  let webScore = 0;
  let emailScore = 0;
  let domainScore = 0;

  const add = (finding) => findings.push({ severity: severityFor(finding.status, finding.priority), ...finding });

  if (web.reachable) {
    webScore += 6;
    add({ id: "https", category: "web", title: "Nettstedet svarer på HTTPS", status: "ok", explain: "Trafikken til nettstedet kan krypteres." });
  } else {
    add({ id: "https", category: "web", title: "Nettstedet svarer ikke på HTTPS", status: "fail", priority: 1, explain: "Vi fikk ikke kontakt med nettstedet over sikker tilkobling.", fix: "Sett opp gyldig TLS-sertifikat og sørg for at port 443 svarer.", effort: "1-2 timer" });
  }

  if (web.httpRedirectsToHttps === true) {
    webScore += 4;
    add({ id: "http-redirect", category: "web", title: "HTTP videresendes til HTTPS", status: "ok", explain: "Besøkende sendes automatisk til sikker versjon." });
  } else if (web.httpRedirectsToHttps === false) {
    add({ id: "http-redirect", category: "web", title: "HTTP videresendes ikke til HTTPS", status: "fail", priority: 2, explain: "Nettstedet kan besøkes over usikret tilkobling.", fix: "Sett opp 301-redirect fra HTTP til HTTPS.", effort: "0,5 time" });
  }

  if (tlsInfo?.ok) {
    if (tlsInfo.certValid) {
      webScore += 7;
      add({ id: "cert", category: "web", title: `Gyldig sertifikat${tlsInfo.issuer ? ` fra ${tlsInfo.issuer}` : ""}`, status: "ok", explain: tlsInfo.daysToExpiry != null ? `Sertifikatet utløper om ${tlsInfo.daysToExpiry} dager.` : "Sertifikatet er gyldig." });
      if (tlsInfo.daysToExpiry != null && tlsInfo.daysToExpiry < 14) {
        add({ id: "cert-expiry", category: "web", title: `Sertifikat utløper snart (${tlsInfo.daysToExpiry} dager)`, status: "warn", priority: 1, explain: "Kort tid til utløp kan gi nedetid og nettleserfeil.", fix: "Forny sertifikatet og kontroller automatisk fornyelse.", effort: "0,5-1 time" });
      }
    } else {
      add({ id: "cert", category: "web", title: "Sertifikatet validerer ikke", status: "fail", priority: 1, explain: "Nettleseren stoler ikke på sertifikatet.", fix: "Installer et gyldig sertifikat fra en anerkjent utsteder.", effort: "1 time" });
    }

    if (tlsInfo.acceptsTls10 || tlsInfo.acceptsTls11) {
      add({ id: "tls-legacy", category: "web", title: "Utdaterte TLS-versjoner er aktivert", status: "warn", priority: 3, explain: "Serveren aksepterer TLS 1.0/1.1.", fix: "Deaktiver TLS 1.0 og 1.1. Behold TLS 1.2+.", effort: "0,5 time" });
    } else {
      webScore += 4;
      add({ id: "tls-modern", category: "web", title: `Moderne TLS${tlsInfo.protocol ? ` (${tlsInfo.protocol})` : ""}`, status: "ok", explain: "Kun moderne protokollversjoner ser ut til å være aktivert." });
    }
  }

  const headers = web.headers || {};
  if (headers.hsts?.present && headers.hsts.maxAge >= 15768000) {
    webScore += 7;
    add({ id: "hsts", category: "web", title: "HSTS er aktivert", status: "ok", explain: "Nettlesere husker at nettstedet kun skal besøkes over HTTPS." });
  } else {
    add({ id: "hsts", category: "web", title: headers.hsts?.present ? "HSTS har for kort levetid" : "Mangler HSTS", status: "warn", priority: 3, explain: "HSTS reduserer risikoen for nedgradering til usikret trafikk.", fix: "Legg til Strict-Transport-Security med lang max-age.", effort: "0,5 time" });
  }

  if (headers.csp) {
    webScore += 6;
    add({ id: "csp", category: "web", title: "Content-Security-Policy er satt", status: "ok", explain: "CSP begrenser hvilke kilder nettleseren får laste innhold fra." });
  } else {
    add({ id: "csp", category: "web", title: "Mangler Content-Security-Policy", status: "warn", priority: 3, explain: "CSP reduserer risikoen for script-injeksjon.", fix: "Start med CSP i report-only og stram inn etter testing.", effort: "2-4 timer" });
  }

  for (const [present, id, title] of [[headers.xContentTypeOptions, "nosniff", "X-Content-Type-Options"], [headers.frameProtection, "frame", "Klikkjacking-beskyttelse"], [headers.referrerPolicy, "referrer", "Referrer-Policy"]]) {
    if (present) {
      webScore += 2;
      add({ id, category: "web", title: `${title} er satt`, status: "ok", explain: "Headeren er på plass." });
    } else {
      add({ id, category: "web", title: `Mangler ${title}`, status: "warn", priority: 4, explain: "Dette er en enkel herdingsheader som bør settes.", fix: "Legg til headeren på webserver eller CDN.", effort: "0,25 time" });
    }
  }

  if (headers.poweredBy) add({ id: "powered-by", category: "web", title: `Avslører teknologi: ${headers.poweredBy}`, status: "info", priority: 4, explain: "X-Powered-By kan gjøre kartlegging enklere for angripere.", fix: "Fjern eller skjul headeren.", effort: "0,25 time" });

  if (email.hasMx) {
    emailScore += 4;
    add({ id: "mx", category: "email", title: "MX-oppføringer funnet", status: "ok", explain: `E-post leveres via: ${email.mx.slice(0, 2).join(", ")}` });
  } else {
    emailScore = 20;
    add({ id: "mx", category: "email", title: "Ingen MX-oppføringer", status: "info", explain: "Domenet ser ikke ut til å motta e-post." });
  }

  if (email.hasMx) {
    if (email.spf.present) {
      emailScore += email.spf.policy === "strict" ? 10 : 8;
      add({ id: "spf", category: "email", title: email.spf.policy === "strict" ? "SPF er streng" : "SPF er satt opp", status: email.spf.policy === "open" ? "warn" : "ok", explain: "SPF begrenser hvilke servere som kan sende e-post for domenet.", ...(email.spf.policy !== "strict" ? { fix: "Vurder -all når alle legitime avsendere er inkludert.", effort: "0,5 time", priority: 4 } : {}) });
    } else add({ id: "spf", category: "email", title: "Mangler SPF", status: "fail", priority: 1, explain: "Domenet er mer utsatt for e-postforfalskning.", fix: "Publiser SPF-record i DNS.", effort: "0,5-1 time" });

    if (email.dkim.present) {
      emailScore += 8;
      add({ id: "dkim", category: "email", title: `DKIM funnet (${email.dkim.selectors.join(", ")})`, status: "ok", explain: "Utgående e-post kan signeres kryptografisk." });
    } else add({ id: "dkim", category: "email", title: "Fant ingen DKIM-nøkler", status: "warn", priority: 2, explain: "Uten DKIM er det vanskeligere å verifisere e-post fra domenet.", fix: "Aktiver DKIM i e-postplattformen og publiser DNS-nøkler.", effort: "1 time" });

    if (email.dmarc.present) {
      emailScore += email.dmarc.policy === "reject" ? 14 : email.dmarc.policy === "quarantine" ? 11 : 6;
      add({ id: "dmarc", category: "email", title: `DMARC er satt opp (p=${email.dmarc.policy})`, status: email.dmarc.policy === "none" ? "warn" : "ok", explain: email.dmarc.policy === "none" ? "DMARC overvåker, men stopper ikke forfalsket e-post." : "Forfalsket e-post kan avvises eller settes i karantene.", ...(email.dmarc.policy === "none" ? { fix: "Trapp opp til quarantine og deretter reject etter analyse.", effort: "1-2 timer + oppfølging", priority: 2 } : {}) });
    } else add({ id: "dmarc", category: "email", title: "Mangler DMARC", status: "fail", priority: 1, explain: "DMARC er viktig for å stoppe e-postforfalskning.", fix: "Publiser DMARC-record og trapp opp policy over tid.", effort: "1-2 timer" });

    if (email.mtaSts) {
      emailScore += 4;
      add({ id: "mta-sts", category: "email", title: "MTA-STS er aktivert", status: "ok", explain: "Innkommende e-post tvinges over kryptert forbindelse." });
    }
  }

  const spoofing = spoofingRisk(email);
  add({ id: "email-spoofing-risk", category: "email", title: `Email spoofing risk: ${spoofing.level.toUpperCase()}`, status: spoofing.level === "low" ? "ok" : spoofing.level === "medium" ? "warn" : "fail", priority: spoofing.level === "critical" ? 1 : spoofing.level === "high" ? 2 : 4, severity: spoofing.level === "low" ? "ok" : spoofing.level, explain: spoofing.reason, fix: spoofing.level === "low" ? null : "Stram inn SPF, aktiver DKIM og sett DMARC til quarantine/reject etter kontroll.", effort: "1-3 timer" });

  if (dnssec.enabled === true) {
    domainScore += 8;
    add({ id: "dnssec", category: "domain", title: "DNSSEC er aktivert", status: "ok", explain: "DNS-svar kan valideres kryptografisk." });
  } else if (dnssec.enabled === false) add({ id: "dnssec", category: "domain", title: "DNSSEC er ikke aktivert", status: "warn", priority: 3, explain: "DNSSEC beskytter mot enkelte typer DNS-manipulasjon.", fix: "Aktiver DNSSEC hos registrar eller DNS-leverandør.", effort: "0,5 time" });

  if (rdap.found && rdap.daysToExpiry != null) {
    if (rdap.daysToExpiry > 30) {
      domainScore += 9;
      add({ id: "expiry", category: "domain", title: `Domenet er registrert til ${new Date(rdap.expires).toLocaleDateString("nb-NO")}`, status: "ok", explain: `${rdap.daysToExpiry} dager til fornyelse.` });
    } else add({ id: "expiry", category: "domain", title: `Domenet utløper om ${rdap.daysToExpiry} dager`, status: "fail", priority: 1, explain: "Utløpt domene kan stoppe både nettside og e-post.", fix: "Forny domenet og aktiver automatisk fornyelse.", effort: "0,25 time" });
  } else domainScore += 5;
  domainScore += 3;

  if (subdomains.length) {
    add({ id: "subdomains-discovered", category: "domain", title: `${subdomains.length} subdomener funnet passivt`, status: "info", priority: 5, explain: `Fant: ${subdomains.slice(0, 12).map((item) => item.host).join(", ")}${subdomains.length > 12 ? " ..." : ""}`, fix: "Gå gjennom eksponerte subdomener og fjern gamle test/staging-tjenester fra DNS.", effort: "1-2 timer" });
  } else add({ id: "subdomains-discovered", category: "domain", title: "Ingen vanlige subdomener funnet", status: "ok", explain: "Begrenset passiv DNS-sjekk fant ingen vanlige subdomener." });

  webScore = Math.min(webScore, 40);
  emailScore = Math.min(emailScore, 40);
  domainScore = Math.min(domainScore, 20);
  const score = Math.round(webScore + emailScore + domainScore);
  const actions = findings.filter((finding) => finding.fix).sort((a, b) => ({ critical: 0, high: 1, medium: 2, low: 3, ok: 4 }[a.severity] - { critical: 0, high: 1, medium: 2, low: 3, ok: 4 }[b.severity]) || (a.priority || 9) - (b.priority || 9));

  return { domain, scannedAt: new Date().toISOString(), score, grade: score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "E", categories: { web: { score: webScore, max: 40 }, email: { score: emailScore, max: 40 }, domain: { score: domainScore, max: 20 } }, spoofingRisk: spoofing, subdomains, findings, actions, summary: score >= 75 ? "Grunnsikringen ser god ut. Se tiltakene for videre herdning." : score >= 50 ? "Flere viktige kontroller er på plass, men noen punkter bør rettes." : "Domenet har flere sikkerhetsmangler som bør håndteres raskt." };
}
