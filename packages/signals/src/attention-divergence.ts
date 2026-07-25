import { epochDay } from "@grailwatch/shared/dates";
import { normalizeSignal } from "@grailwatch/shared/scoring";
import { linregSlope, mean } from "./stats";
import { nullSignal, type AttentionPoint, type SignalValue } from "./types";

/**
 * attention_divergence — THE core signal: velocity_z minus the normalized
 * attention trend slope.
 *
 * The attention slope is a least-squares fit over the trailing 60 days,
 * normalized to "% change over the window relative to the PRE-window baseline
 * level" (the prior 120 days; window mean when no prior data). That makes
 * 15→90 explosions register as several z-equivalents even though Google
 * Trends caps at 100. The normalized slope converts to z-like units at
 * +33% over the window ≈ 1.0 (attentionZScale = 3).
 *
 *   raw = velocity_z − (relSlope · attentionZScale)
 *
 * High price velocity + flat attention ⇒ large positive = quiet accumulation.
 * High both ⇒ ~0 or negative = already public, deprioritized.
 */
export interface DivergenceOptions {
  windowDays: number;
  minPoints: number;
  baselineDays: number;
  attentionZScale: number;
}

export const DEFAULT_DIVERGENCE_OPTS: DivergenceOptions = {
  windowDays: 60,
  minPoints: 14,
  baselineDays: 120,
  attentionZScale: 3,
};

export function computeAttentionDivergence(
  velocityZ: number | null,
  attention: AttentionPoint[],
  asOf: string,
  opts: DivergenceOptions = DEFAULT_DIVERGENCE_OPTS,
): SignalValue {
  if (velocityZ === null) return nullSignal("velocity unavailable");
  const asOfDay = epochDay(asOf);

  const window: { x: number; y: number }[] = [];
  const baselineScores: number[] = [];
  for (const p of attention) {
    const age = asOfDay - epochDay(p.date);
    if (age < 0) continue;
    if (age < opts.windowDays) window.push({ x: -age, y: p.score });
    else if (age < opts.windowDays + opts.baselineDays) baselineScores.push(p.score);
  }
  if (window.length < opts.minPoints) return nullSignal("insufficient attention data");

  const slope = linregSlope(
    window.map((p) => p.x),
    window.map((p) => p.y),
  );
  if (slope === null) return nullSignal("attention slope undefined");

  const windowMean = mean(window.map((p) => p.y))!;
  const baselineLevel = Math.max(
    baselineScores.length >= 10 ? mean(baselineScores)! : windowMean,
    1,
  );
  const attentionSlopePct = ((slope * opts.windowDays) / baselineLevel) * 100;
  const attentionComponent = (attentionSlopePct / 100) * opts.attentionZScale;
  const raw = velocityZ - attentionComponent;

  return {
    raw,
    normalized: normalizeSignal("attentionDivergence", raw),
    detail: { velocityZ, attentionSlopePct, attentionBaselineLevel: baselineLevel },
  };
}
