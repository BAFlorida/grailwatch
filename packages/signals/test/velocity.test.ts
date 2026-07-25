import { describe, expect, it } from "vitest";
import { addDays } from "@grailwatch/shared/dates";
import { computeVelocityZ } from "../src/velocity";
import { marketDay } from "./fixtures";
import type { MarketDay } from "../src/types";

const AS_OF = "2026-01-01";

/** baseline (ages 30..209): alternating 95/105 (mean 100, sd 5); recent (0..29): 110 */
function series(grade = "psa_10"): MarketDay[] {
  const rows: MarketDay[] = [];
  for (let age = 0; age <= 209; age++) {
    const date = addDays(AS_OF, -age);
    const price = age < 30 ? 110 : age % 2 === 0 ? 95 : 105;
    rows.push(marketDay(date, grade, price, 1));
  }
  return rows;
}

describe("computeVelocityZ", () => {
  it("computes an exact z-score against the 180-day baseline", () => {
    const result = computeVelocityZ(series(), AS_OF);
    // (110 - 100) / 5 = 2.0
    expect(result.raw).toBeCloseTo(2.0, 6);
    expect(result.normalized).toBeCloseTo(2 / 3, 6);
    expect(result.detail.grade).toBe("psa_10");
    expect(result.detail.baselineMean).toBeCloseTo(100, 6);
    expect(result.detail.recentMean).toBeCloseTo(110, 6);
  });

  it("takes the max across grades", () => {
    const flat: MarketDay[] = [];
    for (let age = 0; age <= 209; age++) {
      flat.push(marketDay(addDays(AS_OF, -age), "psa_4", 100, 1));
    }
    const result = computeVelocityZ([...series("psa_10"), ...flat], AS_OF);
    expect(result.detail.grade).toBe("psa_10");
    expect(result.raw).toBeCloseTo(2.0, 6);
  });

  it("returns null with fewer than 10 baseline sales", () => {
    // plenty of priced days, but only 9 actual sales in the baseline
    const rows: MarketDay[] = [];
    for (let age = 0; age <= 209; age++) {
      const price = age < 30 ? 110 : age % 2 === 0 ? 95 : 105;
      const sales = age >= 30 && age < 39 ? 1 : 0;
      rows.push(marketDay(addDays(AS_OF, -age), "psa_10", price, sales));
    }
    const result = computeVelocityZ(rows, AS_OF);
    expect(result.raw).toBeNull();
    expect(result.normalized).toBeNull();
  });

  it("returns null with no data at all", () => {
    expect(computeVelocityZ([], AS_OF).raw).toBeNull();
  });

  it("scores a flat market at ~zero", () => {
    const rows: MarketDay[] = [];
    for (let age = 0; age <= 209; age++) {
      rows.push(marketDay(addDays(AS_OF, -age), "psa_10", age % 2 === 0 ? 95 : 105, 1));
    }
    const result = computeVelocityZ(rows, AS_OF);
    expect(Math.abs(result.raw!)).toBeLessThan(0.15);
  });
});
