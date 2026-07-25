import { z } from "zod";

export const franchiseSchema = z.enum([
  "pokemon",
  "yugioh",
  "manga",
  "dbz_carddass",
  "soccer",
  "other",
]);

export const categorySchema = z.enum(["card", "book", "sealed"]);

const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const createCardSchema = z.object({
  name: z.string().trim().min(1).max(200),
  franchise: franchiseSchema,
  setName: optionalTrimmed(200),
  cardNumber: optionalTrimmed(50),
  language: optionalTrimmed(50),
  category: categorySchema.default("card"),
  notes: optionalTrimmed(2000),
  psaPopUrl: z.union([z.url().max(500), z.literal(""), z.null()]).optional()
    .transform((v) => (v ? v : null)),
  cgcPopUrl: z.union([z.url().max(500), z.literal(""), z.null()]).optional()
    .transform((v) => (v ? v : null)),
});

export const cardsQuerySchema = z.object({
  franchise: franchiseSchema.optional(),
  watchlist: z.coerce.number().int().positive().optional(),
  q: z.string().trim().max(200).optional(),
});

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const cardDetailQuerySchema = z.object({
  days: z.coerce.number().int().min(30).max(3650).default(365),
});

export const alertsQuerySchema = z.object({
  // accepts YYYY-MM-DD or a full ISO timestamp
  since: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}/, "since must start with YYYY-MM-DD")
    .optional(),
});

export const watchlistSchema = z.object({
  label: z.string().trim().min(1).max(100),
  cardIds: z.array(z.number().int().positive()).max(1000).default([]),
});

const weightValue = z.number().min(0).max(10);
export const weightsUpdateSchema = z.object({
  weights: z
    .object({
      velocityZ: weightValue.optional(),
      supplyDrain: weightValue.optional(),
      gradeCompression: weightValue.optional(),
      popDelta: weightValue.optional(),
      attentionDivergence: weightValue.optional(),
    })
    .refine((w) => Object.values(w).some((v) => v !== undefined), {
      message: "provide at least one weight",
    }),
});

export const importQuerySchema = z.object({
  kind: z.enum(["cards", "market", "pop", "attention"]),
});

export const importJsonBodySchema = z.object({
  csv: z.string().min(1),
});
