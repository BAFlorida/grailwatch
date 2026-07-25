import { epochDay } from "@grailwatch/shared/dates";
import { clamp01, normalizeSignal } from "@grailwatch/shared/scoring";
import { gradeNumeric } from "./grades";
import { mean, pearson } from "./stats";
import { nullSignal, type MarketDay, type SignalValue } from "./types";

/**
 * grade_compression — are LOW grades (≤4) being bought up alongside HIGH
 * grades (≥7)? An accumulator sweeps ANY copy, so low-grade prices track
 * high-grade prices; organic hype chases gem mints and leaves lows behind.
 *
 * Method over the last 60 days, in 7-day buckets:
 *   1. per grade, a relative price index (each grade divided by its first
 *      populated bucket) — so $40 PSA 2s and $3,000 PSA 10s are comparable
 *   2. cohort index per bucket = mean of its grades' relative indices
 *   3. lowGrowth / highGrowth = first→last bucket growth per cohort (%)
 *   4. corr = Pearson correlation of the two cohort indices across buckets
 *
 * Score 0–1:
 *   ratioScore  = clamp01((lowGrowth / highGrowth) / 0.7)   — the spec rule:
 *                 low-grade growth ≥ 70% of high-grade growth ⇒ full marks
 *   corrFactor  = 0.5 + 0.5·max(corr, 0)
 *   magnitude   = clamp01(lowGrowth / 5)                    — ±1% noise ≠ signal
 *   raw         = ratioScore · corrFactor · magnitude
 * Special case: highs flat (≤0.5%) while lows move ≥3% — that's accumulation
 * of any copy with no public bid for gems: raw = clamp01(0.7 + lowGrowth/50).
 */
export interface CompressionOptions {
  windowDays: number;
  bucketDays: number;
  lowMax: number;
  highMin: number;
  minBucketsPerCohort: number;
  minMagnitudePct: number;
}

export const DEFAULT_COMPRESSION_OPTS: CompressionOptions = {
  windowDays: 60,
  bucketDays: 7,
  lowMax: 4,
  highMin: 7,
  minBucketsPerCohort: 5,
  minMagnitudePct: 5,
};

export function computeGradeCompression(
  market: MarketDay[],
  asOf: string,
  opts: CompressionOptions = DEFAULT_COMPRESSION_OPTS,
): SignalValue {
  const asOfDay = epochDay(asOf);
  const nBuckets = Math.ceil(opts.windowDays / opts.bucketDays);

  // grade → bucket → prices
  const byGrade = new Map<string, Map<number, number[]>>();
  for (const p of market) {
    if (p.avgSalePrice === null || p.avgSalePrice === undefined) continue;
    if (gradeNumeric(p.grade) === null) continue; // raw/all don't belong to either cohort
    const age = asOfDay - epochDay(p.date);
    if (age < 0 || age >= opts.windowDays) continue;
    const bucket = Math.floor((opts.windowDays - 1 - age) / opts.bucketDays); // 0 = oldest
    let buckets = byGrade.get(p.grade);
    if (!buckets) byGrade.set(p.grade, (buckets = new Map()));
    let arr = buckets.get(bucket);
    if (!arr) buckets.set(bucket, (arr = []));
    arr.push(p.avgSalePrice);
  }

  const cohortSeries = (pred: (n: number) => boolean): (number | null)[] | null => {
    const perGrade: (number | null)[][] = [];
    for (const [grade, buckets] of byGrade) {
      const n = gradeNumeric(grade)!;
      if (!pred(n)) continue;
      const means: (number | null)[] = [];
      for (let b = 0; b < nBuckets; b++) means.push(mean(buckets.get(b) ?? []));
      const firstIdx = means.findIndex((v) => v !== null && v > 0);
      if (firstIdx === -1) continue;
      const base = means[firstIdx]!;
      perGrade.push(means.map((v) => (v === null ? null : v / base)));
    }
    if (perGrade.length === 0) return null;
    const out: (number | null)[] = [];
    for (let b = 0; b < nBuckets; b++) {
      const vals = perGrade
        .map((s) => s[b])
        .filter((v): v is number => v !== null && v !== undefined);
      out.push(vals.length > 0 ? vals.reduce((a, c) => a + c, 0) / vals.length : null);
    }
    return out;
  };

  const low = cohortSeries((n) => n <= opts.lowMax);
  const high = cohortSeries((n) => n >= opts.highMin);
  const presentVals = (s: (number | null)[] | null): number[] =>
    s ? s.filter((v): v is number => v !== null) : [];
  const lowVals = presentVals(low);
  const highVals = presentVals(high);
  if (!low || !high || lowVals.length < opts.minBucketsPerCohort || highVals.length < opts.minBucketsPerCohort) {
    return nullSignal("insufficient low/high grade coverage");
  }

  const growthPct = (vals: number[]): number => ((vals[vals.length - 1]! - vals[0]!) / vals[0]!) * 100;
  const lowGrowth = growthPct(lowVals);
  const highGrowth = growthPct(highVals);

  // correlation of the two cohort price indices, aligned on buckets where
  // both exist. Levels, not deltas: two lockstep ramps have near-perfectly
  // correlated levels, while their bucket-over-bucket deltas degenerate to
  // "constant + independent noise" and correlate at ~0.
  const lowAligned: number[] = [];
  const highAligned: number[] = [];
  for (let b = 0; b < nBuckets; b++) {
    const l = low[b] ?? null;
    const h = high[b] ?? null;
    if (l === null || h === null) continue;
    lowAligned.push(l);
    highAligned.push(h);
  }
  let corr = pearson(lowAligned, highAligned);
  if (corr === null) {
    // zero-variance cohort (dead flat) — fall back to growth alignment
    corr =
      lowGrowth > 0 && highGrowth > 0
        ? Math.min(lowGrowth, highGrowth) / Math.max(lowGrowth, highGrowth)
        : 0;
  }

  let raw: number;
  if (lowGrowth <= 0 && highGrowth <= 0) {
    raw = 0;
  } else if (highGrowth <= 0.5 && lowGrowth >= 3) {
    raw = clamp01(0.7 + lowGrowth / 50);
  } else {
    const ratioScore = clamp01(lowGrowth / Math.max(highGrowth, 1e-9) / 0.7);
    const corrFactor = 0.5 + 0.5 * Math.max(corr, 0);
    const magnitude = clamp01(lowGrowth / opts.minMagnitudePct);
    raw = clamp01(ratioScore * corrFactor * magnitude);
  }

  return {
    raw,
    normalized: normalizeSignal("gradeCompression", raw),
    detail: { lowGrowthPct: lowGrowth, highGrowthPct: highGrowth, corr },
  };
}
