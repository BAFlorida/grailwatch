import { describe, expect, it } from "vitest";
import { linregSlope, mean, pearson, stddev, sum } from "../src/stats";

describe("stats", () => {
  it("sum and mean", () => {
    expect(sum([1, 2, 3])).toBe(6);
    expect(mean([1, 2, 3])).toBe(2);
    expect(mean([])).toBeNull();
  });

  it("population stddev", () => {
    // classic textbook set: population sd exactly 2
    expect(stddev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2, 10);
    expect(stddev([5])).toBeNull();
    // alternating ±5 around 100 → sd exactly 5
    expect(stddev([95, 105, 95, 105, 95, 105])).toBeCloseTo(5, 10);
  });

  it("pearson correlation", () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 10);
    expect(pearson([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1, 10);
    expect(pearson([1, 2], [1, 2])).toBeNull(); // too few
    expect(pearson([1, 1, 1], [1, 2, 3])).toBeNull(); // zero variance
  });

  it("linear regression slope", () => {
    expect(linregSlope([0, 1, 2, 3], [1, 3, 5, 7])).toBeCloseTo(2, 10);
    expect(linregSlope([0, 1, 2], [5, 5, 5])).toBeCloseTo(0, 10);
    expect(linregSlope([1, 1], [1, 2])).toBeNull(); // zero x variance
  });
});
