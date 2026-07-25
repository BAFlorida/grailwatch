import { env } from "@grailwatch/shared/env";
import { CgcPopSource } from "./adapters/cgc-pop";
import {
  CsvAttentionSource,
  CsvMarketSource,
  CsvPopSource,
} from "./adapters/csv";
import { EbayBrowseSource } from "./adapters/ebay";
import { GoogleTrendsSource } from "./adapters/google-trends";
import { PriceChartingSource } from "./adapters/pricecharting";
import { PsaPopSource } from "./adapters/psa-pop";
import type { SourceRegistry } from "./types";

/**
 * THE one registration point. Adding a new market source is:
 *   1. create packages/ingest/src/adapters/<source>.ts implementing MarketSource
 *   2. add one line to the matching array below
 * Sources whose disabled() returns a reason are skipped with a logged warning
 * on every run — a missing key never crashes anything.
 */
export function buildRegistry(): SourceRegistry {
  const csvDir = env.CSV_SOURCE_DIR;
  return {
    market: [
      new CsvMarketSource(csvDir),
      new PriceChartingSource(),
      new EbayBrowseSource(),
    ],
    pop: [
      new CsvPopSource(csvDir),
      new PsaPopSource(),
      new CgcPopSource(),
    ],
    attention: [
      new CsvAttentionSource(csvDir),
      new GoogleTrendsSource(),
    ],
  };
}
