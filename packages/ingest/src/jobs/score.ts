import { and, desc, eq, gte, lt, max } from "drizzle-orm";
import { addDays } from "@grailwatch/shared/dates";
import { createLogger } from "@grailwatch/shared/logger";
import {
  alerts,
  attentionSnapshots,
  cards,
  db,
  getScoringConfig,
  marketSnapshots,
  popSnapshots,
  signalScores,
  upsertSignalScores,
} from "@grailwatch/db";
import { computeCardSignals, type CardSeries } from "@grailwatch/signals";

const log = createLogger("score");

export interface ScoreSummary {
  runDate: string | null;
  scored: number;
  triggered: number;
  newAlerts: number;
}

/**
 * Nightly scoring: compute all five signals + composite per card as of the
 * latest snapshot date, upsert signal_scores, and create alerts for NEWLY
 * triggered cards (cards whose most recent previous run was not triggered).
 * Re-running for the same run date is idempotent.
 */
export async function runScore(): Promise<ScoreSummary> {
  const config = await getScoringConfig();

  const [latest] = await db
    .select({ maxDate: max(marketSnapshots.snapshotDate) })
    .from(marketSnapshots);
  const runDate = latest?.maxDate ?? null;
  if (!runDate) {
    log.warn("no market snapshots in the database — seed or run ingest first");
    return { runDate: null, scored: 0, triggered: 0, newAlerts: 0 };
  }

  const allCards = await db.select().from(cards);
  let scored = 0;
  let triggeredCount = 0;
  let newAlerts = 0;

  for (const card of allCards) {
    const series = await loadCardSeries(card.id, runDate);
    if (series.market.length === 0) {
      log.debug(`${card.name}: no market data — skipped`);
      continue;
    }
    const result = computeCardSignals(series, runDate, config);

    await upsertSignalScores([
      {
        cardId: card.id,
        runDate,
        velocityZ: result.signals.velocityZ.raw,
        supplyDrain: result.signals.supplyDrain.raw,
        gradeCompression: result.signals.gradeCompression.raw,
        popDelta: result.signals.popDelta.raw,
        attentionDivergence: result.signals.attentionDivergence.raw,
        compositeScore: result.composite,
        triggered: result.triggered,
      },
    ]);
    scored++;

    if (!result.triggered) continue;
    triggeredCount++;

    const prev = await db
      .select({ triggered: signalScores.triggered })
      .from(signalScores)
      .where(and(eq(signalScores.cardId, card.id), lt(signalScores.runDate, runDate)))
      .orderBy(desc(signalScores.runDate))
      .limit(1);
    const wasTriggered = prev[0]?.triggered ?? false;
    if (wasTriggered) continue;

    const inserted = await db
      .insert(alerts)
      .values({
        cardId: card.id,
        runDate,
        compositeScore: result.composite!,
        reasons: result.reasons.slice(0, 3),
      })
      .onConflictDoNothing()
      .returning({ id: alerts.id });
    if (inserted.length > 0) {
      newAlerts++;
      log.info(
        `ALERT ${card.name}: composite ${result.composite!.toFixed(2)}, ` +
          `signals above threshold: ${result.aboveThreshold.join(", ")}`,
      );
    }
  }

  log.info(`score run ${runDate}: ${scored} scored, ${triggeredCount} triggered, ${newAlerts} new alerts`);
  return { runDate, scored, triggered: triggeredCount, newAlerts };
}

async function loadCardSeries(cardId: number, asOf: string): Promise<CardSeries> {
  // window sizes: velocity needs 30+180d, pop delta needs ~15 months,
  // attention divergence needs 60+120d — load with a little slack
  const marketFrom = addDays(asOf, -290);
  const popFrom = addDays(asOf, -470);
  const attentionFrom = addDays(asOf, -200);

  const market = await db
    .select()
    .from(marketSnapshots)
    .where(and(eq(marketSnapshots.cardId, cardId), gte(marketSnapshots.snapshotDate, marketFrom)));

  const pop = await db
    .select()
    .from(popSnapshots)
    .where(and(eq(popSnapshots.cardId, cardId), gte(popSnapshots.snapshotDate, popFrom)));

  const attentionRows = await db
    .select()
    .from(attentionSnapshots)
    .where(
      and(eq(attentionSnapshots.cardId, cardId), gte(attentionSnapshots.snapshotDate, attentionFrom)),
    );

  // multiple attention sources can land on the same day — average them
  const attentionByDate = new Map<string, { total: number; n: number }>();
  for (const row of attentionRows) {
    const agg = attentionByDate.get(row.snapshotDate) ?? { total: 0, n: 0 };
    agg.total += row.score;
    agg.n++;
    attentionByDate.set(row.snapshotDate, agg);
  }

  return {
    market: market.map((m) => ({
      date: m.snapshotDate,
      grade: m.grade,
      avgSalePrice: m.avgSalePrice,
      medianSalePrice: m.medianSalePrice,
      saleCount: m.saleCount,
      activeListingCount: m.activeListingCount,
    })),
    pop: pop.map((p) => ({
      date: p.snapshotDate,
      grader: p.grader,
      grade: p.grade,
      population: p.population,
    })),
    attention: [...attentionByDate.entries()]
      .map(([date, agg]) => ({ date, score: agg.total / agg.n }))
      .sort((a, b) => (a.date < b.date ? -1 : 1)),
  };
}
