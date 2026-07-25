import {
  DEFAULT_SCORING_CONFIG,
  type ScoringConfig,
  type SignalName,
} from "@grailwatch/shared/scoring";
import { computeAttentionDivergence } from "./attention-divergence";
import { computeComposite } from "./composite";
import { computeGradeCompression } from "./grade-compression";
import { computePopDelta } from "./pop-delta";
import { buildReasons } from "./reasons";
import { computeSupplyDrain } from "./supply-drain";
import type { CardSeries, SignalValue } from "./types";
import { computeVelocityZ } from "./velocity";

export interface CardSignalResult {
  signals: Record<SignalName, SignalValue>;
  composite: number | null;
  triggered: boolean;
  aboveThreshold: SignalName[];
  reasons: string[];
}

/**
 * Run the full nightly scoring pipeline for one card, as of a given date.
 * Pure: series in, scores out.
 */
export function computeCardSignals(
  series: CardSeries,
  asOf: string,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): CardSignalResult {
  const velocityZ = computeVelocityZ(series.market, asOf);
  const supplyDrain = computeSupplyDrain(series.market, asOf);
  const gradeCompression = computeGradeCompression(series.market, asOf);
  const popDelta = computePopDelta(series.pop, asOf);
  const attentionDivergence = computeAttentionDivergence(
    velocityZ.raw,
    series.attention,
    asOf,
  );

  const signals: Record<SignalName, SignalValue> = {
    velocityZ,
    supplyDrain,
    gradeCompression,
    popDelta,
    attentionDivergence,
  };

  const { composite, triggered, aboveThreshold } = computeComposite(signals, config);
  const reasons = buildReasons(signals, config);

  return { signals, composite, triggered, aboveThreshold, reasons };
}

export * from "./types";
export * from "./stats";
export * from "./grades";
export { computeVelocityZ, DEFAULT_VELOCITY_OPTS, type VelocityOptions } from "./velocity";
export {
  computeSupplyDrain,
  DEFAULT_SUPPLY_DRAIN_OPTS,
  type SupplyDrainOptions,
} from "./supply-drain";
export {
  computeGradeCompression,
  DEFAULT_COMPRESSION_OPTS,
  type CompressionOptions,
} from "./grade-compression";
export { computePopDelta, DEFAULT_POP_DELTA_OPTS, type PopDeltaOptions } from "./pop-delta";
export {
  computeAttentionDivergence,
  DEFAULT_DIVERGENCE_OPTS,
  type DivergenceOptions,
} from "./attention-divergence";
export { computeComposite, type CompositeResult } from "./composite";
export { buildReasons } from "./reasons";
export {
  SIGNAL_NAMES,
  SIGNAL_LABELS,
  DEFAULT_SCORING_CONFIG,
  NORMALIZATION_SCALE,
  CONFIG_KEY_SCORING,
  clamp01,
  normalizeSignal,
} from "@grailwatch/shared/scoring";
export type { ScoringConfig, SignalName } from "@grailwatch/shared/scoring";
