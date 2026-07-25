import { sql } from "drizzle-orm";
import { db } from "./client";
import {
  attentionSnapshots,
  marketSnapshots,
  popSnapshots,
  signalScores,
} from "./schema";
import type {
  NewAttentionSnapshot,
  NewMarketSnapshot,
  NewPopSnapshot,
  NewSignalScore,
} from "./schema";

/**
 * All ingest writes are idempotent upserts keyed on the snapshot-table unique
 * constraints, so re-running a job (or re-importing a CSV) never duplicates
 * rows — it refreshes them.
 */

function chunk<T>(rows: T[], size = 500): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

export async function upsertMarketSnapshots(rows: NewMarketSnapshot[]): Promise<number> {
  for (const batch of chunk(rows)) {
    await db
      .insert(marketSnapshots)
      .values(batch)
      .onConflictDoUpdate({
        target: [marketSnapshots.cardId, marketSnapshots.grade, marketSnapshots.snapshotDate],
        set: {
          avgSalePrice: sql`excluded.avg_sale_price`,
          medianSalePrice: sql`excluded.median_sale_price`,
          saleCount: sql`excluded.sale_count`,
          activeListingCount: sql`excluded.active_listing_count`,
          source: sql`excluded.source`,
        },
      });
  }
  return rows.length;
}

export async function upsertPopSnapshots(rows: NewPopSnapshot[]): Promise<number> {
  for (const batch of chunk(rows)) {
    await db
      .insert(popSnapshots)
      .values(batch)
      .onConflictDoUpdate({
        target: [
          popSnapshots.cardId,
          popSnapshots.grader,
          popSnapshots.grade,
          popSnapshots.snapshotDate,
        ],
        set: { population: sql`excluded.population` },
      });
  }
  return rows.length;
}

export async function upsertAttentionSnapshots(rows: NewAttentionSnapshot[]): Promise<number> {
  for (const batch of chunk(rows)) {
    await db
      .insert(attentionSnapshots)
      .values(batch)
      .onConflictDoUpdate({
        target: [
          attentionSnapshots.cardId,
          attentionSnapshots.topic,
          attentionSnapshots.source,
          attentionSnapshots.snapshotDate,
        ],
        set: { score: sql`excluded.score` },
      });
  }
  return rows.length;
}

export async function upsertSignalScores(rows: NewSignalScore[]): Promise<number> {
  for (const batch of chunk(rows)) {
    await db
      .insert(signalScores)
      .values(batch)
      .onConflictDoUpdate({
        target: [signalScores.cardId, signalScores.runDate],
        set: {
          velocityZ: sql`excluded.velocity_z`,
          supplyDrain: sql`excluded.supply_drain`,
          gradeCompression: sql`excluded.grade_compression`,
          popDelta: sql`excluded.pop_delta`,
          attentionDivergence: sql`excluded.attention_divergence`,
          compositeScore: sql`excluded.composite_score`,
          triggered: sql`excluded.triggered`,
        },
      });
  }
  return rows.length;
}
