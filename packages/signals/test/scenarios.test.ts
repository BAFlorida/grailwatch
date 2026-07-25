/**
 * The three fixture proofs the build spec demands:
 *   1. a synthetic "quiet accumulation" series TRIGGERS
 *   2. an "already viral" series does NOT trigger
 *   3. a flat market scores near zero
 */
import { describe, expect, it } from "vitest";
import { computeCardSignals } from "../src/index";
import { buildSeries, FIXTURE_END } from "./fixtures";

describe("end-to-end scenarios", () => {
  it("quiet accumulation triggers", () => {
    const result = computeCardSignals(buildSeries("accumulation"), FIXTURE_END);

    expect(result.composite).not.toBeNull();
    expect(result.composite!).toBeGreaterThanOrEqual(0.65);
    expect(result.aboveThreshold.length).toBeGreaterThanOrEqual(2);
    expect(result.triggered).toBe(true);

    // the tell-tale shape: price moving, listings draining, attention flat
    expect(result.signals.velocityZ.raw!).toBeGreaterThan(1.5);
    expect(result.signals.supplyDrain.raw!).toBeGreaterThan(25);
    expect(result.signals.gradeCompression.raw!).toBeGreaterThanOrEqual(0.7);
    expect(result.signals.attentionDivergence.raw!).toBeGreaterThan(1.25);

    // and it can explain itself
    expect(result.reasons.length).toBeGreaterThanOrEqual(2);
  });

  it("already-viral does not trigger", () => {
    const result = computeCardSignals(buildSeries("viral"), FIXTURE_END);

    // price is absolutely moving…
    expect(result.signals.velocityZ.raw!).toBeGreaterThan(1.5);
    // …but attention is moving with it, so the core signal dies
    expect(result.signals.attentionDivergence.normalized!).toBeLessThanOrEqual(0.05);
    // and sellers flooding in keeps supply drain from looking like a cleanout
    expect(result.composite!).toBeLessThan(0.65);
    expect(result.triggered).toBe(false);
  });

  it("flat market scores near zero", () => {
    const result = computeCardSignals(buildSeries("flat"), FIXTURE_END);

    expect(result.composite).not.toBeNull();
    expect(result.composite!).toBeLessThan(0.15);
    expect(result.triggered).toBe(false);
    expect(Math.abs(result.signals.velocityZ.raw!)).toBeLessThan(1);
    expect(result.signals.gradeCompression.raw!).toBeLessThan(0.3);
  });

  it("is deterministic for a fixed seed", () => {
    const a = computeCardSignals(buildSeries("accumulation", 42), FIXTURE_END);
    const b = computeCardSignals(buildSeries("accumulation", 42), FIXTURE_END);
    expect(a.composite).toBe(b.composite);
    expect(a.signals.velocityZ.raw).toBe(b.signals.velocityZ.raw);
  });
});
