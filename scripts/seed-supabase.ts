/**
 * scripts/seed-supabase.ts
 * ─────────────────────────
 * Idempotent Supabase seeder. Run with:
 *   npx tsx scripts/seed-supabase.ts
 *
 * Reads credentials from .env (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).
 * Reads business data from tenant.config.ts.
 *
 * What it does:
 *  1. Creates tables (services, working_hours, blocked_dates, bookings, settings)
 *     if they don't already exist via the schema migration.
 *  2. Upserts all services from config.services.
 *  3. Upserts working_hours from config.hours.
 *  4. Upserts the settings row (id=1) with sensible defaults.
 *
 * Safe to run multiple times — all operations are upserts or idempotent DDL.
 */

import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import config from "../tenant.config.js";

// Load .env from project root
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "\n[seed] ERROR: Missing env vars.\n" +
    "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file.\n" +
    "(These are server-side only — NOT VITE_ prefixed — and must be the SERVICE ROLE key, not anon.)\n"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ─── Schema migration ────────────────────────────────────────────────────────

const MIGRATION_SQL = `
-- services
CREATE TABLE IF NOT EXISTS services (
  id              integer PRIMARY KEY,
  name            text NOT NULL,
  description     text NOT NULL DEFAULT '',
  duration_minutes integer NOT NULL,
  price           numeric NOT NULL,
  deposit_percent integer NOT NULL DEFAULT 50,
  image_url       text DEFAULT '',
  active          boolean NOT NULL DEFAULT true,
  sort_order      integer NOT NULL DEFAULT 0,
  category        text DEFAULT ''
);

-- working_hours (day_of_week: 0=Sun … 6=Sat)
CREATE TABLE IF NOT EXISTS working_hours (
  id          integer PRIMARY KEY,
  day_of_week integer NOT NULL,
  enabled     boolean NOT NULL DEFAULT true,
  start_time  text NOT NULL DEFAULT '09:00',
  end_time    text NOT NULL DEFAULT '18:00'
);

-- blocked_dates
CREATE TABLE IF NOT EXISTS blocked_dates (
  id          integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  date        text NOT NULL,
  start_time  text,
  end_time    text,
  reason      text DEFAULT ''
);

-- bookings
CREATE TABLE IF NOT EXISTS bookings (
  id                integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  service_id        integer NOT NULL,
  customer_name     text NOT NULL,
  customer_email    text NOT NULL,
  customer_phone    text NOT NULL,
  notes             text DEFAULT '',
  date              text NOT NULL,
  start_time        text NOT NULL,
  end_time          text NOT NULL,
  total_amount      numeric NOT NULL,
  deposit_amount    numeric NOT NULL,
  status            text NOT NULL DEFAULT 'pending',
  payment_intent_id text,
  reference         text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- settings (single-row config, id always = 1)
CREATE TABLE IF NOT EXISTS settings (
  id                  integer PRIMARY KEY DEFAULT 1,
  studio_name         text NOT NULL DEFAULT 'Studio',
  accepting_bookings  boolean NOT NULL DEFAULT true,
  buffer_minutes      integer NOT NULL DEFAULT 15,
  lead_time_hours     integer NOT NULL DEFAULT 24,
  max_advance_days    integer NOT NULL DEFAULT 60,
  notify_email        text NOT NULL DEFAULT '',
  calendar_connected  boolean NOT NULL DEFAULT false,
  push_enabled        boolean NOT NULL DEFAULT false,
  stripe_mode         text NOT NULL DEFAULT 'test'
);
`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(msg: string) {
  process.stdout.write(`[seed] ${msg}\n`);
}

function fail(msg: string, err?: unknown) {
  process.stderr.write(`[seed] ERROR: ${msg}\n`);
  if (err) process.stderr.write(`       ${String(err)}\n`);
  process.exit(1);
}

// ─── Run migration ────────────────────────────────────────────────────────────

async function runMigration() {
  log("Running schema migration via rpc exec_sql…");
  // Supabase doesn't expose raw DDL over the JS client for security reasons.
  // We use the pg rpc workaround if available, otherwise skip and rely on
  // tables already existing (common in real projects where migrations run
  // via the Supabase dashboard or CLI).
  //
  // If your project uses supabase CLI, run:
  //   supabase db push
  // and skip this step.
  const statements = MIGRATION_SQL
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const sql of statements) {
    const { error } = await supabase.rpc("exec_sql", { sql: sql + ";" });
    if (error) {
      // exec_sql rpc may not exist — this is OK if tables already exist.
      // Log a warning and continue.
      log(`  ⚠ exec_sql not available or failed: ${error.message}`);
      log("  → Ensure tables exist via Supabase dashboard or supabase CLI before seeding.");
      break;
    }
  }
  log("  Schema migration complete (or tables already exist).");
}

// ─── Seed services ────────────────────────────────────────────────────────────

async function seedServices() {
  log(`Seeding ${config.services.length} services…`);
  for (const svc of config.services) {
    const row = {
      id:               svc.id,
      name:             svc.name,
      description:      svc.description,
      duration_minutes: svc.durationMinutes,
      price:            svc.price,
      deposit_percent:  svc.depositPercent,
      image_url:        svc.imageUrl,
      active:           svc.active,
      sort_order:       svc.sortOrder,
      category:         svc.category,
    };
    const { error } = await supabase
      .from("services")
      .upsert(row, { onConflict: "id" });
    if (error) fail(`Failed to upsert service "${svc.name}": ${error.message}`);
    log(`  ✓ ${svc.name}`);
  }
}

// ─── Seed working hours ───────────────────────────────────────────────────────

async function seedWorkingHours() {
  log("Seeding working hours (7 rows, id = day_of_week + 1)…");
  for (let day = 0; day <= 6; day++) {
    const v = config.hours[day] ?? { enabled: false };
    const row = {
      id:          day + 1,  // stable PK: 1=Sun, 2=Mon, … 7=Sat
      day_of_week: day,
      enabled:     v.enabled,
      start_time:  v.start ?? "09:00",
      end_time:    v.end ?? "18:00",
    };
    const { error } = await supabase
      .from("working_hours")
      .upsert(row, { onConflict: "id" });
    if (error) fail(`Failed to upsert working_hours day ${day}: ${error.message}`);
    const dayName = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][day];
    log(`  ✓ ${dayName}: ${v.enabled ? (v.note ?? `${v.start}–${v.end}`) : "closed"}`);
  }
}

// ─── Seed settings ────────────────────────────────────────────────────────────

async function seedSettings() {
  log("Seeding settings row (id=1)…");
  const row = {
    id:                 1,
    studio_name:        config.brand.name,
    accepting_bookings: true,
    buffer_minutes:     15,
    lead_time_hours:    24,
    max_advance_days:   60,
    notify_email:       config.business.email,
    calendar_connected: false,
    push_enabled:       false,
    stripe_mode:        config.payments.mode === "stripe" ? "live" : "test",
  };
  const { error } = await supabase
    .from("settings")
    .upsert(row, { onConflict: "id" });
  if (error) fail(`Failed to upsert settings: ${error.message}`);
  log("  ✓ Settings upserted.");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log(`Starting seed for "${config.brand.name}" → ${SUPABASE_URL}`);
  log("─".repeat(60));

  await runMigration();
  await seedServices();
  await seedWorkingHours();
  await seedSettings();

  log("─".repeat(60));
  log("Seed complete. Run again at any time — all operations are idempotent.");
}

main().catch((err) => {
  fail("Unexpected error", err);
});
