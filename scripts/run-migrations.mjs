/**
 * run-migrations.mjs
 * Runs all Supabase migrations via the Management API.
 * Usage: node scripts/run-migrations.mjs --token <your-supabase-pat>
 *
 * Get your Personal Access Token at: https://supabase.com/dashboard/account/tokens
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Read .env.local ─────────────────────────────────────────────────────────
const envPath = path.join(__dirname, "..", ".env.local");
const envLines = fs.readFileSync(envPath, "utf8").split("\n");
const env = {};
for (const line of envLines) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const SUPABASE_URL = env["NEXT_PUBLIC_SUPABASE_URL"];
if (!SUPABASE_URL || SUPABASE_URL.includes("PASTE")) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL is not set in .env.local");
  process.exit(1);
}

// Extract project ref from URL: https://<ref>.supabase.co
const refMatch = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/);
if (!refMatch) {
  console.error("❌ Could not parse project ref from NEXT_PUBLIC_SUPABASE_URL");
  process.exit(1);
}
const PROJECT_REF = refMatch[1];
console.log(`✅ Project ref: ${PROJECT_REF}`);

// ── Get Personal Access Token ────────────────────────────────────────────────
const args = process.argv.slice(2);
const tokenIdx = args.indexOf("--token");
const PAT = tokenIdx >= 0 ? args[tokenIdx + 1] : process.env.SUPABASE_ACCESS_TOKEN;

if (!PAT) {
  console.error(`
❌ Missing Supabase Personal Access Token.

Run with:
  node scripts/run-migrations.mjs --token <your-token>

Get your token at:
  https://supabase.com/dashboard/account/tokens
  (Click "Generate new token", name it "RFX_AI migration")
`);
  process.exit(1);
}

// ── Find migration files ─────────────────────────────────────────────────────
const migrationsDir = path.join(__dirname, "..", "supabase", "migrations");
const files = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

console.log(`\n📂 Found ${files.length} migration files`);

// ── Run each migration ───────────────────────────────────────────────────────
for (const file of files) {
  const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
  process.stdout.write(`  ⏳ Running ${file}... `);

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAT}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    console.log(`❌ FAILED (HTTP ${res.status})`);
    console.error(`   ${body}`);
    process.exit(1);
  }

  const data = await res.json().catch(() => null);
  // Some DDL responses return empty array — that's fine
  console.log("✅ done");
}

console.log("\n🎉 All migrations applied successfully!");
console.log(`\nNext steps:`);
console.log(`  1. Create storage bucket 'offer-documents' at:`);
console.log(`     https://supabase.com/dashboard/project/${PROJECT_REF}/storage/buckets`);
console.log(`     (Create bucket → name: offer-documents → Private)`);
console.log(`  2. npm run dev — app is now fully connected\n`);
