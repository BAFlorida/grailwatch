import { epochDay } from "@grailwatch/shared/dates";
import { normalizeSignal } from "@grailwatch/shared/scoring";
import { mean, stddev } from "./stats";
import { nullSignal, type MarketDay, type SignalValue } from "./types";

/**
 * velocity_z — z-score of the trailing 30-day average sale price against a
 * 180-day baseline (the 180 days immediately preceding the 30-day window),
 * computed per grade, then the max across grades.
 *
 * A grade only qualifies with ≥ minBaselineSales total sales AND
 * ≥ minBaselineDays distinct priced days in the baseline; the whole signal is
 * null when no grade qualifies. The baseline stddev is floored at 1% of the
 * baseline mean so a perfectly flat book that suddenly moves scores very high
 * instead of dividing by ~zero.
 */
export interface VelocityOptions {
  recentDays: number;
  baselineDays: number;
  minBaselineSales: number;
  minBaselineDays: number;
  minRecentDays: number;
}

export const DEFAULT_VELOCITY_OPTS: VelocityOptions = {
  recentDays: 30,
  baselineDays: 180,
  minBaselineSales: 10,
  minBaselineDays: 20,
  minRecentDays: 3,
};

export function computeVelocityZ(
  market: MarketDay[],
  asOf: string,
  opts: VelocityOptions = DEFAULT_VELOCITY_OPTS,
): SignalValue {
  const asOfDay = epochDay(asOf);
  const byGrade = new Map<string, { age: number; price: number; sales: number }[]>();
  for (const p of market) {
    if (p.avgSalePrice === null || p.avgSalePrice === undefined) continue;
    const age = asOfDay - epochDay(p.date);
    if (age < 0 || age >= opts.recentDays + opts.baselineDays) continue;
    let arr = byGrade.get(p.grade);
    if (!arr) byGrade.set(p.grade, (arr = []));
    arr.push({ age, price: p.avgSalePrice, sales: p.saleCount ?? 0 });
  }

  let best: {
    grade: string;
    z: number;
    recentMean: number;
    baselineMean: number;
    pctChange: number;
  } | null = null;

  for (const [grade, pts] of byGrade) {
    const recent = pts.filter((p) => p.age < opts.recentDays);
    const baseline = pts.filter((p) => p.age >= opts.recentDays);
    if (recent.length < opts.minRecentDays) continue;
    if (baseline.length < opts.minBaselineDays) continue;
    const baselineSales = baseline.reduce((s, p) => s + p.sales, 0);
    if (baselineSales < opts.minBaselineSales) continue;

    const basePrices = baseline.map((p) => p.price);
    const m = mean(basePrices);
    const sd = stddev(basePrices);
    if (m === null || sd === null || m <= 0) continue;
    const sdEff = Math.max(sd, m * 0.01);
    const rm = mean(recent.map((p) => p.price))!;
    const z = (rm - m) / sdEff;
    if (best === null || z > best.z) {
      best = { grade, z, recentMean: rm, baselineMean: m, pctChange: ((rm - m) / m) * 100 };
    }
  }

  if (best === null) return nullSignal("insufficient sales history");
  return {
    raw: best.z,
    normalized: normalizeSignal("velocityZ", best.z),
    detail: {
      grade: best.grade,
      recentMean: best.recentMean,
      baselineMean: best.baselineMean,
      pctChange: best.pctChange,
    },
  };
}
