import { createLogger } from "@grailwatch/shared/logger";
import {
  cards as cardsTable,
  db,
  upsertAttentionSnapshots,
  upsertMarketSnapshots,
  upsertPopSnapshots,
} from "@grailwatch/db";
import { buildRegistry } from "./registry";
import { errorMessage, type IngestSummary, type SourceRunResult } from "./types";

const log = createLogger("ingest");

/**
 * The nightly ingest: run every registered source over every card. Disabled
 * sources are logged and skipped; a source that throws is recorded as an
 * error and the run continues. All writes are idempotent upserts.
 */
export async function runIngest(sinceDays = 90): Promise<IngestSummary> {
  const startedAt = new Date().toISOString();
  const allCards = await db.select().from(cardsTable);
  const since = new Date(Date.now() - sinceDays * 86_400_000);
  const registry = buildRegistry();
  const results: SourceRunResult[] = [];

  log.info(`starting ingest for ${allCards.length} cards (since ${since.toISOString().slice(0, 10)})`);

  for (const source of registry.market) {
    const reason = source.disabled();
    if (reason) {
      log.warn(`market source "${source.name}" skipped: ${reason}`);
      results.push({ source: source.name, kind: "market", status: "skipped", rows: 0, note: reason });
      continue;
    }
    try {
      const rows = await source.fetchSnapshots(allCards, since);
      await upsertMarketSnapshots(rows);
      log.info(`market source "${source.name}": upserted ${rows.length} snapshots`);
      results.push({ source: source.name, kind: "market", status: "ok", rows: rows.length });
    } catch (err) {
      log.error(`market source "${source.name}" failed: ${errorMessage(err)}`);
      results.push({ source: source.name, kind: "market", status: "error", rows: 0, note: errorMessage(err) });
    }
  }

  for (const source of registry.pop) {
    const reason = source.disabled();
    if (reason) {
      log.warn(`pop source "${source.name}" skipped: ${reason}`);
      results.push({ source: source.name, kind: "pop", status: "skipped", rows: 0, note: reason });
      continue;
    }
    try {
      const rows = await source.fetchPopSnapshots(allCards, since);
      await upsertPopSnapshots(rows);
      log.info(`pop source "${source.name}": upserted ${rows.length} snapshots`);
      results.push({ source: source.name, kind: "pop", status: "ok", rows: rows.length });
    } catch (err) {
      log.error(`pop source "${source.name}" failed: ${errorMessage(err)}`);
      results.push({ source: source.name, kind: "pop", status: "error", rows: 0, note: errorMessage(err) });
    }
  }

  for (const source of registry.attention) {
    const reason = source.disabled();
    if (reason) {
      log.warn(`attention source "${source.name}" skipped: ${reason}`);
      results.push({ source: source.name, kind: "attention", status: "skipped", rows: 0, note: reason });
      continue;
    }
    try {
      const rows = await source.fetchAttentionSnapshots(allCards, since);
      await upsertAttentionSnapshots(rows);
      log.info(`attention source "${source.name}": upserted ${rows.length} snapshots`);
      results.push({ source: source.name, kind: "attention", status: "ok", rows: rows.length });
    } catch (err) {
      log.error(`attention source "${source.name}" failed: ${errorMessage(err)}`);
      results.push({ source: source.name, kind: "attention", status: "error", rows: 0, note: errorMessage(err) });
    }
  }

  const ok = results.filter((r) => r.status === "ok").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const errored = results.filter((r) => r.status === "error").length;
  log.info(`ingest finished: ${ok} sources ok, ${skipped} skipped, ${errored} errored`);

  return { startedAt, results };
}
