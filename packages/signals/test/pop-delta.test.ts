import { describe, expect, it } from "vitest";
import { addDays } from "@grailwatch/shared/dates";
import { computePopDelta } from "../src/pop-delta";
import type { PopPoint } from "../src/types";

const AS_OF = "2026-01-01";

/** 15 monthly snapshots; totals per age given by fn(ageDays) */
function popSeries(totalAt: (ageDays: number) => number): PopPoint[] {
  const rows: PopPoint[] = [];
  for (let i = 0; i < 15; i++) {
    const age = (14 - i) * 30;
    const total = totalAt(age);
    // split across two grades to exercise the step-function summing
    rows.push({ date: addDays(AS_OF, -age), grader: "psa", grade: "psa_9", population: Math.round(total * 0.6) });
    rows.push({ date: addDays(AS_OF, -age), grader: "psa", grade: "psa_7", population: Math.round(total * 0.4) });
  }
  return rows;
}

describe("computePopDelta", () => {
  it("flags a dead card suddenly getting graded", () => {
    // flat at 1000 for a year, then 1050 / 1100 in the last two snapshots
    const rows = popSeries((age) => (age === 0 ? 1100 : age === 30 ? 1050 : 1000));
    const result = computePopDelta(rows, AS_OF);
    // current 60d: 1100 vs 1000 → +10%; norm windows all 0% → raw = 10
    expect(result.raw).toBeCloseTo(10, 5);
    expect(result.detail.normPct).toBeCloseTo(0, 5);
    expect(result.normalized).toBeCloseTo(10 / 15, 5);
  });

  it("steady growth nets out against the card's own norm", () => {
    // ~1%/month forever → current 60d ≈ norm → raw ≈ 0
    const rows = popSeries((age) => 1000 * Math.pow(1.01, (420 - age) / 30));
    const result = computePopDelta(rows, AS_OF);
    expect(Math.abs(result.raw!)).toBeLessThan(0.5);
  });

  it("null without enough history for a norm", () => {
    const rows: PopPoint[] = [0, 30, 60].map((age) => ({
      date: addDays(AS_OF, -age),
      grader: "psa",
      grade: "psa_9",
      population: 1000,
    }));
    expect(computePopDelta(rows, AS_OF).raw).toBeNull();
  });

  it("null with no data", () => {
    expect(computePopDelta([], AS_OF).raw).toBeNull();
  });
});
