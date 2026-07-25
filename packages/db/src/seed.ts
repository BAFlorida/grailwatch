/**
 * Seed the database: scoring config, starter card universe, watchlists, and
 * the synthetic snapshot CSVs. Idempotent — safe to re-run.
 */
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { createLogger } from "@grailwatch/shared/logger";
import { CONFIG_KEY_SCORING, DEFAULT_SCORING_CONFIG } from "@grailwatch/shared/scoring";
import { closeDb, db } from "./client";
import { appConfig, cards, watchlistCards, watchlists } from "./schema";
import { mapAttentionCsv, mapMarketCsv, mapPopCsv } from "./csv-import";
import { SEED_CARDS } from "./seed-universe";
import {
  upsertAttentionSnapshots,
  upsertMarketSnapshots,
  upsertPopSnapshots,
} from "./upserts";

const log = createLogger("seed");
const seedDataDir = path.join(import.meta.dirname, "..", "seed-data");

async function main(): Promise<void> {
  // 1. scoring config (defaults only if absent — never clobber UI edits)
  await db
    .insert(appConfig)
    .values({ key: CONFIG_KEY_SCORING, value: DEFAULT_SCORING_CONFIG })
    .onConflictDoNothing();
  log.info("scoring config ensured");

  // 2. cards (matched by exact name)
  const idByName = new Map<string, number>();
  let created = 0;
  for (const c of SEED_CARDS) {
    const existing = await db
      .select({ id: cards.id })
      .from(cards)
      .where(eq(cards.name, c.name))
      .limit(1);
    if (existing[0]) {
      idByName.set(c.name, existing[0].id);
      continue;
    }
    const inserted = await db
      .insert(cards)
      .values({
        name: c.name,
        franchise: c.franchise,
        setName: c.setName ?? null,
        cardNumber: c.cardNumber ?? null,
        language: c.language ?? null,
        category: c.category,
        notes: c.notes ?? null,
      })
      .returning({ id: cards.id });
    idByName.set(c.name, inserted[0]!.id);
    created++;
  }
  log.info(`cards ready: ${idByName.size} (${created} created)`);

  // 3. watchlists (membership replaced on each seed run)
  const lists: { label: string; names: string[] }[] = [
    { label: "Starter Grails", names: SEED_CARDS.map((c) => c.name) },
    {
      label: "Manga First Prints",
      names: SEED_CARDS.filter((c) => c.franchise === "manga").map((c) => c.name),
    },
    {
      label: "CoroCoro & Early Promos",
      names: SEED_CARDS.filter((c) => c.franchise === "pokemon").map((c) => c.name),
    },
  ];
  for (const l of lists) {
    let wl = (
      await db.select().from(watchlists).where(eq(watchlists.label, l.label)).limit(1)
    )[0];
    wl ??= (await db.insert(watchlists).values({ label: l.label }).returning())[0]!;
    await db.delete(watchlistCards).where(eq(watchlistCards.watchlistId, wl.id));
    const memberIds = l.names
      .map((n) => idByName.get(n))
      .filter((v): v is number => v !== undefined);
    if (memberIds.length > 0) {
      await db
        .insert(watchlistCards)
        .values(memberIds.map((cardId) => ({ watchlistId: wl.id, cardId })))
        .onConflictDoNothing();
    }
  }
  log.info(`watchlists ready: ${lists.map((l) => l.label).join(", ")}`);

  // 4. snapshot CSVs
  const readCsv = (f: string): string => fs.readFileSync(path.join(seedDataDir, f), "utf8");

  const market = mapMarketCsv(readCsv("market.csv"), idByName);
  await upsertMarketSnapshots(market.rows);
  log.info(`market snapshots upserted: ${market.rows.length} (skipped ${market.skipped})`);

  const pop = mapPopCsv(readCsv("pop.csv"), idByName);
  await upsertPopSnapshots(pop.rows);
  log.info(`pop snapshots upserted: ${pop.rows.length} (skipped ${pop.skipped})`);

  const attention = mapAttentionCsv(readCsv("attention.csv"), idByName);
  await upsertAttentionSnapshots(attention.rows);
  log.info(`attention snapshots upserted: ${attention.rows.length} (skipped ${attention.skipped})`);

  for (const r of [market, pop, attention]) {
    if (r.unknownNames.length > 0) log.warn(`unknown card names skipped: ${r.unknownNames.join("; ")}`);
  }

  log.info("seed complete. Start the app with `pnpm run dev` — signal scores");
  log.info("are computed automatically on API boot (or run `pnpm run job:score`).");
}

main()
  .catch((err) => {
    log.error("seed failed", err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
