import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

/**
 * Load the nearest .env walking up from cwd — pnpm --filter runs scripts from
 * package directories, so the repo-root .env must be found by ascent.
 */
function loadDotenv(): void {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, ".env");
    if (fs.existsSync(candidate)) {
      dotenv.config({ path: candidate });
      return;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return;
    dir = parent;
  }
}
loadDotenv();

const boolish = (def: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined ? def : ["1", "true", "yes", "on"].includes(v.toLowerCase())));

/** Optional secret-ish keys: blank counts as absent. */
const optionalKey = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v.trim() : undefined));

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  DATABASE_URL: z.string().min(1).default("postgres://postgres:postgres@localhost:5432/grailwatch"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_BASE_URL: z.string().min(1).default("http://localhost:5173"),

  ENABLE_CRON: boolish(true),
  ENABLE_BOOTSTRAP_SCORE: boolish(true),
  CRON_INGEST: z.string().default("0 2 * * *"),
  CRON_SCORE: z.string().default("45 2 * * *"),
  CRON_DELIVER: z.string().default("0 3 * * *"),

  PRICECHARTING_API_KEY: optionalKey,
  EBAY_APP_ID: optionalKey,
  EBAY_CERT_ID: optionalKey,
  EBAY_ENV: z.enum(["production", "sandbox"]).default("production"),

  ENABLE_GOOGLE_TRENDS: boolish(true),
  GOOGLE_TRENDS_GEO: z.string().default(""),

  SCRAPER_CONTACT: z.string().default(""),
  CACHE_DIR: z.string().default(".cache"),

  DISCORD_WEBHOOK_URL: optionalKey,
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Env = z.infer<typeof envSchema>;

// Blank strings (e.g. `API_PORT=` from a copied .env.example) fall back to defaults.
const cleaned = Object.fromEntries(
  Object.entries(process.env).filter(([, v]) => v !== undefined && v !== ""),
);
// Secret-ish keys keep blank-string handling in their own transform.
for (const key of ["PRICECHARTING_API_KEY", "EBAY_APP_ID", "EBAY_CERT_ID", "DISCORD_WEBHOOK_URL"]) {
  if (process.env[key] !== undefined) cleaned[key] = process.env[key];
}

const parsed = envSchema.safeParse(cleaned);
if (!parsed.success) {
  console.error("Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env: Env = parsed.data;
