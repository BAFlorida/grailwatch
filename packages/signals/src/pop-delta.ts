import { epochDay } from "@grailwatch/shared/dates";
import { normalizeSignal } from "@grailwatch/shared/scoring";
import { mean } from "./stats";
import { nullSignal, type PopPoint, type SignalValue } from "./types";

/**
 * pop_delta — % change in TOTAL graded population over the last 60 days minus
 * the card's own 12-month norm for 60-day changes (sampled at monthly
 * offsets). A dead card suddenly getting slabbed = inventory being prepped
 * for a reveal.
 *
 * Population is a step function per (grader, grade): the latest snapshot at or
 * before a date counts. Needs enough history for ≥ minNormSamples norm
 * windows, else null.
 */
export interface PopDeltaOptions {
  windowDays: number;
  normStepDays: number;
  maxNormSamples: number;
  minNormSamples: number;
}

export const DEFAULT_POP_DELTA_OPTS: PopDeltaOptions = {
  windowDays: 60,
  normStepDays: 30,
  maxNormSamples: 11,
  minNormSamples: 3,
};

export function computePopDelta(
  pop: PopPoint[],
  asOf: string,
  opts: PopDeltaOptions = DEFAULT_POP_DELTA_OPTS,
): SignalValue {
  if (pop.length === 0) return nullSignal("no pop data");
  const asOfDay = epochDay(asOf);

  const series = new Map<string, { day: number; population: number }[]>();
  for (const p of pop) {
    const key = `${p.grader}|${p.grade}`;
    let arr = series.get(key);
    if (!arr) series.set(key, (arr = []));
    arr.push({ day: epochDay(p.date), population: p.population });
  }
  for (const arr of series.values()) arr.sort((a, b) => a.day - b.day);

  const totalAt = (day: number): number | null => {
    let total = 0;
    let found = false;
    for (const arr of series.values()) {
      let val: number | null = null;
      for (const pt of arr) {
        if (pt.day <= day) val = pt.population;
        else break;
      }
      if (val !== null) {
        total += val;
        found = true;
      }
    }
    return found ? total : null;
  };

  const now = totalAt(asOfDay);
  const then = totalAt(asOfDay - opts.windowDays);
  if (now === null || then === null || then <= 0) return nullSignal("insufficient pop history");
  const curPct = ((now - then) / then) * 100;

  const samples: number[] = [];
  for (let k = 2; k < 2 + opts.maxNormSamples; k++) {
    const t = asOfDay - k * opts.normStepDays;
    const a = totalAt(t);
    const b = totalAt(t - opts.windowDays);
    if (a === null || b === null || b <= 0) continue;
    samples.push(((a - b) / b) * 100);
  }
  if (samples.length < opts.minNormSamples) {
    return nullSignal("not enough history for a 12-month norm");
  }
  const normPct = mean(samples)!;
  const raw = curPct - normPct;

  return {
    raw,
    normalized: normalizeSignal("popDelta", raw),
    detail: { curPct, normPct, populationNow: now, population60dAgo: then },
  };
}
