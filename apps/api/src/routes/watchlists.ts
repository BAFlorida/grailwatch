import { Router } from "express";
import { asc, eq, inArray } from "drizzle-orm";
import { cards, db, watchlistCards, watchlists } from "@grailwatch/db";
import { watchlistSchema } from "../schemas";

export const watchlistsRouter = Router();

watchlistsRouter.get("/", async (_req, res) => {
  const lists = await db.select().from(watchlists).orderBy(asc(watchlists.label));
  const members = await db.select().from(watchlistCards);
  const byList = new Map<number, number[]>();
  for (const m of members) {
    let arr = byList.get(m.watchlistId);
    if (!arr) byList.set(m.watchlistId, (arr = []));
    arr.push(m.cardId);
  }
  res.json({
    watchlists: lists.map((l) => ({ ...l, cardIds: byList.get(l.id) ?? [] })),
  });
});

/**
 * Create-or-replace by label: posting an existing label updates its
 * membership, so the UI has one idempotent "save watchlist" call.
 */
watchlistsRouter.post("/", async (req, res) => {
  const { label, cardIds } = watchlistSchema.parse(req.body);

  const [list] = await db
    .insert(watchlists)
    .values({ label })
    .onConflictDoUpdate({ target: watchlists.label, set: { label } })
    .returning();

  // keep only ids that actually exist — unknown ids are reported, not fatal
  const existing =
    cardIds.length > 0
      ? await db.select({ id: cards.id }).from(cards).where(inArray(cards.id, cardIds))
      : [];
  const validIds = existing.map((c) => c.id);
  const unknownIds = cardIds.filter((id) => !validIds.includes(id));

  await db.delete(watchlistCards).where(eq(watchlistCards.watchlistId, list!.id));
  if (validIds.length > 0) {
    await db
      .insert(watchlistCards)
      .values(validIds.map((cardId) => ({ watchlistId: list!.id, cardId })))
      .onConflictDoNothing();
  }

  res.status(201).json({ watchlist: { ...list, cardIds: validIds }, unknownIds });
});
