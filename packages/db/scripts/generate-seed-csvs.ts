/**
 * Deterministic synthetic-data generator for the seed CSVs.
 *
 * Usage: tsx scripts/generate-seed-csvs.ts [END_DATE]
 *
 * Emits ~270 days of daily market + attention data and ~15 monthly pop
 * snapshots per card into packages/db/seed-data/. 270 days (not just the
 * spec's "~90 days of data") so the signal engine's full windows — the
 * 180-day velocity baseline and the pop 12-month norm — are populated; the
 * scenario patterns themselves play out in the final 90 days.
 *
 * Same END_DATE ⇒ byte-identical output (seeded PRNG per card).
 */
import fs from "node:fs";
import path from "node:path";
import { addDays, todayIso, toCsv } from "@grailwatch/shared";
import { SEED_CARDS, type SeedCard, type SeedScenario } from "../src/seed-universe";

const END_DATE = process.argv[2] ?? todayIso();
const MARKET_DAYS = 270;
const POP_SNAPSHOTS = 15; // one every 30 days ≈ 14 months of history
const POP_INTERVAL_DAYS = 30;

// ── deterministic PRNG ────────────────────────────────────────────────────────
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashKey(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

/** approx. normal(0, 0.5) from three uniforms */
function gauss(rnd: () => number): number {
  return rnd() + rnd() + rnd() - 1.5;
}

// ── scenario shapes (t = 0..MARKET_DAYS-1, last index = END_DATE) ────────────
interface Shape {
  priceTrend(t: number, cohort: "high" | "low"): number;
  saleMult(t: number): number;
  listingMult(t: number): number;
  attention(t: number): number;
  /** fractional pop growth applied over interval i (1-based, of 14) */
  popGrowth(i: number): number;
}

const SHAPES: Record<SeedScenario, Shape> = {
  flat: {
    priceTrend: () => 1,
    saleMult: () => 1,
    listingMult: () => 1,
    attention: () => 17,
    popGrowth: () => 0.005,
  },
  drift: {
    priceTrend: (t) => 1 + 0.08 * (t / (MARKET_DAYS - 1)),
    saleMult: () => 1,
    listingMult: () => 1,
    attention: (t) => 15 + 7 * (t / (MARKET_DAYS - 1)),
    popGrowth: () => 0.008,
  },
  // Quiet accumulation: lows and highs ramp in lockstep over the last ~70
  // days, sold volume jumps, active listings drain, attention stays flat,
  // grading submissions tick up in the last two months.
  accumulation: {
    priceTrend: (t, cohort) =>
      t < 200 ? 1 : 1 + (cohort === "high" ? 0.38 : 0.33) * ((t - 200) / 69),
    saleMult: (t) => (t >= 225 ? 2.2 : 1),
    listingMult: (t) => (t >= 235 ? 1 - 0.38 * ((t - 235) / 34) : 1),
    attention: () => 16,
    popGrowth: (i) => (i <= 12 ? 0.007 : 0.05),
  },
  // Already viral: highs spike hard, lows lag badly, sellers flood listings
  // into the hype, attention explodes, everyone submits for grading.
  viral: {
    priceTrend: (t, cohort) =>
      t < 210 ? 1 : 1 + (cohort === "high" ? 0.75 : 0.12) * ((t - 210) / 59),
    saleMult: (t) => (t >= 240 ? 3 : 1),
    listingMult: (t) => (t >= 240 ? 1 + 0.3 * ((t - 240) / 29) : 1),
    attention: (t) => (t < 215 ? 15 : 15 + 73 * ((t - 215) / 54)),
    popGrowth: (i) => (i <= 13 ? 0.006 : 0.12),
  },
};

// ── grade parameters ──────────────────────────────────────────────────────────
function gradeNum(grade: string): number | null {
  const m = grade.match(/^(?:psa|cgc|bgs)_(\d+)(?:_(\d+))?$/);
  if (!m) return null;
  return Number(m[1]) + (m[2] ? Number(m[2]) / 10 : 0);
}

function priceMult(card: SeedCard, grade: string): number {
  if (card.grades.length === 1) return 1; // sealed: raw IS the market
  const n = gradeNum(grade);
  if (n === null) return 0.09; // raw copies of graded-market cards
  if (n >= 9.8) return 1;
  if (n >= 9) return 0.42;
  if (n >= 6.5) return 0.16;
  if (n >= 4) return 0.07;
  return 0.035;
}

function cohortOf(card: SeedCard, grade: string): "high" | "low" {
  if (card.grades.length === 1) return "high";
  const n = gradeNum(grade);
  if (n === null) return "low"; // accumulators sweep raw copies too
  return n >= 7 ? "high" : "low";
}

function saleRate(card: SeedCard, grade: string): number {
  if (card.grades.length === 1) return 0.8;
  const n = gradeNum(grade);
  if (n === null) return 2.5;
  if (n >= 9) return 0.6;
  if (n >= 6.5) return 1.0;
  return 1.6;
}

function listingBase(card: SeedCard, grade: string): number {
  if (card.grades.length === 1) return 10;
  const n = gradeNum(grade);
  if (n === null) return 28;
  if (n >= 9) return 6;
  if (n >= 6.5) return 12;
  return 18;
}

function popBase(grade: string): number {
  const n = gradeNum(grade) ?? 0;
  if (n >= 9.8) return 45;
  if (n >= 9) return 220;
  if (n >= 6.5) return 520;
  return 380;
}

const round2 = (v: number) => Math.round(v * 100) / 100;
const round1 = (v: number) => Math.round(v * 10) / 10;

// ── generation ────────────────────────────────────────────────────────────────
const marketRows: (string | number | null)[][] = [];
const popRows: (string | number | null)[][] = [];
const attentionRows: (string | number | null)[][] = [];

for (const card of SEED_CARDS) {
  const rnd = mulberry32(hashKey(card.key));
  const shape = SHAPES[card.scenario];

  // market: daily rows per grade
  for (let t = 0; t < MARKET_DAYS; t++) {
    const date = addDays(END_DATE, t - (MARKET_DAYS - 1));
    for (const grade of card.grades) {
      const trend = shape.priceTrend(t, cohortOf(card, grade));
      const px = card.basePrice * priceMult(card, grade) * trend * (1 + gauss(rnd) * 0.06);
      const lambda = saleRate(card, grade) * shape.saleMult(t);
      let saleCount = Math.floor(lambda);
      if (rnd() < lambda - saleCount) saleCount++;
      const avg = saleCount > 0 ? round2(px) : null;
      const median = saleCount > 0 ? round2(px * (1 + (rnd() - 0.5) * 0.02)) : null;
      const listings = Math.max(
        0,
        Math.round(listingBase(card, grade) * shape.listingMult(t) * (1 + (rnd() - 0.5) * 0.12)),
      );
      marketRows.push([card.name, grade, date, avg, median, saleCount, listings, "seed_csv"]);
    }
  }

  // attention: daily google_trends score
  for (let t = 0; t < MARKET_DAYS; t++) {
    const date = addDays(END_DATE, t - (MARKET_DAYS - 1));
    const score = Math.min(100, Math.max(0, shape.attention(t) + (rnd() - 0.5) * 4));
    attentionRows.push([card.name, card.name, date, "google_trends", round1(score)]);
  }

  // pop: monthly snapshots per graded grade (sealed cards have none)
  const popGrades = card.grades.filter((g) => gradeNum(g) !== null);
  if (popGrades.length > 0) {
    const pops: Record<string, number> = {};
    for (const g of popGrades) pops[g] = popBase(g) * (0.8 + rnd() * 0.4);
    for (let i = 0; i < POP_SNAPSHOTS; i++) {
      const date = addDays(END_DATE, -(POP_SNAPSHOTS - 1 - i) * POP_INTERVAL_DAYS);
      if (i > 0) {
        for (const g of popGrades) pops[g] = pops[g]! * (1 + shape.popGrowth(i));
      }
      for (const g of popGrades) {
        popRows.push([card.name, card.grader, g, date, Math.round(pops[g]!)]);
      }
    }
  }
}

// ── write files ───────────────────────────────────────────────────────────────
const outDir = path.join(import.meta.dirname, "..", "seed-data");
fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(
  path.join(outDir, "market.csv"),
  toCsv(
    ["card_name", "grade", "snapshot_date", "avg_sale_price", "median_sale_price", "sale_count", "active_listing_count", "source"],
    marketRows,
  ),
);
fs.writeFileSync(
  path.join(outDir, "pop.csv"),
  toCsv(["card_name", "grader", "grade", "snapshot_date", "population"], popRows),
);
fs.writeFileSync(
  path.join(outDir, "attention.csv"),
  toCsv(["card_name", "topic", "snapshot_date", "source", "score"], attentionRows),
);

console.log(`seed CSVs written to ${outDir}`);
console.log(`  market.csv:    ${marketRows.length} rows`);
console.log(`  pop.csv:       ${popRows.length} rows`);
console.log(`  attention.csv: ${attentionRows.length} rows`);
console.log(`  window: ${addDays(END_DATE, -(MARKET_DAYS - 1))} .. ${END_DATE}`);
