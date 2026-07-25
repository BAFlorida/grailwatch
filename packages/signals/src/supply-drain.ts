import { epochDay } from "@grailwatch/shared/dates";
import { normalizeSignal } from "@grailwatch/shared/scoring";
import { mean } from "./stats";
import { nullSignal, type MarketDay, type SignalValue } from "./types";

/**
 * supply_drain — (Δ sold volume over 30d as %) − (Δ active listings over 30d
 * as %). Sold volume compares the last 30 days to the 30 days before; listing
 * counts compare a 7-day smoothed level now vs 30 days ago, summed across all
 * grade rows (so per-grade sources and aggregate "all" rows both count).
 *
 * Large positive = the book is being cleared: buying accelerating while the
 * shelf empties.
 */
export interface SupplyDrainOptions {
  soldWindowDays: number;
  listingSmoothDays: number;
}

export const DEFAULT_SUPPLY_DRAIN_OPTS: SupplyDrainOptions = {
  soldWindowDays: 30,
  listingSmoothDays: 7,
};

export function computeSupplyDrain(
  market: MarketDay[],
  asOf: string,
  opts: SupplyDrainOptions = DEFAULT_SUPPLY_DRAIN_OPTS,
): SignalValue {
  const asOfDay = epochDay(asOf);
  const W = opts.soldWindowDays;
  const half = Math.floor(opts.listingSmoothDays / 2);

  let soldRecent = 0;
  let soldPrev = 0;
  const listingsByAge = new Map<number, number>();

  for (const p of market) {
    const age = asOfDay - epochDay(p.date);
    if (age < 0) continue;
    if (p.saleCount) {
      if (age < W) soldRecent += p.saleCount;
      else if (age < 2 * W) soldPrev += p.saleCount;
    }
    if (p.activeListingCount !== null && p.activeListingCount !== undefined && age <= W + half) {
      listingsByAge.set(age, (listingsByAge.get(age) ?? 0) + p.activeListingCount);
    }
  }

  const listingLevel = (centerAge: number): number | null => {
    const vals: number[] = [];
    for (let a = centerAge - half; a <= centerAge + half; a++) {
      const v = listingsByAge.get(a);
      if (v !== undefined) vals.push(v);
    }
    return mean(vals);
  };

  if (soldRecent + soldPrev === 0) return nullSignal("no sold volume in the last 60 days");
  const listingsNow = listingLevel(half);
  const listingsThen = listingLevel(W);
  if (listingsNow === null || listingsThen === null || listingsThen <= 0) {
    return nullSignal("no active-listing data");
  }

  const soldChangePct = ((soldRecent - soldPrev) / Math.max(soldPrev, 1)) * 100;
  const listingChangePct = ((listingsNow - listingsThen) / listingsThen) * 100;
  const raw = soldChangePct - listingChangePct;

  return {
    raw,
    normalized: normalizeSignal("supplyDrain", raw),
    detail: {
      soldChangePct,
      listingChangePct,
      soldRecent,
      soldPrev,
      listingsNow,
      listingsThen,
    },
  };
}
