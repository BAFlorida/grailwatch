/**
 * Shared scoring vocabulary: signal names, config shape, defaults, and the
 * raw→[0,1] normalization used before weighting. Pure constants — safe to
 * import from anywhere (including the pure signal engine).
 */

export const SIGNAL_NAMES = [
  "velocityZ",
  "supplyDrain",
  "gradeCompression",
  "popDelta",
  "attentionDivergence",
] as const;

export type SignalName = (typeof SIGNAL_NAMES)[number];

export const SIGNAL_LABELS: Record<SignalName, string> = {
  velocityZ: "Velocity Z",
  supplyDrain: "Supply Drain",
  gradeCompression: "Grade Compression",
  popDelta: "Pop Delta",
  attentionDivergence: "Attention Divergence",
};

export interface ScoringConfig {
  /**
   * Relative weight per signal. When a signal can't be computed for a card
   * (null), the remaining weights are renormalized so the composite stays 0–1.
   */
  weights: Record<SignalName, number>;
  /** Trigger thresholds compared against RAW signal values (not normalized). */
  thresholds: Record<SignalName, number>;
  /** Composite score (0–1) at or above which a card can trigger. */
  compositeTrigger: number;
  /** Minimum count of individual signals above their raw thresholds. */
  minSignalsAbove: number;
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  weights: {
    attentionDivergence: 0.3,
    velocityZ: 0.25,
    supplyDrain: 0.2,
    gradeCompression: 0.15,
    popDelta: 0.1,
  },
  thresholds: {
    velocityZ: 1.5, // z-score
    supplyDrain: 25, // percentage points (sold Δ% − active-listing Δ%)
    gradeCompression: 0.7, // 0–1 score
    popDelta: 5, // percentage points above the card's own 12-month norm
    attentionDivergence: 1.25, // z-like units
  },
  compositeTrigger: 0.65,
  minSignalsAbove: 2,
};

/**
 * Saturation caps for normalizing raw signal values into 0–1 before weighting.
 * raw >= cap → 1.0; raw <= 0 → 0.
 */
export const NORMALIZATION_SCALE: Record<SignalName, number> = {
  velocityZ: 3, // a 3-sigma move saturates
  supplyDrain: 50, // +50pp sold-vs-listings divergence saturates
  gradeCompression: 1, // already 0–1
  popDelta: 15, // +15pp over the card's own norm saturates
  attentionDivergence: 3, // z-like 3+ saturates
};

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function normalizeSignal(name: SignalName, raw: number | null): number | null {
  if (raw === null || !Number.isFinite(raw)) return null;
  return clamp01(raw / NORMALIZATION_SCALE[name]);
}

/** Key of the scoring config row in the app_config table. */
export const CONFIG_KEY_SCORING = "scoring";
