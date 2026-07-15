/**
 * Sjekk hvilke migrasjoner som er registrert i public.schema_migrations.
 *
 * Krever: SUPABASE_URL (eller NEXT_PUBLIC_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY
 *
 * Exit 1 hvis noen filer mangler i schema_migrations.
 * I CI uten secrets: hopper over med exit 0 (se .github/workflows/ci.yml).
 *
 * Kjør: npm run migrate:check
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MIGRATIONS_DIR = path.join(ROOT, "supabase", "migrations");

function loadEnvFile() {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function listMigrationFiles() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((filename) => {
      const version = filename.split("_")[0];
      return { version, filename };
    });
}

function pad(text, width) {
  const value = String(text ?? "");
  return value.length >= width ? value : value + " ".repeat(width - value.length);
}

async function main() {
  loadEnvFile();

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!url || !key) {
    if (process.env.CI) {
      console.log("Hopper over migrate:check — mangler SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY i CI.");
      process.exit(0);
    }
    console.error("Mangler SUPABASE_URL (eller NEXT_PUBLIC_SUPABASE_URL) og SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const migrations = listMigrationFiles();
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data, error } = await supabase.from("schema_migrations").select("version");
  if (error) {
    console.error("Kunne ikke lese public.schema_migrations:");
    console.error(`  ${error.message}`);
    console.error("");
    console.error("Har du kjørt 00000000000000_migration_tracking.sql?");
    process.exit(1);
  }

  const applied = new Set((data || []).map((row) => row.version));
  const missing = [];

  console.log("");
  console.log(`${pad("Versjon", 16)} | ${pad("Filnavn", 56)} | Status`);
  console.log("-".repeat(16) + "-+-" + "-".repeat(56) + "-+-" + "-".repeat(14));

  for (const entry of migrations) {
    const ok = applied.has(entry.version);
    const status = ok ? "✅ kjørt" : "❌ ikke kjørt";
    if (!ok) missing.push(entry);
    console.log(`${pad(entry.version, 16)} | ${pad(entry.filename, 56)} | ${status}`);
  }

  console.log("");
  console.log(`Totalt: ${migrations.length} filer · kjørt: ${migrations.length - missing.length} · mangler: ${missing.length}`);

  if (missing.length) {
    console.log("");
    console.log("Manglende migrasjoner:");
    for (const entry of missing) {
      console.log(`  - ${entry.filename}`);
    }
    console.log("");
    console.log("Kjør: npm run migrate:apply   (eller --dry-run først)");
    process.exit(1);
  }

  console.log("Alle migrasjonsfiler er registrert som kjørt.");
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
