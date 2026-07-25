import { describe, expect, it } from "vitest";
import { addDays } from "@grailwatch/shared/dates";
import { computeGradeCompression } from "../src/grade-compression";
import { marketDay, mulberry32 } from "./fixtures";
import type { MarketDay } from "../src/types";

const AS_OF = "2026-01-01";

/** t = 0 (oldest, 59d ago) .. 59 (as-of day) */
function ramp(grade: string, base: number, growth: number, noise = 0, seed = 3): MarketDay[] {
  const rnd = mulberry32(seed);
  const rows: MarketDay[] = [];
  for (let t = 0; t <= 59; t++) {
    const price = base * (1 + growth * (t / 59)) * (1 + (rnd() - 0.5) * noise);
    rows.push(marketDay(addDays(AS_OF, t - 59), grade, price, 1));
  }
  return rows;
}

describe("computeGradeCompression", () => {
  it("scores lockstep low/high growth near 1", () => {
    const rows = [
      ...ramp("psa_2", 35, 0.3),
      ...ramp("psa_4", 70, 0.28),
      ...ramp("psa_9", 420, 0.32),
      ...ramp("psa_10", 1000, 0.3),
    ];
    const result = computeGradeCompression(rows, AS_OF);
    expect(result.raw).toBeGreaterThanOrEqual(0.85);
    expect(result.raw).toBeGreaterThanOrEqual(0.7); // above default trigger threshold
  });

  it("scores organic hype (highs spike, lows lag) low", () => {
    const rows = [
      ...ramp("psa_2", 35, 0.04, 0.02),
      ...ramp("psa_4", 70, 0.05, 0.02),
      ...ramp("psa_9", 420, 0.5, 0.02),
      ...ramp("psa_10", 1000, 0.55, 0.02),
    ];
    const result = computeGradeCompression(rows, AS_OF);
    expect(result.raw).toBeLessThan(0.4);
  });

  it("scores lows moving while highs sit still as accumulation", () => {
    const rows = [
      ...ramp("psa_2", 35, 0.1),
      ...ramp("psa_4", 70, 0.09),
      ...ramp("psa_9", 420, 0.0),
      ...ramp("psa_10", 1000, 0.002),
    ];
    const result = computeGradeCompression(rows, AS_OF);
    expect(result.raw).toBeGreaterThanOrEqual(0.7);
  });

  it("scores a flat noisy market near zero", () => {
    const rows = [
      ...ramp("psa_2", 35, 0, 0.04, 11),
      ...ramp("psa_4", 70, 0, 0.04, 12),
      ...ramp("psa_9", 420, 0, 0.04, 13),
      ...ramp("psa_10", 1000, 0, 0.04, 14),
    ];
    const result = computeGradeCompression(rows, AS_OF);
    expect(result.raw).toBeLessThan(0.2);
  });

  it("null when a cohort is missing", () => {
    const rows = [...ramp("psa_9", 420, 0.3), ...ramp("psa_10", 1000, 0.3)];
    expect(computeGradeCompression(rows, AS_OF).raw).toBeNull();
  });

  it("ignores raw and 'all' rows (no cohort)", () => {
    const rows = [
      ...ramp("raw", 30, 5.0), // wild raw growth must not fabricate a low cohort
      ...ramp("psa_9", 420, 0.3),
      ...ramp("psa_10", 1000, 0.3),
    ];
    expect(computeGradeCompression(rows, AS_OF).raw).toBeNull();
  });
});
