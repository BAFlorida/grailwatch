/**
 * Pure data-in / numbers-out types for the signal engine. No database, no
 * environment — everything here is unit-testable with plain fixtures.
 */

export interface MarketDay {
  /** YYYY-MM-DD */
  date: string;
  /** "raw", "psa_2".."psa_10", "cgc_9_8", "all", ... */
  grade: string;
  avgSalePrice: number | null;
  medianSalePrice?: number | null;
  saleCount: number | null;
  activeListingCount: number | null;
}

export interface PopPoint {
  date: string;
  grader: string;
  grade: string;
  population: number;
}

export interface AttentionPoint {
  date: string;
  score: number;
}

export interface CardSeries {
  market: MarketDay[];
  pop: PopPoint[];
  attention: AttentionPoint[];
}

export interface SignalValue {
  /** raw signal value in its native unit (z, percentage points, 0–1, …) */
  raw: number | null;
  /** raw mapped into 0–1 via the shared normalization scales */
  normalized: number | null;
  /** human-relevant intermediates for reason strings and debugging */
  detail: Record<string, number | string | null>;
}

export const nullSignal = (note: string): SignalValue => ({
  raw: null,
  normalized: null,
  detail: { note },
});
