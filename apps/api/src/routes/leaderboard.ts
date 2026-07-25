import { Router } from "express";
import { and, asc, desc, eq, gte, isNotNull, max, sql } from "drizzle-orm";
import { addDays } from "@grailwatch/shared/dates";
import { cards, db, marketSnapshots, signalScores } from "@grailwatch/db";
import { normalizedOf } from "./cards";

export const leaderboardRouter = Router();

/**
 * Top composite scores for the current (latest) run, with a 90-day daily
 * price sparkline per card (mean of avg_sale_price across grades).
 */
leaderboardRouter.get("/", async (_req, res) => {
  const [latest] = await db.select({ d: max(signalScores.runDate) }).from(signalScores);
  const runDate = latest?.d ?? null;
  if (!runDate) {
    res.json({ runDate: null, rows: [] });
    return;
  }

  const scored = await db
    .select({ score: signalScores, card: cards })
    .from(signalScores)
    .innerJoin(cards, eq(signalScores.cardId, cards.id))
    .where(eq(signalScores.runDate, runDate))
    .orderBy(desc(signalScores.compositeScore));

  const sparkFrom = addDays(runDate, -90);
  const sparkRows = await db
    .select({
      cardId: marketSnapshots.cardId,
      date: marketSnapshots.snapshotDate,
      price: sql<number>`avg(${marketSnapshots.avgSalePrice})::float8`,
    })
    .from(marketSnapshots)
    .where(
      and(
        gte(marketSnapshots.snapshotDate, sparkFrom),
        isNotNull(marketSnapshots.avgSalePrice),
      ),
    )
    .groupBy(marketSnapshots.cardId, marketSnapshots.snapshotDate)
    .orderBy(asc(marketSnapshots.snapshotDate));

  const sparklines = new Map<number, { d: string; p: number }[]>();
  for (const row of sparkRows) {
    let arr = sparklines.get(row.cardId);
    if (!arr) sparklines.set(row.cardId, (arr = []));
    arr.push({ d: row.date, p: row.price });
  }

  res.json({
    runDate,
    rows: scored.map(({ score, card }) => ({
      card,
      score,
      normalized: normalizedOf(score),
      sparkline: sparklines.get(card.id) ?? [],
    })),
  });
});
