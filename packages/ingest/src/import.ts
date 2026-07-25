import { eq } from "drizzle-orm";
import { createLogger } from "@grailwatch/shared/logger";
import {
  cards,
  db,
  mapAttentionCsv,
  mapCardsCsv,
  mapMarketCsv,
  mapPopCsv,
  upsertAttentionSnapshots,
  upsertMarketSnapshots,
  upsertPopSnapshots,
} from "@grailwatch/db";

const log = createLogger("csv-import");

export type CsvImportKind = "cards" | "market" | "pop" | "attention";

export interface CsvImportSummary {
  kind: CsvImportKind;
  imported: number;
  skipped: number;
  unknownNames: string[];
}

/**
 * Shared implementation behind POST /api/import/csv (and handy from scripts):
 * parse, resolve card names, idempotently upsert.
 */
export async function importCsvText(kind: CsvImportKind, text: string): Promise<CsvImportSummary> {
  if (kind === "cards") {
    const { rows, skipped } = mapCardsCsv(text);
    let imported = 0;
    for (const row of rows) {
      const existing = await db
        .select({ id: cards.id })
        .from(cards)
        .where(eq(cards.name, row.name))
        .limit(1);
      if (existing[0]) continue;
      await db.insert(cards).values(row);
      imported++;
    }
    log.info(`cards import: ${imported} created, ${rows.length - imported} already present, ${skipped} skipped`);
    return { kind, imported, skipped, unknownNames: [] };
  }

  const existing = await db.select({ id: cards.id, name: cards.name }).from(cards);
  const idByName = new Map(existing.map((c) => [c.name, c.id]));

  if (kind === "market") {
    const { rows, skipped, unknownNames } = mapMarketCsv(text, idByName);
    await upsertMarketSnapshots(rows);
    log.info(`market import: ${rows.length} upserted, ${skipped} skipped`);
    return { kind, imported: rows.length, skipped, unknownNames };
  }
  if (kind === "pop") {
    const { rows, skipped, unknownNames } = mapPopCsv(text, idByName);
    await upsertPopSnapshots(rows);
    log.info(`pop import: ${rows.length} upserted, ${skipped} skipped`);
    return { kind, imported: rows.length, skipped, unknownNames };
  }
  const { rows, skipped, unknownNames } = mapAttentionCsv(text, idByName);
  await upsertAttentionSnapshots(rows);
  log.info(`attention import: ${rows.length} upserted, ${skipped} skipped`);
  return { kind, imported: rows.length, skipped, unknownNames };
}
