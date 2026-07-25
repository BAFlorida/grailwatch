/**
 * Deterministic synthetic series for the scenario tests. Mirrors the shapes
 * used by the seed-CSV generator, but self-contained so the engine tests
 * stand alone.
 */
import { addDays } from "@grailwatch/shared/dates";
import type { AttentionPoint, CardSeries, MarketDay, PopPoint } from "../src/types";

export const FIXTURE_END = "2026-01-01";
export const FIXTURE_DAYS = 270;

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const gauss = (rnd: () => number): number => rnd() + rnd() + rnd() - 1.5;

export type Scenario = "accumulation" | "viral" | "flat";

interface Shape {
  priceTrend(t: number, cohort: "high" | "low"): number;
  saleMult(t: number): number;
  listingMult(t: number): number;
  attention(t: number): number;
  popGrowth(interval: number): number;
}

const SHAPES: Record<Scenario, Shape> = {
  flat: {
    priceTrend: () => 1,
    saleMult: () => 1,
    listingMult: () => 1,
    attention: () => 17,
    popGrowth: () => 0.005,
  },
  accumulation: {
    priceTrend: (t, cohort) =>
      t < 200 ? 1 : 1 + (cohort === "high" ? 0.38 : 0.33) * ((t - 200) / 69),
    saleMult: (t) => (t >= 225 ? 2.2 : 1),
    listingMult: (t) => (t >= 235 ? 1 - 0.38 * ((t - 235) / 34) : 1),
    attention: () => 16,
    popGrowth: (i) => (i <= 12 ? 0.007 : 0.05),
  },
  viral: {
    priceTrend: (t, cohort) =>
      t < 210 ? 1 : 1 + (cohort === "high" ? 0.75 : 0.12) * ((t - 210) / 59),
    saleMult: (t) => (t >= 240 ? 3 : 1),
    listingMult: (t) => (t >= 240 ? 1 + 0.3 * ((t - 240) / 29) : 1),
    attention: (t) => (t < 215 ? 15 : 15 + 73 * ((t - 215) / 54)),
    popGrowth: (i) => (i <= 13 ? 0.006 : 0.12),
  },
};

const GRADES = [
  { grade: "psa_10", mult: 1, lambda: 0.6, listings: 6, cohort: "high" as const },
  { grade: "psa_9", mult: 0.42, lambda: 0.6, listings: 6, cohort: "high" as const },
  { grade: "psa_7", mult: 0.18, lambda: 1.0, listings: 12, cohort: "high" as const },
  { grade: "psa_4", mult: 0.07, lambda: 1.6, listings: 18, cohort: "low" as const },
  { grade: "psa_2", mult: 0.035, lambda: 1.6, listings: 18, cohort: "low" as const },
  { grade: "raw", mult: 0.09, lambda: 2.5, listings: 28, cohort: "low" as const },
];

const POP_GRADES = [
  { grade: "psa_10", base: 45 },
  { grade: "psa_9", base: 220 },
  { grade: "psa_7", base: 520 },
  { grade: "psa_4", base: 380 },
  { grade: "psa_2", base: 300 },
];

export function buildSeries(scenario: Scenario, seed = 7): CardSeries {
  const rnd = mulberry32(seed);
  const shape = SHAPES[scenario];
  const market: MarketDay[] = [];
  const attention: AttentionPoint[] = [];
  const pop: PopPoint[] = [];

  for (let t = 0; t < FIXTURE_DAYS; t++) {
    const date = addDays(FIXTURE_END, t - (FIXTURE_DAYS - 1));
    for (const g of GRADES) {
      const trend = shape.priceTrend(t, g.cohort);
      const px = 1000 * g.mult * trend * (1 + gauss(rnd) * 0.05);
      const lambda = g.lambda * shape.saleMult(t);
      let saleCount = Math.floor(lambda);
      if (rnd() < lambda - saleCount) saleCount++;
      market.push({
        date,
        grade: g.grade,
        avgSalePrice: saleCount > 0 ? px : null,
        medianSalePrice: saleCount > 0 ? px : null,
        saleCount,
        activeListingCount: Math.max(
          0,
          Math.round(g.listings * shape.listingMult(t) * (1 + (rnd() - 0.5) * 0.1)),
        ),
      });
    }
    attention.push({
      date,
      score: Math.min(100, Math.max(0, shape.attention(t) + (rnd() - 0.5) * 3)),
    });
  }

  const level: Record<string, number> = {};
  for (const g of POP_GRADES) level[g.grade] = g.base;
  for (let i = 0; i < 15; i++) {
    const date = addDays(FIXTURE_END, -(14 - i) * 30);
    if (i > 0) {
      for (const g of POP_GRADES) level[g.grade] = level[g.grade]! * (1 + shape.popGrowth(i));
    }
    for (const g of POP_GRADES) {
      pop.push({ date, grader: "psa", grade: g.grade, population: Math.round(level[g.grade]!) });
    }
  }

  return { market, attention, pop };
}

/** Convenience for hand-built market rows in unit tests. */
export function marketDay(
  date: string,
  grade: string,
  avgSalePrice: number | null,
  saleCount: number,
  activeListingCount: number | null = null,
): MarketDay {
  return { date, grade, avgSalePrice, medianSalePrice: avgSalePrice, saleCount, activeListingCount };
}
