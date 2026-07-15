import { NextResponse } from "next/server";
import { requireAdmin, adminErrorResponse } from "@/lib/auth/requireAdmin";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function maskUrl(rawUrl) {
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl);
    return { host: url.hostname, projectRef: url.hostname.split(".")[0] || null };
  } catch {
    return { host: "invalid", projectRef: null };
  }
}

function boolEnv(name) {
  return Boolean(process.env[name]);
}

export async function GET() {
  const auth = await requireAdmin({ minRole: "admin" });
  if (!auth.ok) return adminErrorResponse(auth);

  const [profilesResult, auditResult] = hasSupabaseAdminConfig
    ? await Promise.all([
        supabaseAdmin.from("admin_profiles").select("id,email,name,role,is_active,created_at,updated_at").order("created_at", { ascending: false }),
        supabaseAdmin.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(20)
      ])
    : [{ data: [], error: null }, { data: [], error: null }];

  if (profilesResult.error) {
    console.error("admin profiles read failed:", profilesResult.error);
    return NextResponse.json({ error: "Kunne ikke hente adminbrukere." }, { status: 500 });
  }

  if (auditResult.error) {
    console.error("admin audit read failed:", auditResult.error);
  }

  return NextResponse.json({
    currentUser: auth.admin,
    profiles: profilesResult.data || [],
    audit: auditResult.data || [],
    company: {
      name: "Hansen IT",
      orgNumber: "",
      email: "post@hansen-it.com",
      phone: "",
      website: "https://hansen-it.com",
      logoPath: "/brand/hansen-it/logo/logo-horizontal-dark.svg",
      tagline: "Infrastruktur · Nettverk · Support · Cybersikkerhet",
      colors: {
        marine: "#152149",
        marineDeep: "#1B2A52",
        blue: "#1D6FE0",
        blueLight: "#3FA1FF"
      }
    },
    portal: {
      defaultTokenDays: 30,
      welcomeText: "Her kan du lese tilbudet, laste ned dokumenter, stille spørsmål og godkjenne eller be om endringer.",
      showTechnicalAttachmentsByDefault: false,
      defaultVisibleDocumentTypes: ["quote_pdf", "scan_combined_pdf"]
    },
    quote: {
      defaultValidityDays: 30,
      defaultVatRate: 25,
      paymentTerms: "14 dager netto",
      quoteNumberPrefix: "HIT"
    },
    scan: {
      scannerMode: process.env.SCANNER_MODE || "passive",
      activeScanEnabled: process.env.SCANNER_ALLOW_ACTIVE_SCAN === "true",
      egressIp: process.env.SCANNER_EGRESS_IP || "185.243.217.163",
      egressType: process.env.SCANNER_EGRESS_TYPE || "shared_proxmox_nat",
      scannerNodeName: process.env.SCANNER_NODE_NAME || "phoenix-scan01",
      allowedScanTypes: ["passive"],
      defaultReportLanguage: "nb-NO",
      defaultReportVisibility: "admin_only"
    },
    integrations: {
      supabaseConfigured: hasSupabaseAdminConfig,
      supabase: maskUrl(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL),
      serviceRolePresent: boolEnv("SUPABASE_SERVICE_ROLE_KEY"),
      n8nWebhookConfigured: boolEnv("N8N_CONTACT_WEBHOOK_URL") || boolEnv("N8N_WEBHOOK_URL"),
      slackWebhookConfigured: boolEnv("SLACK_WEBHOOK_URL"),
      resendConfigured: boolEnv("RESEND_API_KEY")
    },
    system: {
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV || null,
      gitBranch: process.env.VERCEL_GIT_COMMIT_REF || "local",
      appVersion: process.env.npm_package_version || null
    }
  });
}
