import { describe, expect, it } from "vitest";
import { DEFAULT_SCORING_CONFIG, SIGNAL_NAMES, type SignalName } from "@grailwatch/shared/scoring";
import { computeComposite } from "../src/composite";
import type { SignalValue } from "../src/types";

function sig(raw: number | null, normalized: number | null): SignalValue {
  return { raw, normalized, detail: {} };
}

function build(values: Partial<Record<SignalName, SignalValue>>): Record<SignalName, SignalValue> {
  const out = {} as Record<SignalName, SignalValue>;
  for (const name of SIGNAL_NAMES) out[name] = values[name] ?? sig(null, null);
  return out;
}

describe("computeComposite", () => {
  it("everything maxed → composite 1, triggered", () => {
    const signals = build({
      velocityZ: sig(4, 1),
      supplyDrain: sig(60, 1),
      gradeCompression: sig(0.95, 0.95),
      popDelta: sig(20, 1),
      attentionDivergence: sig(4, 1),
    });
    const r = computeComposite(signals, DEFAULT_SCORING_CONFIG);
    expect(r.composite).toBeCloseTo(0.9925, 4); // 0.15 weight on 0.95
    expect(r.aboveThreshold.length).toBe(5);
    expect(r.triggered).toBe(true);
  });

  it("renormalizes weights over available signals", () => {
    const signals = build({
      velocityZ: sig(2.7, 0.9),
      supplyDrain: sig(40, 0.8),
    });
    const r = computeComposite(signals, DEFAULT_SCORING_CONFIG);
    // (0.25·0.9 + 0.20·0.8) / 0.45
    expect(r.composite).toBeCloseTo((0.25 * 0.9 + 0.2 * 0.8) / 0.45, 6);
  });

  it("a present-but-zero signal still counts against the composite", () => {
    const signals = build({
      velocityZ: sig(3, 1),
      attentionDivergence: sig(-2, 0), // already public — drags composite down
    });
    const r = computeComposite(signals, DEFAULT_SCORING_CONFIG);
    expect(r.composite).toBeCloseTo((0.25 * 1 + 0.3 * 0) / 0.55, 6);
    expect(r.triggered).toBe(false);
  });

  it("requires at least 2 signals above their raw thresholds", () => {
    // composite high but only velocity crosses its threshold
    const signals = build({
      velocityZ: sig(3, 1),
      supplyDrain: sig(20, 0.4), // below 25 threshold
      gradeCompression: sig(0.6, 0.6), // below 0.7
      popDelta: sig(4, 4 / 15), // below 5
      attentionDivergence: sig(1.0, 1 / 3), // below 1.25
    });
    const r = computeComposite(signals, DEFAULT_SCORING_CONFIG);
    expect(r.aboveThreshold).toEqual(["velocityZ"]);
    expect(r.triggered).toBe(false);
  });

  it("triggers exactly at the composite boundary with 2 signals above", () => {
    const signals = build({
      velocityZ: sig(2, 0.65),
      supplyDrain: sig(30, 0.65),
      gradeCompression: sig(0.65, 0.65),
      popDelta: sig(4, 0.65),
      attentionDivergence: sig(1.0, 0.65),
    });
    const r = computeComposite(signals, DEFAULT_SCORING_CONFIG);
    expect(r.composite).toBeCloseTo(0.65, 9);
    expect(r.aboveThreshold).toEqual(["velocityZ", "supplyDrain"]);
    expect(r.triggered).toBe(true);
  });

  it("composite null when nothing is computable", () => {
    const r = computeComposite(build({}), DEFAULT_SCORING_CONFIG);
    expect(r.composite).toBeNull();
    expect(r.triggered).toBe(false);
  });
});
