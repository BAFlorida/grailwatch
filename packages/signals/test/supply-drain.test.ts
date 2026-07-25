import { describe, expect, it } from "vitest";
import { addDays } from "@grailwatch/shared/dates";
import { computeSupplyDrain } from "../src/supply-drain";
import { marketDay } from "./fixtures";
import type { MarketDay } from "../src/types";

const AS_OF = "2026-01-01";

describe("computeSupplyDrain", () => {
  it("sold-change% minus listing-change%, exact arithmetic", () => {
    const rows: MarketDay[] = [];
    for (let age = 0; age <= 59; age++) {
      const sales = age < 30 ? 2 : 1; // 60 recent vs 30 prior → +100%
      // listings 20 near now (ages 0..6), 30 around 30d ago (ages 27..33)
      const listings = age <= 6 ? 20 : age >= 27 && age <= 33 ? 30 : 25;
      rows.push(marketDay(addDays(AS_OF, -age), "psa_9", 100, sales, listings));
    }
    const result = computeSupplyDrain(rows, AS_OF);
    // +100% sold − (−33.33% listings) = +133.33
    expect(result.raw).toBeCloseTo(133.333, 2);
    expect(result.detail.soldChangePct).toBeCloseTo(100, 5);
    expect(result.detail.listingChangePct).toBeCloseTo(-33.333, 2);
    expect(result.normalized).toBe(1); // saturates at +50pp
  });

  it("sums listings across grades", () => {
    const rows: MarketDay[] = [];
    for (let age = 0; age <= 59; age++) {
      const date = addDays(AS_OF, -age);
      rows.push(marketDay(date, "psa_9", 100, 1, age <= 6 ? 10 : 15));
      rows.push(marketDay(date, "raw", 20, 1, age <= 6 ? 10 : 15));
    }
    const result = computeSupplyDrain(rows, AS_OF);
    // sold flat (0%), listings 20 now vs 30 then → −33.33% → raw = +33.33
    expect(result.raw).toBeCloseTo(33.333, 2);
  });

  it("null without listing data", () => {
    const rows: MarketDay[] = [];
    for (let age = 0; age <= 59; age++) {
      rows.push(marketDay(addDays(AS_OF, -age), "psa_9", 100, 1, null));
    }
    expect(computeSupplyDrain(rows, AS_OF).raw).toBeNull();
  });

  it("null with zero sold volume in both windows", () => {
    const rows: MarketDay[] = [];
    for (let age = 0; age <= 59; age++) {
      rows.push(marketDay(addDays(AS_OF, -age), "psa_9", null, 0, 20));
    }
    expect(computeSupplyDrain(rows, AS_OF).raw).toBeNull();
  });

  it("negative when sellers flood the market", () => {
    const rows: MarketDay[] = [];
    for (let age = 0; age <= 59; age++) {
      const listings = age <= 6 ? 40 : age >= 27 && age <= 33 ? 20 : 30; // +100%
      rows.push(marketDay(addDays(AS_OF, -age), "psa_9", 100, 1, listings));
    }
    const result = computeSupplyDrain(rows, AS_OF);
    expect(result.raw).toBeCloseTo(-100, 1);
    expect(result.normalized).toBe(0);
  });
});
