import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { env } from "@grailwatch/shared/env";
import * as schema from "./schema";

const { Pool } = pg;

export const pool = new Pool({ connectionString: env.DATABASE_URL, max: 10 });

export const db = drizzle(pool, { schema });

export type Db = typeof db;

export async function closeDb(): Promise<void> {
  await pool.end();
}
