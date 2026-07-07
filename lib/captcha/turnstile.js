const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const USER_UNAVAILABLE_MESSAGE = "Kontaktskjema er midlertidig utilgjengelig. Kontakt Hansen IT direkte.";
const USER_FAILED_MESSAGE = "Kunne ikke bekrefte at skjemaet ble sendt av en ekte bruker. Prøv igjen.";

function isTruthy(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());
}

export function getClientIp(request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    ""
  );
}

export function shouldRequireCaptcha() {
  return process.env.NODE_ENV === "production" || isTruthy(process.env.CAPTCHA_REQUIRED);
}

function canBypassCaptcha(required) {
  if (process.env.NODE_ENV === "production") {
    return isTruthy(process.env.CAPTCHA_BYPASS_FOR_PRODUCTION);
  }

  return !required || isTruthy(process.env.CAPTCHA_BYPASS_FOR_PREVIEW);
}

export async function verifyTurnstileToken(token, { ip } = {}) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  const required = shouldRequireCaptcha();

  if (!secret) {
    if (canBypassCaptcha(required)) {
      console.warn("Captcha bypass active for preview/dev");
      return { ok: true, bypassed: true };
    }

    console.error("Turnstile secret missing while captcha is required");
    return { ok: false, status: 503, message: USER_UNAVAILABLE_MESSAGE };
  }

  if (!token) {
    if (canBypassCaptcha(required)) {
      console.warn("Captcha bypass active for preview/dev");
      return { ok: true, bypassed: true };
    }

    return { ok: false, status: 400, message: USER_FAILED_MESSAGE };
  }

  try {
    const response = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret,
        response: token,
        ...(ip ? { remoteip: ip } : {})
      })
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.success) {
      console.warn("Turnstile verification failed", {
        status: response.status,
        errors: result["error-codes"] || []
      });
      return { ok: false, status: 400, message: USER_FAILED_MESSAGE };
    }

    return { ok: true, challengeTs: result.challenge_ts, hostname: result.hostname };
  } catch (error) {
    console.error("Turnstile verification error:", error);
    return { ok: false, status: 503, message: USER_UNAVAILABLE_MESSAGE };
  }
}
