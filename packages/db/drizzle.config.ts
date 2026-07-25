import { config as dotenv } from "dotenv";
import { defineConfig } from "drizzle-kit";

// drizzle-kit bundles this config standalone, so keep it free of workspace
// imports. Load the package-local .env first (no-op if absent), then the
// repo root one.
dotenv();
dotenv({ path: "../../.env" });

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/grailwatch",
  },
});
