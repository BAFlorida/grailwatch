import express from "express";
import { errorHandler, notFound, requestLogger } from "./middleware";
import { alertsRouter } from "./routes/alerts";
import { cardsRouter } from "./routes/cards";
import { configRouter } from "./routes/config";
import { importRouter } from "./routes/import";
import { leaderboardRouter } from "./routes/leaderboard";
import { watchlistsRouter } from "./routes/watchlists";

export function createApp(): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "25mb" }));
  app.use(express.text({ type: ["text/csv", "text/plain"], limit: "25mb" }));
  app.use(requestLogger);

  app.get("/api/healthz", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/cards", cardsRouter);
  app.use("/api/alerts", alertsRouter);
  app.use("/api/leaderboard", leaderboardRouter);
  app.use("/api/watchlists", watchlistsRouter);
  app.use("/api/config", configRouter);
  app.use("/api/import", importRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
