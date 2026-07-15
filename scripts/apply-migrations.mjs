/**
 * Kjør ventende SQL-migrasjoner og registrer dem i public.schema_migrations.
 *
 * Krever DATABASE_URL (Session pooler connection string fra Supabase → Settings → Database).
 * Alternativt: SUPABASE_DB_URL.
 *
 * Flagg:
 *   --dry-run   Vis hva som ville blitt kjørt, uten å endre databasen.
 *
 * Kjør: npm run migrate:apply
 *       npm run migrate:apply -- --dry-run
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

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
      const fullPath = path.join(MIGRATIONS_DIR, filename);
      return { version, filename, fullPath };
    });
}

async function main() {
  loadEnvFile();
  const dryRun = process.argv.includes("--dry-run");
  const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || "";

  if (!databaseUrl) {
    console.error("Mangler DATABASE_URL (eller SUPABASE_DB_URL).");
    console.error("Finn den i Supabase → Settings → Database → Connection string (Session pooler).");
    console.error("Legg den i .env som DATABASE_URL=postgresql://...");
    process.exit(1);
  }

  const sql = postgres(databaseUrl, { max: 1, idle_timeout: 5, connect_timeout: 15 });
  const migrations = listMigrationFiles();

  try {
    // Sørg for at sporingstabellen finnes (idempotent).
    if (!dryRun) {
      await sql`
        create table if not exists public.schema_migrations (
          version text primary key,
          applied_at timestamptz not null default now(),
          applied_by text default current_user
        )
      `;
      await sql`alter table public.schema_migrations enable row level security`;
    }

    const appliedRows = await sql`select version from public.schema_migrations`;
    const applied = new Set(appliedRows.map((row) => row.version));
    const pending = migrations.filter((entry) => !applied.has(entry.version));

    if (!pending.length) {
      console.log("Ingen ventende migrasjoner — alt er registrert.");
      return;
    }

    console.log(dryRun ? "Dry-run — ville kjørt:" : "Kjører ventende migrasjoner:");
    for (const entry of pending) {
      console.log(`  - ${entry.filename}`);
    }
    console.log("");

    if (dryRun) {
      console.log(`Totalt ${pending.length} fil(er). Ingen endringer gjort.`);
      return;
    }

    for (const entry of pending) {
      const body = fs.readFileSync(entry.fullPath, "utf8");
      console.log(`→ Kjører ${entry.filename} ...`);
      try {
        await sql.begin(async (tx) => {
          await tx.unsafe(body);
          await tx`
            insert into public.schema_migrations (version)
            values (${entry.version})
            on conflict (version) do nothing
          `;
        });
        console.log(`  ✅ ${entry.version} registrert`);
      } catch (err) {
        console.error("");
        console.error(`FEILET på ${entry.filename}`);
        console.error(`  ${err?.message || err}`);
        console.error("");
        console.error("Ingen senere migrasjoner ble kjørt. Fiks feilen og kjør på nytt.");
        process.exit(1);
      }
    }

    console.log("");
    console.log(`Ferdig. ${pending.length} migrasjon(er) anvendt.`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
