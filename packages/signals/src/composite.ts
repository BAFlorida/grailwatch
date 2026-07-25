import { SIGNAL_NAMES, type ScoringConfig, type SignalName } from "@grailwatch/shared/scoring";
import type { SignalValue } from "./types";

export interface CompositeResult {
  composite: number | null;
  triggered: boolean;
  aboveThreshold: SignalName[];
}

/**
 * composite = Σ weightᵢ · normalizedᵢ / Σ weightᵢ over the signals that could
 * be computed (null signals drop out and the remaining weights renormalize —
 * a signal that computed to zero still counts against the composite).
 *
 * triggered = composite ≥ compositeTrigger AND at least minSignalsAbove
 * individual RAW signals at/above their own thresholds.
 */
export function computeComposite(
  signals: Record<SignalName, SignalValue>,
  config: ScoringConfig,
): CompositeResult {
  let weightSum = 0;
  let acc = 0;
  for (const name of SIGNAL_NAMES) {
    const s = signals[name];
    if (s.normalized === null) continue;
    const w = config.weights[name] ?? 0;
    weightSum += w;
    acc += w * s.normalized;
  }
  const composite = weightSum > 0 ? acc / weightSum : null;

  const aboveThreshold = SIGNAL_NAMES.filter((name) => {
    const raw = signals[name].raw;
    const threshold = config.thresholds[name];
    return raw !== null && threshold !== undefined && raw >= threshold;
  });

  const triggered =
    composite !== null &&
    composite >= config.compositeTrigger &&
    aboveThreshold.length >= config.minSignalsAbove;

  return { composite, triggered, aboveThreshold };
}
