import { Router } from "express";
import { and, asc, desc, eq, gte, ilike, inArray, max, type SQL } from "drizzle-orm";
import { addDays } from "@grailwatch/shared/dates";
import {
  attentionSnapshots,
  alerts,
  cards,
  db,
  marketSnapshots,
  popSnapshots,
  signalScores,
  watchlistCards,
} from "@grailwatch/db";
import { normalizeSignal } from "@grailwatch/signals";
import type { SignalScore } from "@grailwatch/db";
import { AppError } from "../middleware";
import { cardDetailQuerySchema, cardsQuerySchema, createCardSchema, idParamSchema } from "../schemas";

export const cardsRouter = Router();

export function normalizedOf(score: SignalScore): Record<string, number | null> {
  return {
    velocityZ: normalizeSignal("velocityZ", score.velocityZ),
    supplyDrain: normalizeSignal("supplyDrain", score.supplyDrain),
    gradeCompression: normalizeSignal("gradeCompression", score.gradeCompression),
    popDelta: normalizeSignal("popDelta", score.popDelta),
    attentionDivergence: normalizeSignal("attentionDivergence", score.attentionDivergence),
  };
}

cardsRouter.get("/", async (req, res) => {
  const query = cardsQuerySchema.parse(req.query);

  let memberIds: number[] | null = null;
  if (query.watchlist !== undefined) {
    const members = await db
      .select({ cardId: watchlistCards.cardId })
      .from(watchlistCards)
      .where(eq(watchlistCards.watchlistId, query.watchlist));
    memberIds = members.map((m) => m.cardId);
    if (memberIds.length === 0) {
      res.json({ cards: [] });
      return;
    }
  }

  const conditions: SQL[] = [];
  if (query.franchise) conditions.push(eq(cards.franchise, query.franchise));
  if (query.q) conditions.push(ilike(cards.name, `%${query.q}%`));
  if (memberIds) conditions.push(inArray(cards.id, memberIds));

  const rows = await db
    .select()
    .from(cards)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(cards.franchise), asc(cards.name));

  // attach each card's score from the latest run
  const [latest] = await db.select({ d: max(signalScores.runDate) }).from(signalScores);
  const scoreByCard = new Map<number, SignalScore>();
  if (latest?.d) {
    const scores = await db
      .select()
      .from(signalScores)
      .where(eq(signalScores.runDate, latest.d));
    for (const s of scores) scoreByCard.set(s.cardId, s);
  }

  res.json({
    cards: rows.map((card) => {
      const score = scoreByCard.get(card.id) ?? null;
      return { ...card, latestScore: score, normalized: score ? normalizedOf(score) : null };
    }),
  });
});

cardsRouter.post("/", async (req, res) => {
  const body = createCardSchema.parse(req.body);
  const [created] = await db.insert(cards).values(body).returning();
  res.status(201).json({ card: created });
});

cardsRouter.get("/:id", async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const { days } = cardDetailQuerySchema.parse(req.query);

  const [card] = await db.select().from(cards).where(eq(cards.id, id)).limit(1);
  if (!card) throw new AppError(404, "card_not_found", `No card with id ${id}`);

  const [latest] = await db
    .select({ d: max(marketSnapshots.snapshotDate) })
    .from(marketSnapshots)
    .where(eq(marketSnapshots.cardId, id));
  const anchor = latest?.d ?? new Date().toISOString().slice(0, 10);
  const from = addDays(anchor, -days);

  const [market, pop, attention, history, cardAlerts] = await Promise.all([
    db
      .select()
      .from(marketSnapshots)
      .where(and(eq(marketSnapshots.cardId, id), gte(marketSnapshots.snapshotDate, from)))
      .orderBy(asc(marketSnapshots.snapshotDate)),
    db
      .select()
      .from(popSnapshots)
      .where(and(eq(popSnapshots.cardId, id), gte(popSnapshots.snapshotDate, addDays(anchor, -Math.max(days, 460)))))
      .orderBy(asc(popSnapshots.snapshotDate)),
    db
      .select()
      .from(attentionSnapshots)
      .where(and(eq(attentionSnapshots.cardId, id), gte(attentionSnapshots.snapshotDate, from)))
      .orderBy(asc(attentionSnapshots.snapshotDate)),
    db
      .select()
      .from(signalScores)
      .where(eq(signalScores.cardId, id))
      .orderBy(asc(signalScores.runDate)),
    db
      .select()
      .from(alerts)
      .where(eq(alerts.cardId, id))
      .orderBy(desc(alerts.runDate))
      .limit(20),
  ]);

  res.json({
    card,
    marketSnapshots: market,
    popSnapshots: pop,
    attentionSnapshots: attention,
    signalHistory: history.map((h) => ({ ...h, normalized: normalizedOf(h) })),
    alerts: cardAlerts,
  });
});
