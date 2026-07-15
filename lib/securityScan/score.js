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
  else if (email.spf.exceedsLookupLimit || email.spf.multipleRecords || email.spf.policy === "open") {
    risk += 30;
    reasons.push("SPF er satt opp, men virker ikke i praksis");
  } else if (email.spf.policy !== "strict") { risk += 12; reasons.push("SPF er ikke streng"); }
  if (!email.dkim.present) { risk += 20; reasons.push("mangler DKIM"); }
  else if ((email.dkim.selectorDetails || []).some((item) => item.keyBits && item.keyBits < 1024)) {
    risk += 15;
    reasons.push("DKIM-nøkkel er for svak");
  }
  if (!email.dmarc.present) { risk += 35; reasons.push("mangler DMARC"); }
  else if (email.dmarc.policy === "none") { risk += 25; reasons.push("DMARC står på p=none"); }
  else if (email.dmarc.policy === "quarantine") { risk += 8; reasons.push("DMARC er quarantine, ikke reject"); }
  if (email.dmarc?.present && !email.dmarc.hasReporting) { risk += 10; reasons.push("DMARC uten rapportering"); }
  const level = risk >= 70 ? "critical" : risk >= 45 ? "high" : risk >= 20 ? "medium" : "low";
  return { level, score: Math.min(risk, 100), reason: reasons.length ? reasons.join(", ") : "SPF, DKIM og DMARC ser ut til å være på plass." };
}

function clip(str, max = 100) {
  const text = String(str || "").trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function expiryLabel(daysToExpiry) {
  if (daysToExpiry == null) return null;
  const date = new Date(Date.now() + daysToExpiry * 86400000);
  return date.toLocaleDateString("nb-NO");
}

export function buildSecurityReport({ domain, web, tlsInfo, email, dnssec, rdap, subdomains = [], exposedBackend = null, dnsPresence = null }) {
  const findings = [];
  let webScore = 0;
  let emailScore = 0;
  let domainScore = 0;

  const add = (finding) => {
    const severity = finding.severity || severityFor(finding.status, finding.priority);
    const entry = { ...finding, severity };
    // OK-funn er konstateringer, ikke tiltak — aldri i actions-lista
    if (severity === "ok" || entry.status === "ok") {
      delete entry.fix;
      delete entry.effort;
    }
    findings.push(entry);
  };

  if (dnsPresence?.registeredEmpty) {
    add({
      id: "domain-registered-empty",
      category: "domain",
      title: "Domenet er registrert, men har ingen aktive tjenester",
      status: "warn",
      priority: 2,
      severity: "high",
      explain: "Domenet har NS-oppføringer (sonen er delegert), men ingen A-, AAAA- eller MX-records.",
      consequence: "Ingen nettside eller e-post kan nås via dette domenet i dag. Det kan være ubrukt, feilkonfigurert, eller tjenester som peker et annet sted.",
      fix: "Legg inn A/AAAA for web og/eller MX for e-post, eller fjern ubrukte domener fra porteføljen.",
      effort: "0,5–2 timer",
      evidence: {
        ns: (dnsPresence.ns || []).slice(0, 4).join(", ") || "NS funnet",
        a: "ingen",
        aaaa: "ingen",
        mx: "ingen",
      },
    });
  }

  if (web.reachable) {
    webScore += 6;
    add({
      id: "https",
      category: "web",
      title: "Nettstedet svarer på HTTPS",
      status: "ok",
      explain: `HTTPS svarte for ${web.finalHost || domain}.`,
      evidence: { host: web.finalHost || domain, status: "reachable" },
    });
  } else {
    add({
      id: "https",
      category: "web",
      title: "Nettstedet svarer ikke på HTTPS",
      status: "fail",
      priority: 1,
      explain: "Vi fikk ikke kontakt med nettstedet over HTTPS (port 443).",
      consequence: "Besøkende og integrasjoner kan ikke nå tjenesten sikkert — eller i det hele tatt.",
      fix: "Sett opp gyldig TLS-sertifikat og sørg for at port 443 svarer.",
      effort: "1-2 timer",
      evidence: { host: domain, status: "unreachable" },
    });
  }

  if (web.httpRedirectsToHttps === true) {
    webScore += 4;
    add({
      id: "http-redirect",
      category: "web",
      title: "HTTP videresendes til HTTPS",
      status: "ok",
      explain: "HTTP-forespørsler ble videresendt til HTTPS.",
      evidence: { status: "redirects_to_https" },
    });
  } else if (web.httpRedirectsToHttps === false) {
    add({
      id: "http-redirect",
      category: "web",
      title: "HTTP videresendes ikke til HTTPS",
      status: "fail",
      priority: 2,
      explain: "HTTP svarte uten å sende brukeren til HTTPS.",
      consequence: "Besøkende kan ende på usikret tilkobling og bli utsatt for avlytting eller manipulering.",
      fix: "Sett opp 301-redirect fra HTTP til HTTPS.",
      effort: "0,5 time",
      evidence: { status: "no_https_redirect" },
    });
  }

  if (tlsInfo?.ok) {
    if (tlsInfo.certValid) {
      webScore += 7;
      const expires = expiryLabel(tlsInfo.daysToExpiry);
      add({
        id: "cert",
        category: "web",
        title: `Gyldig sertifikat${tlsInfo.issuer ? ` fra ${tlsInfo.issuer}` : ""}`,
        status: "ok",
        explain: tlsInfo.daysToExpiry != null
          ? `Sertifikatet validerer. Utløper om ${tlsInfo.daysToExpiry} dager${expires ? ` (${expires})` : ""}.`
          : "Sertifikatet validerer.",
        evidence: {
          issuer: tlsInfo.issuer || "ukjent",
          expires: expires || "ukjent",
          daysToExpiry: tlsInfo.daysToExpiry,
        },
      });
      if (tlsInfo.daysToExpiry != null && tlsInfo.daysToExpiry < 14) {
        add({
          id: "cert-expiry",
          category: "web",
          title: `Sertifikatet utløper om ${tlsInfo.daysToExpiry} dager`,
          status: "warn",
          priority: 1,
          explain: `Sertifikatet utløper om ${tlsInfo.daysToExpiry} dager${expires ? ` (${expires})` : ""}.`,
          consequence: "Kort tid til utløp kan gi nettleserfeil og stoppe HTTPS for kunder.",
          fix: "Forny sertifikatet og kontroller automatisk fornyelse.",
          effort: "0,5-1 time",
          evidence: { issuer: tlsInfo.issuer || "ukjent", expires: expires || "ukjent", daysToExpiry: tlsInfo.daysToExpiry },
        });
      }
    } else {
      add({
        id: "cert",
        category: "web",
        title: "Sertifikatet validerer ikke",
        status: "fail",
        priority: 1,
        explain: "TLS-handshake lyktes, men sertifikatet ble ikke godtatt som gyldig.",
        consequence: "Nettlesere vil advare eller blokkere brukere — tilliten til nettstedet faller.",
        fix: "Installer et gyldig sertifikat fra en anerkjent utsteder.",
        effort: "1 time",
        evidence: { issuer: tlsInfo.issuer || "ukjent", status: "not_authorized" },
      });
    }

    if (tlsInfo.acceptsTls10 || tlsInfo.acceptsTls11) {
      add({
        id: "tls-legacy",
        category: "web",
        title: "Utdaterte TLS-versjoner er aktivert",
        status: "warn",
        priority: 3,
        explain: `Serveren aksepterer fortsatt ${[tlsInfo.acceptsTls10 && "TLS 1.0", tlsInfo.acceptsTls11 && "TLS 1.1"].filter(Boolean).join(" og ")}.`,
        consequence: "Gamle protokoller er sårbare og kan trekkes frem i sikkerhetsrevisjoner hos kunder og partnere.",
        fix: "Deaktiver TLS 1.0 og 1.1. Behold TLS 1.2+.",
        effort: "0,5 time",
        evidence: {
          protocol: tlsInfo.protocol || "ukjent",
          acceptsTls10: tlsInfo.acceptsTls10,
          acceptsTls11: tlsInfo.acceptsTls11,
        },
      });
    } else {
      webScore += 4;
      add({
        id: "tls-modern",
        category: "web",
        title: `Moderne TLS${tlsInfo.protocol ? ` (${tlsInfo.protocol})` : ""}`,
        status: "ok",
        explain: `${tlsInfo.protocol || "Moderne TLS"} er i bruk. TLS 1.0/1.1 ble avvist.`,
        evidence: {
          protocol: tlsInfo.protocol || "ukjent",
          value: "TLS 1.0/1.1 avvist",
        },
      });
    }
  }

  const headers = web.headers || {};
  if (headers.hsts?.present && headers.hsts.maxAge >= 15768000) {
    webScore += 7;
    add({
      id: "hsts",
      category: "web",
      title: "HSTS er aktivert",
      status: "ok",
      explain: "Strict-Transport-Security er satt med tilstrekkelig max-age.",
      evidence: { header: clip(headers.hsts.value, 120) || `max-age=${headers.hsts.maxAge}` },
    });
  } else {
    add({
      id: "hsts",
      category: "web",
      title: headers.hsts?.present ? "HSTS har for kort levetid" : "Mangler HSTS",
      status: "warn",
      priority: 3,
      explain: headers.hsts?.present
        ? `HSTS finnes, men max-age er ${headers.hsts.maxAge} (under anbefalt 15768000).`
        : "Strict-Transport-Security-headeren mangler.",
      consequence: "Uten sterk HSTS kan brukere oftere bli lurt over på usikret HTTP ved første besøk eller DNS-manipulasjon.",
      fix: "Legg til Strict-Transport-Security med lang max-age.",
      effort: "0,5 time",
      evidence: { header: headers.hsts?.value || "Header ikke tilstede", maxAge: headers.hsts?.maxAge ?? 0 },
    });
  }

  if (headers.csp) {
    webScore += 6;
    add({
      id: "csp",
      category: "web",
      title: "Content-Security-Policy er satt",
      status: "ok",
      explain: "Content-Security-Policy-headeren er til stede.",
      evidence: { header: clip(headers.cspValue, 100) || "Header tilstede" },
    });
  } else {
    add({
      id: "csp",
      category: "web",
      title: "Mangler Content-Security-Policy",
      status: "warn",
      priority: 3,
      explain: "Content-Security-Policy-headeren mangler.",
      consequence: "Uten CSP er det lettere for et XSS-angrep å laste inn skadelig script fra tredjepart.",
      fix: "Start med CSP i report-only og stram inn etter testing.",
      effort: "2-4 timer",
      evidence: { header: "Header ikke tilstede" },
    });
  }

  for (const [present, id, title] of [[headers.xContentTypeOptions, "nosniff", "X-Content-Type-Options"], [headers.frameProtection, "frame", "Klikkjacking-beskyttelse"], [headers.referrerPolicy, "referrer", "Referrer-Policy"]]) {
    if (present) {
      webScore += 2;
      add({
        id,
        category: "web",
        title: `${title} er satt`,
        status: "ok",
        explain: `${title} er satt på HTTPS-svaret.`,
        evidence: { header: title },
      });
    } else {
      add({
        id,
        category: "web",
        title: `Mangler ${title}`,
        status: "warn",
        priority: 4,
        explain: `${title} mangler i HTTPS-svaret.`,
        consequence: "En enkel herdingsheader som reduserer risiko for misbruk av nettleseratferd.",
        fix: "Legg til headeren på webserver eller CDN.",
        effort: "0,25 time",
        evidence: { header: "Header ikke tilstede" },
      });
    }
  }

  if (headers.poweredBy) {
    add({
      id: "powered-by",
      category: "web",
      title: `Avslører teknologi: ${headers.poweredBy}`,
      status: "info",
      priority: 4,
      explain: `X-Powered-By er satt til «${headers.poweredBy}».`,
      consequence: "Teknologistakk blir lettere å kartlegge for angripere.",
      fix: "Fjern eller skjul headeren.",
      effort: "0,25 time",
      evidence: { header: headers.poweredBy },
    });
  }

  if (email.hasMx) {
    emailScore += 4;
    add({
      id: "mx",
      category: "email",
      title: "MX er konfigurert for e-postmottak",
      status: "ok",
      explain: `MX peker til: ${(email.mx || []).slice(0, 3).join(", ") || "ukjent"}.`,
      evidence: { host: (email.mx || []).slice(0, 3).join(", ") || "MX funnet" },
    });
  } else {
    emailScore = 20;
    add({
      id: "mx",
      category: "email",
      title: "Mangler MX-oppføringer",
      status: "info",
      explain: "Ingen MX-records ble funnet for domenet.",
      consequence: "Domenet ser ikke ut til å motta e-post — eller MX er bevisst utelatt.",
      evidence: { mx: "ingen" },
    });
  }

  if (email.hasMx) {
    if (email.spf.present) {
      const spfBroken = email.spf.exceedsLookupLimit || email.spf.multipleRecords || email.spf.policy === "open";
      if (!spfBroken) emailScore += email.spf.policy === "strict" ? 10 : 8;

      if (spfBroken) {
        add({
          id: "spf",
          category: "email",
          title: "SPF er satt opp, men svekket",
          status: "warn",
          priority: 2,
          explain: "SPF-recorden finnes, men er satt opp på en måte som svekker beskyttelsen.",
          consequence: "Mottakere kan ignorere SPF, eller hvem som helst kan sende i deres navn.",
          evidence: { record: clip(email.spf.record, 120) || "v=spf1 …" },
        });
      } else if (email.spf.policy === "strict") {
        add({
          id: "spf",
          category: "email",
          title: "SPF er streng (-all)",
          status: "ok",
          explain: "SPF-recorden begrenser hvilke servere som kan sende e-post for domenet.",
          evidence: { record: clip(email.spf.record, 120) || "v=spf1 …" },
        });
      } else {
        add({
          id: "spf",
          category: "email",
          title: "SPF er satt opp, men ikke streng",
          status: "warn",
          priority: 4,
          explain: "SPF finnes, men ender ikke med -all (streng policy).",
          consequence: "Med ~all eller lignende kan forfalsket e-post fortsatt slippe gjennom hos enkelte mottakere.",
          fix: "Vurder -all når alle legitime avsendere er inkludert.",
          effort: "0,5 time",
          evidence: { record: clip(email.spf.record, 120) || "v=spf1 …" },
        });
      }
    } else {
      add({
        id: "spf",
        category: "email",
        title: "Mangler SPF",
        status: "fail",
        priority: 1,
        explain: "Ingen SPF-record (v=spf1) ble funnet i DNS.",
        consequence: "Domenet er mer utsatt for e-postforfalskning — mottakere har lite å stole på.",
        fix: "Publiser SPF-record i DNS.",
        effort: "0,5-1 time",
        evidence: { record: "Ingen SPF-record" },
      });
    }

    if (email.spf?.multipleRecords) {
      add({
        id: "spf-multiple",
        category: "email",
        title: "Flere SPF-records på domenet",
        status: "fail",
        priority: 1,
        severity: "critical",
        explain: "Domenet har mer enn én SPF-record.",
        consequence: "Det gir «permerror» hos mottakere, og SPF-en beskytter dere ikke i praksis — selv om den ser riktig ut.",
        fix: "Slå sammen til én v=spf1-record og fjern de andre.",
        effort: "0,5 time",
        evidence: { record: clip(email.spf.record, 120) || "flere v=spf1" },
      });
    }

    if (email.spf?.exceedsLookupLimit) {
      add({
        id: "spf-lookup-limit",
        category: "email",
        title: "SPF krever for mange DNS-oppslag",
        status: "fail",
        priority: 1,
        severity: "critical",
        explain: `SPF-oppsettet krever for mange DNS-oppslag (${email.spf.lookupCount} av maks 10).`,
        consequence: "Mottakere som Gmail og Outlook ignorerer SPF-en helt — den beskytter dere ikke i dag, selv om den ser riktig ut.",
        fix: "Flat ut SPF-en: reduser include-kjeder, fjern unødvendige a/mx/exists og hold dere under 10 DNS-oppslag.",
        effort: "1-2 timer",
        evidence: { record: clip(email.spf.record, 100) || "v=spf1 …", value: `${email.spf.lookupCount}/10 lookups` },
      });
    }

    if (email.spf?.policy === "open") {
      add({
        id: "spf-plus-all",
        category: "email",
        title: "SPF tillater alle avsendere (+all)",
        status: "fail",
        priority: 1,
        severity: "critical",
        explain: "SPF ender med +all.",
        consequence: "Hvem som helst kan sende e-post som dere — SPF-en er verdiløs mot forfalskning.",
        fix: "Bytt til ~all midlertidig, og deretter -all når alle legitime tjenester er listet.",
        effort: "0,5-1 time",
        evidence: { record: clip(email.spf.record, 120) || "+all" },
      });
    }

    if (email.spf?.hasPtr) {
      add({
        id: "spf-ptr",
        category: "email",
        title: "SPF bruker utdatert ptr-mekanisme",
        status: "warn",
        priority: 3,
        severity: "medium",
        explain: "SPF-recorden bruker ptr.",
        consequence: "Mekanismen er utdatert, treg og upålitelig, og anbefales ikke lenger.",
        fix: "Erstatt ptr med konkrete include:/ip4:/ip6:-mekanismer.",
        effort: "0,5 time",
        evidence: { record: clip(email.spf.record, 120) },
      });
    }

    if (email.dkim.present) {
      const weak = (email.dkim.selectorDetails || []).some((item) => item.keyBits && item.keyBits < 2048);
      if (!weak) emailScore += 8;
      else emailScore += 4;
      add({
        id: "dkim",
        category: "email",
        title: `DKIM er aktivert (${email.dkim.selectors.join(", ")})`,
        status: "ok",
        explain: `DKIM-selectorer i DNS: ${email.dkim.selectors.join(", ")}.`,
        evidence: { selectors: email.dkim.selectors.join(", ") },
      });
    } else {
      add({
        id: "dkim",
        category: "email",
        title: "Mangler DKIM",
        status: "warn",
        priority: 2,
        explain: "Ingen DKIM-nøkler ble funnet med vanlige selectorer.",
        consequence: "Uten DKIM er det vanskeligere å verifisere at e-post faktisk kommer fra dere.",
        fix: "Aktiver DKIM i e-postplattformen og publiser DNS-nøkler.",
        effort: "1 time",
        evidence: { selectors: "ingen treff" },
      });
    }

    for (const detail of email.dkim?.selectorDetails || []) {
      if (detail.revoked) {
        add({
          id: `dkim-revoked-${detail.selector}`,
          category: "email",
          title: `DKIM-selector ${detail.selector} er revokert`,
          status: "warn",
          priority: 2,
          severity: "medium",
          explain: `Selector «${detail.selector}» har tom p= og er markert som revokert.`,
          consequence: "Signaturer med denne nøkkelen vil feile hos mottakere.",
          fix: "Fjern ubrukte selectorer, eller publiser en ny gyldig nøkkel.",
          effort: "0,5 time",
          evidence: { selector: detail.selector, value: "revoked (empty p=)" },
        });
      } else if (detail.keyBits != null && detail.keyBits > 0 && detail.keyBits < 1024) {
        add({
          id: `dkim-bits-critical-${detail.selector}`,
          category: "email",
          title: `DKIM-nøkkel ${detail.selector} er for svak (${detail.keyBits} bit)`,
          status: "fail",
          priority: 1,
          severity: "critical",
          explain: `DKIM-selector «${detail.selector}» bruker en RSA-nøkkel på bare ${detail.keyBits} bit.`,
          consequence: "Nøkkelen er for svak til å stole på, og mange mottakere vil behandle signaturen som usikker.",
          fix: "Generer minst 2048-bit RSA (eller Ed25519) og oppdater DNS.",
          effort: "0,5-1 time",
          evidence: { selector: detail.selector, value: `${detail.keyBits} bit` },
        });
      } else if (detail.keyBits != null && detail.keyBits > 0 && detail.keyBits < 2048) {
        add({
          id: `dkim-bits-medium-${detail.selector}`,
          category: "email",
          title: `DKIM-nøkkel ${detail.selector} er under anbefalt lengde (${detail.keyBits} bit)`,
          status: "warn",
          priority: 3,
          severity: "medium",
          explain: `Selector «${detail.selector}» har ${detail.keyBits}-bit nøkkel.`,
          consequence: "Anbefalingen i dag er minst 2048 bit for RSA.",
          fix: "Roter til en 2048-bit (eller sterkere) DKIM-nøkkel.",
          effort: "0,5-1 time",
          evidence: { selector: detail.selector, value: `${detail.keyBits} bit` },
        });
      }

      if (detail.testMode) {
        add({
          id: `dkim-test-${detail.selector}`,
          category: "email",
          title: `DKIM-selector ${detail.selector} er i testmodus`,
          status: "warn",
          priority: 3,
          severity: "medium",
          explain: `Selector «${detail.selector}» har t=y (testmodus).`,
          consequence: "Mottakere kan ignorere DKIM-feil, så beskyttelsen er svekket.",
          fix: "Fjern t=y når DKIM er verifisert i produksjon.",
          effort: "0,25 time",
          evidence: { selector: detail.selector, value: "t=y" },
        });
      }
    }

    if (email.dmarc.present) {
      const dmarcWeak =
        email.dmarc.policy === "none" ||
        !email.dmarc.hasReporting ||
        (email.dmarc.pct != null && email.dmarc.pct < 100) ||
        email.dmarc.externalRuaVerified === false;
      if (!dmarcWeak) emailScore += email.dmarc.policy === "reject" ? 14 : email.dmarc.policy === "quarantine" ? 11 : 6;
      else emailScore += email.dmarc.policy === "reject" ? 8 : email.dmarc.policy === "quarantine" ? 6 : 3;

      if (email.dmarc.policy === "none") {
        add({
          id: "dmarc",
          category: "email",
          title: "DMARC er satt opp (p=none)",
          status: "warn",
          priority: 2,
          explain: "DMARC-recorden finnes, men står på p=none.",
          consequence:
            "Dere ser hvem som misbruker domenet, men ingenting stoppes. En svindler kan fortsatt sende faktura i deres navn, og mottakers e-postserver vil levere den.",
          fix: "Analyser DMARC-rapportene i noen uker, trapp så opp til p=quarantine og deretter p=reject.",
          effort: "1-2 timer + oppfølging",
          evidence: { record: clip(email.dmarc.record, 120) || `p=${email.dmarc.policy}` },
        });
      } else {
        add({
          id: "dmarc",
          category: "email",
          title: `DMARC håndhever policy (p=${email.dmarc.policy})`,
          status: "ok",
          explain: `DMARC er publisert med p=${email.dmarc.policy}.`,
          evidence: { record: clip(email.dmarc.record, 120) || `p=${email.dmarc.policy}` },
        });
      }
    } else {
      add({
        id: "dmarc",
        category: "email",
        title: "Mangler DMARC",
        status: "fail",
        priority: 1,
        explain: "Ingen DMARC-record (_dmarc) ble funnet.",
        consequence: "Uten DMARC er det vanskelig å stoppe e-postforfalskning — mottakere mangler en klar policy.",
        fix: "Publiser DMARC-record og trapp opp policy over tid.",
        effort: "1-2 timer",
        evidence: { record: "Ingen DMARC-record" },
      });
    }

    if (email.dmarc?.present && !email.dmarc.hasReporting) {
      add({
        id: "dmarc-no-rua",
        category: "email",
        title: "DMARC mangler rapportering (rua)",
        status: "fail",
        priority: 2,
        severity: "high",
        explain: "DMARC er satt opp uten rua=.",
        consequence: "Policyen er «blind»: dere ser aldri hvem som prøver å misbruke domenet, og dere får ikke data til å trappe opp trygt.",
        fix: "Legg til rua=mailto:… (gjerne egen rapportadresse eller en DMARC-tjeneste).",
        effort: "0,5 time",
        evidence: { record: clip(email.dmarc.record, 120) },
      });
    }

    if (email.dmarc?.present && email.dmarc.pct != null && email.dmarc.pct < 100) {
      add({
        id: "dmarc-pct",
        category: "email",
        title: `DMARC gjelder bare ${email.dmarc.pct}% av e-posten`,
        status: "warn",
        priority: 3,
        severity: "medium",
        explain: `DMARC har pct=${email.dmarc.pct}.`,
        consequence: "Policyen håndheves bare på en andel av meldingene — resten slipper gjennom uten DMARC-beskyttelse.",
        fix: "Når rapportene ser stabile ut: sett pct=100.",
        effort: "0,25 time",
        evidence: { record: clip(email.dmarc.record, 120), value: `pct=${email.dmarc.pct}` },
      });
    }

    if (email.dmarc?.present && email.dmarc.sp) {
      add({
        id: "dmarc-sp",
        category: "email",
        title: `DMARC subdomain-policy er satt (sp=${email.dmarc.sp})`,
        status: "ok",
        explain: `Subdomener har eksplisitt policy sp=${email.dmarc.sp}.`,
        evidence: { record: clip(email.dmarc.record, 120), policy: `sp=${email.dmarc.sp}` },
      });
    } else if (email.dmarc?.present && email.dmarc.policy && email.dmarc.policy !== "none") {
      add({
        id: "dmarc-sp-inherit",
        category: "email",
        title: "DMARC subdomain-policy arves fra p=",
        status: "info",
        priority: 5,
        explain: "Ingen sp= er satt, så subdomener arver p=.",
        consequence: "Det er greit, men verdt å være bevisst på hvis dere har mange subdomener.",
        evidence: { record: clip(email.dmarc.record, 120), policy: "sp arves" },
      });
    }

    if (email.dmarc?.externalRuaVerified === false) {
      add({
        id: "dmarc-external-rua",
        category: "email",
        title: "Ekstern DMARC-rapportering mangler verifiseringsrecord",
        status: "fail",
        priority: 2,
        severity: "high",
        explain: "rua peker til et annet domene, men påkrevd external-destination-record mangler.",
        consequence: "Rapportene sendes aldri — en klassisk stille feil.",
        fix: "Be rapportmottakeren publisere v=DMARC1-record på <deres-domene>._report._dmarc.<rua-domene>, eller bruk en rua på eget domene.",
        effort: "0,5-1 time",
        evidence: { record: clip(email.dmarc.record, 120) },
      });
    }

    if (email.mtaSts) {
      emailScore += 4;
      add({
        id: "mta-sts",
        category: "email",
        title: "MTA-STS er aktivert",
        status: "ok",
        explain: "MTA-STS-policy er publisert for domenet.",
        evidence: { value: "MTA-STS present" },
      });
    }

    if (email.mxHealth?.unresolvedHosts?.length) {
      add({
        id: "mx-unresolved",
        category: "email",
        title: "MX peker til vert(er) som ikke resolver",
        status: "fail",
        priority: 1,
        severity: "critical",
        explain: `Følgende MX-verter har ingen A/AAAA-record: ${email.mxHealth.unresolvedHosts.join(", ")}.`,
        consequence: "E-post til domenet kan gå tapt.",
        fix: "Rett MX til gyldige vertsnavn med fungerende DNS, eller fjern døde MX-oppføringer.",
        effort: "0,5-1 time",
        evidence: { host: email.mxHealth.unresolvedHosts.join(", ") },
      });
    }

    if (email.mxHealth?.ipLiteralHosts?.length) {
      add({
        id: "mx-ip-literal",
        category: "email",
        title: "MX peker direkte på IP-adresse",
        status: "warn",
        priority: 2,
        severity: "high",
        explain: `MX inneholder IP direkte (${email.mxHealth.ipLiteralHosts.join(", ")}).`,
        consequence: "Det bryter RFC 2181 — MX skal peke på vertsnavn, ikke IP.",
        fix: "Opprett et vertsnavn med A/AAAA og la MX peke dit.",
        effort: "0,5 time",
        evidence: { ip: email.mxHealth.ipLiteralHosts.join(", ") },
      });
    }

    if (email.mxHealth?.starttls === true) {
      add({
        id: "mx-starttls",
        category: "email",
        title: "Primær MX støtter STARTTLS",
        status: "ok",
        explain: "Primær MX annonserer STARTTLS på port 25.",
        evidence: { protocol: "STARTTLS", status: "announced" },
      });
    } else if (email.mxHealth?.starttls === false) {
      add({
        id: "mx-starttls-missing",
        category: "email",
        title: "Primær MX mangler STARTTLS",
        status: "warn",
        priority: 3,
        severity: "medium",
        explain: "Tilkobling til port 25 lyktes, men serveren annonserte ikke STARTTLS.",
        consequence: "Kryptert innkommende e-post kan da mangle.",
        fix: "Aktiver STARTTLS på mailserveren, eller vurder MTA-STS.",
        effort: "1-2 timer",
        evidence: { protocol: "STARTTLS", status: "not_announced" },
      });
    }

    if (email.bimi?.present) {
      emailScore += 2;
      add({
        id: "bimi",
        category: "email",
        title: email.bimi.hasVmc ? "BIMI er aktivert med VMC" : "BIMI er aktivert",
        status: "ok",
        explain: email.bimi.hasVmc
          ? "BIMI med VMC er publisert."
          : "BIMI er publisert.",
        evidence: { record: clip(email.bimi.record, 100) || "BIMI present" },
      });
    }
  } else if (email.mxHealth?.missingMxWithAuth) {
    add({
      id: "mx-missing-with-auth",
      category: "email",
      title: "SPF/DMARC finnes, men ingen MX",
      status: "warn",
      priority: 2,
      severity: "high",
      explain: "Domenet har SPF og/eller DMARC, men ingen MX.",
      consequence: "Ofte glemt e-postoppsett — eller et send-only-domene som bør dokumenteres bevisst.",
      fix: "Enten sett opp MX for mottak, eller dokumenter at domenet er send-only og rydd SPF/DMARC deretter.",
      effort: "0,5-1 time",
      evidence: { mx: "ingen", record: clip(email.spf?.record || email.dmarc?.record, 100) },
    });
  }

  const spoofing = spoofingRisk(email);
  const spoofingLevelNo = { low: "Lav", medium: "Middels", high: "Høy", critical: "Kritisk" };
  add({
    id: "email-spoofing-risk",
    category: "email",
    title: `Risiko for e-postforfalskning: ${spoofingLevelNo[spoofing.level] || spoofing.level}`,
    status: spoofing.level === "low" ? "ok" : spoofing.level === "medium" ? "warn" : "fail",
    priority: spoofing.level === "critical" ? 1 : spoofing.level === "high" ? 2 : 4,
    severity: spoofing.level === "low" ? "ok" : spoofing.level,
    explain: spoofing.reason,
    consequence:
      spoofing.level === "low"
        ? undefined
        : "Lav e-postautentisering øker risikoen for at noen sender e-post i deres navn.",
    fix: spoofing.level === "low" ? null : "Stram inn SPF, aktiver DKIM og sett DMARC til quarantine/reject etter kontroll.",
    effort: spoofing.level === "low" ? null : "1-3 timer",
    evidence: { value: spoofing.reason, level: spoofing.level },
  });

  if (dnssec.enabled === true) {
    domainScore += 8;
    add({
      id: "dnssec",
      category: "domain",
      title: "DNSSEC er aktivert",
      status: "ok",
      explain: "Cloudflare DoH returnerte AD=true for domenet.",
      evidence: { ad: "true", dnssec: "enabled" },
    });
  } else if (dnssec.enabled === false) {
    add({
      id: "dnssec",
      category: "domain",
      title: "DNSSEC er ikke aktivert",
      status: "warn",
      priority: 3,
      explain: "Cloudflare DoH returnerte AD=false for domenet.",
      consequence: "DNS-svar kan ikke valideres kryptografisk mot enkelte typer manipulasjon.",
      fix: "Aktiver DNSSEC hos registrar eller DNS-leverandør.",
      effort: "0,5 time",
      evidence: { ad: "false", dnssec: "disabled" },
    });
  }

  if (rdap.found && rdap.daysToExpiry != null) {
    if (rdap.daysToExpiry > 30) {
      domainScore += 9;
      add({
        id: "expiry",
        category: "domain",
        title: `Domenet er gyldig til ${new Date(rdap.expires).toLocaleDateString("nb-NO")}`,
        status: "ok",
        explain: `${rdap.daysToExpiry} dager til fornyelse.`,
        evidence: { expires: new Date(rdap.expires).toLocaleDateString("nb-NO"), daysToExpiry: rdap.daysToExpiry },
      });
    } else {
      add({
        id: "expiry",
        category: "domain",
        title: `Domenet utløper om ${rdap.daysToExpiry} dager`,
        status: "fail",
        priority: 1,
        explain: `RDAP viser utløp om ${rdap.daysToExpiry} dager (${new Date(rdap.expires).toLocaleDateString("nb-NO")}).`,
        consequence: "Utløpt domene kan stoppe både nettside og e-post.",
        fix: "Forny domenet og aktiver automatisk fornyelse.",
        effort: "0,25 time",
        evidence: { expires: new Date(rdap.expires).toLocaleDateString("nb-NO"), daysToExpiry: rdap.daysToExpiry },
      });
    }
  } else domainScore += 5;
  domainScore += 3;

  if (subdomains.length) {
    const hosts = subdomains.map((item) => item.host).filter(Boolean);
    const hostList = hosts.slice(0, 12).join(", ") + (hosts.length > 12 ? " …" : "");
    add({
      id: "subdomains-discovered",
      category: "domain",
      title:
        hosts.length === 1
          ? "Ett subdomene er synlig i DNS"
          : `${hosts.length} subdomener er synlige i DNS`,
      status: "info",
      priority: 5,
      explain: hostList || "Subdomener ble oppdaget passivt.",
      consequence:
        "Hvert subdomene som peker på en aktiv tjeneste er en inngang som må vedlikeholdes. Gamle test- og staging-servere blir sjelden oppdatert, og er et vanlig utgangspunkt for angrep.",
      fix: "Gå gjennom eksponerte subdomener og fjern gamle test/staging-tjenester fra DNS.",
      effort: "1-2 timer",
      evidence: { host: hosts.slice(0, 8).join(", ") },
    });
  } else {
    add({
      id: "subdomains-discovered",
      category: "domain",
      title: "Ingen vanlige subdomener synlige i DNS",
      status: "ok",
      explain: "Begrenset passiv DNS-sjekk fant ingen vanlige subdomener.",
      evidence: { value: "ingen treff" },
    });
  }

  // Exposed backend / missing RLS (only when check actually ran)
  if (exposedBackend?.ran) {
    const serviceLeaks = (exposedBackend.supabase || []).filter((s) => s.serviceRoleLeaked);
    for (const leak of serviceLeaks) {
      webScore = Math.max(0, webScore - 25);
      add({
        id: "supabase-service-role-leaked",
        category: "web",
        title: "Supabase service-nøkkel ligger i nettleseren",
        status: "fail",
        priority: 1,
        severity: "critical",
        explain:
          "Vi fant en Supabase JWT med role «service_role» i offentlig JavaScript.",
        consequence:
          "Service-nøkkelen omgår Row Level Security fullstendig og gir full databasetilgang. Dette er en katastrofal lekkasje.",
        fix: "Roter service_role-nøkkelen umiddelbart i Supabase Dashboard, fjern den fra all frontend-kode, og bruk kun anon-nøkkelen i nettleseren med RLS aktivert.",
        effort: "1–2 timer (pluss rotasjon hos alle steder nøkkelen er brukt)",
        evidence: { value: `role=service_role${leak.ref ? ` · ref=${leak.ref}` : ""}` },
      });
    }

    const exposedTables = [];
    for (const project of exposedBackend.rls || []) {
      for (const table of project.exposedTables || []) {
        exposedTables.push({ table, ref: project.ref, url: project.url });
      }
    }

    if (exposedTables.length) {
      const first = exposedTables[0];
      const extra =
        exposedTables.length > 1
          ? ` Vi så tilsvarende åpen tilgang på flere tabeller (${exposedTables
              .slice(0, 5)
              .map((t) => `«${t.table}»`)
              .join(", ")}${exposedTables.length > 5 ? " …" : ""}).`
          : "";
      webScore = Math.max(0, webScore - 20);
      add({
        id: "supabase-rls-open",
        category: "web",
        title: "Databasen er åpen for hvem som helst",
        status: "fail",
        priority: 1,
        severity: "critical",
        explain: `Supabase anon-nøkkel er synlig i frontend. Leseforsøk mot «${first.table}» returnerte data (limit=1).${extra}`,
        consequence:
          "Uten Row Level Security kan hvem som helst som åpner nettsiden hente ut tabellinnhold direkte. Ingen data ble lastet ned eller endret av oss utover bekreftelsen.",
        fix: "Slå på Row Level Security på alle tabeller og definer policies for hvem som får lese hva.",
        effort: "2–4 timer",
        evidence: {
          value: `tabell=${first.table}${first.ref ? ` · ref=${first.ref}` : ""} · read_limit_1`,
        },
      });
    } else if (
      (exposedBackend.supabase || []).some((s) => s.role === "anon" && s.key) &&
      !serviceLeaks.length
    ) {
      const protectedOk = (exposedBackend.rls || []).some((p) =>
        (p.tables || []).some((t) => t.status === "protected" || t.status === "empty_or_blocked")
      );
      if (protectedOk || (exposedBackend.rls || []).length) {
        webScore += 4;
        add({
          id: "supabase-anon-rls",
          category: "web",
          title: "Supabase anon-nøkkel funnet — RLS ser ut til å begrense lesing",
          status: "ok",
          explain:
            "Nettsiden eksponerer en Supabase anon-nøkkel (forventet i mange SPA-er). Leseforsøk mot vanlige tabellnavn ble avvist eller returnerte ingen rader — det tyder på at Row Level Security er på plass, eller at tabellene er tomme/utilgjengelige.",
        });
      } else {
        add({
          id: "supabase-anon-key",
          category: "web",
          title: "Supabase anon-nøkkel synlig i frontend",
          status: "info",
          priority: 5,
          severity: "low",
          explain:
            "Vi fant en Supabase anon-nøkkel i offentlig JavaScript. Det er normalt for klientapper, men krever at Row Level Security er aktivert på alle tabeller.",
          fix: "Verifiser at RLS er påslått og at policies kun tillater det brukeren skal se.",
          effort: "1–2 timer",
        });
      }
    }

    if ((exposedBackend.firebase || []).length) {
      add({
        id: "firebase-apikey",
        category: "web",
        title: "Firebase API-nøkkel synlig i frontend",
        status: "info",
        priority: 5,
        severity: "low",
        explain:
          "Firebase apiKey i nettleseren er vanlig, men sikkerheten ligger i Firebase Security Rules — ikke i å skjule nøkkelen.",
        fix: "Gjennomgå Firebase Security Rules for Auth, Firestore og Storage.",
        effort: "1–3 timer",
      });
    }

    if ((exposedBackend.stripe || []).length) {
      add({
        id: "stripe-pk-live",
        category: "web",
        title: "Stripe live publishable key i frontend",
        status: "info",
        priority: 5,
        severity: "low",
        explain:
          "pk_live_… er ment for nettleseren. Hemmelige nøkler (sk_live_) skal aldri ligge i frontend. Sørg for at beløp og priser alltid valideres server-side.",
        fix: "Bekreft at ingen secret keys er bundlet, og at Checkout/PaymentIntent opprettes på server.",
        effort: "0,5–1 time",
      });
    }

    if ((exposedBackend.airtable || []).length) {
      add({
        id: "airtable-key",
        category: "web",
        title: "Mulig Airtable API-nøkkel i frontend",
        status: "warn",
        priority: 2,
        severity: "high",
        explain:
          "En streng som matcher Airtable API-nøkkelmønster ble funnet i offentlig JavaScript. API-nøkler for Airtable skal ikke eksponeres i nettleseren.",
        fix: "Flytt Airtable-kall til en server-side API, roter nøkkelen, og begrens tilgang.",
        effort: "1–2 timer",
      });
    }
  }

  webScore = Math.min(webScore, 40);
  emailScore = Math.min(emailScore, 40);
  domainScore = Math.min(domainScore, 20);
  const score = Math.round(webScore + emailScore + domainScore);
  const actions = findings
    .filter((finding) => finding.fix && finding.severity !== "ok" && finding.status !== "ok")
    .sort(
      (a, b) =>
        ({ critical: 0, high: 1, medium: 2, low: 3, ok: 4 }[a.severity] -
          { critical: 0, high: 1, medium: 2, low: 3, ok: 4 }[b.severity]) ||
        (a.priority || 9) - (b.priority || 9)
    );

  return { domain, scannedAt: new Date().toISOString(), score, grade: score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "E", categories: { web: { score: webScore, max: 40 }, email: { score: emailScore, max: 40 }, domain: { score: domainScore, max: 20 } }, spoofingRisk: spoofing, subdomains, findings, actions, summary: score >= 75 ? "Grunnsikringen ser god ut. Se tiltakene for videre herdning." : score >= 50 ? "Flere viktige kontroller er på plass, men noen punkter bør rettes." : "Domenet har flere sikkerhetsmangler som bør håndteres raskt." };
}
