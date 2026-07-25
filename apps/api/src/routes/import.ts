import { Router } from "express";
import { importCsvText } from "@grailwatch/ingest";
import { AppError } from "../middleware";
import { importJsonBodySchema, importQuerySchema } from "../schemas";

export const importRouter = Router();

/**
 * POST /api/import/csv?kind=cards|market|pop|attention
 * Body: raw CSV (text/csv or text/plain) or JSON { "csv": "..." }.
 */
importRouter.post("/csv", async (req, res) => {
  const { kind } = importQuerySchema.parse(req.query);

  let csv: string;
  if (typeof req.body === "string") {
    csv = req.body;
  } else if (req.body && typeof req.body === "object") {
    csv = importJsonBodySchema.parse(req.body).csv;
  } else {
    throw new AppError(400, "missing_csv", "Send CSV as text/csv body or JSON { csv }");
  }
  if (csv.trim().length === 0) {
    throw new AppError(400, "missing_csv", "CSV body is empty");
  }

  const summary = await importCsvText(kind, csv);
  res.json({ summary });
});
