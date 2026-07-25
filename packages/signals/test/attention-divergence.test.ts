import { describe, expect, it } from "vitest";
import { addDays } from "@grailwatch/shared/dates";
import { computeAttentionDivergence } from "../src/attention-divergence";
import type { AttentionPoint } from "../src/types";

const AS_OF = "2026-01-01";

function flatAttention(level: number, days = 180): AttentionPoint[] {
  const rows: AttentionPoint[] = [];
  for (let age = 0; age < days; age++) {
    rows.push({ date: addDays(AS_OF, -age), score: level });
  }
  return rows;
}

/** flat baseline at `from`, then linear ramp from→to across the last 60 days */
function rampAttention(from: number, to: number, days = 180): AttentionPoint[] {
  const rows: AttentionPoint[] = [];
  for (let age = 0; age < days; age++) {
    const score = age < 60 ? from + (to - from) * ((59 - age) / 59) : from;
    rows.push({ date: addDays(AS_OF, -age), score });
  }
  return rows;
}

describe("computeAttentionDivergence", () => {
  it("high velocity + flat attention = full divergence", () => {
    const result = computeAttentionDivergence(2.5, flatAttention(20), AS_OF);
    expect(result.raw).toBeCloseTo(2.5, 6);
    expect(result.normalized).toBeCloseTo(2.5 / 3, 6);
  });

  it("attention explosion cancels (and inverts) the divergence", () => {
    // 15 → 90 against a baseline level of 15: slope ≈ 76.3/60d ≈ +509% of baseline
    const result = computeAttentionDivergence(2.5, rampAttention(15, 90), AS_OF);
    expect(result.raw).toBeLessThan(0);
    expect(result.normalized).toBe(0);
  });

  it("mild attention drift only dents the divergence", () => {
    const result = computeAttentionDivergence(2.5, rampAttention(20, 24), AS_OF);
    // +20% over window vs baseline 20 → component ≈ 0.6 → raw ≈ 1.9
    expect(result.raw).toBeGreaterThan(1.5);
    expect(result.raw).toBeLessThan(2.5);
  });

  it("null when velocity is unavailable", () => {
    expect(computeAttentionDivergence(null, flatAttention(20), AS_OF).raw).toBeNull();
  });

  it("null with insufficient attention points", () => {
    expect(computeAttentionDivergence(2.5, flatAttention(20, 5), AS_OF).raw).toBeNull();
  });
});
