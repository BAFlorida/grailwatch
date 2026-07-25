import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

export const franchiseEnum = pgEnum("franchise", [
  "pokemon",
  "yugioh",
  "manga",
  "dbz_carddass",
  "soccer",
  "other",
]);

export const cardCategoryEnum = pgEnum("card_category", ["card", "book", "sealed"]);

export const graderEnum = pgEnum("grader", ["psa", "cgc", "bgs"]);

export const attentionSourceEnum = pgEnum("attention_source", ["google_trends", "youtube", "x"]);

export const cards = pgTable(
  "cards",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    franchise: franchiseEnum("franchise").notNull(),
    setName: text("set_name"),
    cardNumber: text("card_number"),
    language: text("language"),
    category: cardCategoryEnum("category").notNull().default("card"),
    notes: text("notes"),
    // Optional per-card pop-report page URLs; the PSA/CGC scrapers only visit
    // cards that have one set.
    psaPopUrl: text("psa_pop_url"),
    cgcPopUrl: text("cgc_pop_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_cards_name").on(t.name), index("idx_cards_franchise").on(t.franchise)],
);

export const marketSnapshots = pgTable(
  "market_snapshots",
  {
    id: serial("id").primaryKey(),
    cardId: integer("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    /** "raw", "psa_2".."psa_10", "cgc_9_8", or "all" for aggregate-only rows */
    grade: text("grade").notNull(),
    snapshotDate: date("snapshot_date", { mode: "string" }).notNull(),
    avgSalePrice: doublePrecision("avg_sale_price"),
    medianSalePrice: doublePrecision("median_sale_price"),
    saleCount: integer("sale_count"),
    activeListingCount: integer("active_listing_count"),
    source: text("source").notNull().default("csv"),
  },
  (t) => [
    unique("uq_market_card_grade_date").on(t.cardId, t.grade, t.snapshotDate),
    index("idx_market_card_date").on(t.cardId, t.snapshotDate),
    index("idx_market_date").on(t.snapshotDate),
  ],
);

export const popSnapshots = pgTable(
  "pop_snapshots",
  {
    id: serial("id").primaryKey(),
    cardId: integer("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    grader: graderEnum("grader").notNull(),
    grade: text("grade").notNull(),
    snapshotDate: date("snapshot_date", { mode: "string" }).notNull(),
    population: integer("population").notNull(),
  },
  (t) => [
    // The spec's (card_id, grade, snapshot_date) plus grader, so PSA and CGC
    // rows for the same numeric grade can never collide.
    unique("uq_pop_card_grader_grade_date").on(t.cardId, t.grader, t.grade, t.snapshotDate),
    index("idx_pop_card_date").on(t.cardId, t.snapshotDate),
    index("idx_pop_date").on(t.snapshotDate),
  ],
);

export const attentionSnapshots = pgTable(
  "attention_snapshots",
  {
    id: serial("id").primaryKey(),
    // Either a concrete card or a free-form topic (or both, when a topic maps
    // to a card). Enforced by chk_attention_target below.
    cardId: integer("card_id").references(() => cards.id, { onDelete: "cascade" }),
    topic: text("topic"),
    snapshotDate: date("snapshot_date", { mode: "string" }).notNull(),
    source: attentionSourceEnum("source").notNull(),
    score: doublePrecision("score").notNull(),
  },
  (t) => [
    unique("uq_attention_card_topic_source_date")
      .on(t.cardId, t.topic, t.source, t.snapshotDate)
      .nullsNotDistinct(),
    index("idx_attention_card_date").on(t.cardId, t.snapshotDate),
    index("idx_attention_date").on(t.snapshotDate),
    check("chk_attention_target", sql`card_id IS NOT NULL OR topic IS NOT NULL`),
  ],
);

export const signalScores = pgTable(
  "signal_scores",
  {
    id: serial("id").primaryKey(),
    cardId: integer("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    runDate: date("run_date", { mode: "string" }).notNull(),
    velocityZ: doublePrecision("velocity_z"),
    supplyDrain: doublePrecision("supply_drain"),
    gradeCompression: doublePrecision("grade_compression"),
    popDelta: doublePrecision("pop_delta"),
    attentionDivergence: doublePrecision("attention_divergence"),
    compositeScore: doublePrecision("composite_score"),
    triggered: boolean("triggered").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_signal_card_run").on(t.cardId, t.runDate),
    index("idx_signal_run").on(t.runDate),
    index("idx_signal_card_run").on(t.cardId, t.runDate),
  ],
);

export const alerts = pgTable(
  "alerts",
  {
    id: serial("id").primaryKey(),
    cardId: integer("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    runDate: date("run_date", { mode: "string" }).notNull(),
    compositeScore: doublePrecision("composite_score").notNull(),
    reasons: jsonb("reasons").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    deliveredChannels: jsonb("delivered_channels").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_alerts_card_run").on(t.cardId, t.runDate),
    index("idx_alerts_run").on(t.runDate),
  ],
);

export const watchlists = pgTable(
  "watchlists",
  {
    id: serial("id").primaryKey(),
    label: text("label").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("uq_watchlists_label").on(t.label)],
);

export const watchlistCards = pgTable(
  "watchlist_cards",
  {
    watchlistId: integer("watchlist_id")
      .notNull()
      .references(() => watchlists.id, { onDelete: "cascade" }),
    cardId: integer("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ name: "pk_watchlist_cards", columns: [t.watchlistId, t.cardId] })],
);

export const appConfig = pgTable("app_config", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;
export type MarketSnapshot = typeof marketSnapshots.$inferSelect;
export type NewMarketSnapshot = typeof marketSnapshots.$inferInsert;
export type PopSnapshot = typeof popSnapshots.$inferSelect;
export type NewPopSnapshot = typeof popSnapshots.$inferInsert;
export type AttentionSnapshot = typeof attentionSnapshots.$inferSelect;
export type NewAttentionSnapshot = typeof attentionSnapshots.$inferInsert;
export type SignalScore = typeof signalScores.$inferSelect;
export type NewSignalScore = typeof signalScores.$inferInsert;
export type Alert = typeof alerts.$inferSelect;
export type NewAlert = typeof alerts.$inferInsert;
export type Watchlist = typeof watchlists.$inferSelect;
export type WatchlistCard = typeof watchlistCards.$inferSelect;
export type AppConfigRow = typeof appConfig.$inferSelect;
