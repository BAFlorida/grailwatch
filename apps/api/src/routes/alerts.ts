import { Router } from "express";
import { desc, eq, gte } from "drizzle-orm";
import { alerts, cards, db } from "@grailwatch/db";
import { alertsQuerySchema } from "../schemas";

export const alertsRouter = Router();

alertsRouter.get("/", async (req, res) => {
  const { since } = alertsQuerySchema.parse(req.query);
  const sinceDate = since?.slice(0, 10);

  const rows = await db
    .select({ alert: alerts, cardName: cards.name, franchise: cards.franchise })
    .from(alerts)
    .innerJoin(cards, eq(alerts.cardId, cards.id))
    .where(sinceDate ? gte(alerts.runDate, sinceDate) : undefined)
    .orderBy(desc(alerts.runDate), desc(alerts.createdAt))
    .limit(200);

  res.json({
    alerts: rows.map(({ alert, cardName, franchise }) => ({
      ...alert,
      cardName,
      franchise,
    })),
  });
});
