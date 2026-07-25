import { Router } from "express";
import { getScoringConfig, saveScoringConfig } from "@grailwatch/db";
import { AppError } from "../middleware";
import { weightsUpdateSchema } from "../schemas";

export const configRouter = Router();

configRouter.get("/weights", async (_req, res) => {
  const config = await getScoringConfig();
  res.json({ config });
});

configRouter.put("/weights", async (req, res) => {
  const { weights } = weightsUpdateSchema.parse(req.body);
  const current = await getScoringConfig();
  const merged = {
    ...current,
    weights: { ...current.weights, ...Object.fromEntries(
      Object.entries(weights).filter(([, v]) => v !== undefined),
    ) },
  };
  const total = Object.values(merged.weights).reduce((a, b) => a + b, 0);
  if (total <= 0) {
    throw new AppError(400, "invalid_weights", "At least one weight must be greater than zero");
  }
  await saveScoringConfig(merged);
  res.json({ config: merged });
});
