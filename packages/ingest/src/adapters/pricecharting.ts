import { env } from "@grailwatch/shared/env";
import { todayIso } from "@grailwatch/shared/dates";
import { createLogger } from "@grailwatch/shared/logger";
import type { Card } from "@grailwatch/db";
import { fetchJson, throttled } from "../http";
import { errorMessage, type MarketSnapshotInput, type MarketSource } from "../types";

const log = createLogger("pricecharting");

const API_BASE = "https://www.pricecharting.com/api";

/**
 * PriceCharting's API reuses its legacy video-game price fields for graded
 * trading cards (documented at pricecharting.com/api-documentation):
 *   loose-price       → ungraded          cib-price   → Grade 7
 *   new-price         → Grade 8           graded-price → Grade 9
 *   box-only-price    → Grade 9.5         manual-only-price → PSA 10
 * All prices are integer pennies.
 */
const FIELD_TO_GRADE: readonly [field: string, grade: string][] = [
  ["loose-price", "raw"],
  ["cib-price", "psa_7"],
  ["new-price", "psa_8"],
  ["graded-price", "psa_9"],
  ["box-only-price", "psa_9_5"],
  ["manual-only-price", "psa_10"],
];

interface PcProduct {
  id?: string;
  "product-name"?: string;
  "console-name"?: string;
  "sales-volume"?: number | string;
  [priceField: string]: unknown;
}

interface PcSearchResponse {
  status?: string;
  products?: PcProduct[];
}

function centsToDollars(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  return Number.isFinite(n) && n > 0 ? n / 100 : null;
}

export class PriceChartingSource implements MarketSource {
  name = "pricecharting";

  disabled(): string | null {
    return env.PRICECHARTING_API_KEY ? null : "PRICECHARTING_API_KEY not set";
  }

  async fetchSnapshots(cards: Card[]): Promise<MarketSnapshotInput[]> {
    const key = env.PRICECHARTING_API_KEY!;
    const gate = throttled(250);
    const today = todayIso();
    const out: MarketSnapshotInput[] = [];

    for (const card of cards) {
      try {
        await gate();
        const query = [card.name, card.setName].filter(Boolean).join(" ");
        const search = await fetchJson<PcSearchResponse>(
          `${API_BASE}/products?t=${encodeURIComponent(key)}&q=${encodeURIComponent(query)}`,
        );
        const productId = search.products?.[0]?.id;
        if (!productId) {
          log.debug(`no product match for "${query}"`);
          continue;
        }

        await gate();
        const product = await fetchJson<PcProduct>(
          `${API_BASE}/product?t=${encodeURIComponent(key)}&id=${encodeURIComponent(productId)}`,
        );

        for (const [field, grade] of FIELD_TO_GRADE) {
          const price = centsToDollars(product[field]);
          if (price === null) continue;
          out.push({
            cardId: card.id,
            grade,
            snapshotDate: today,
            avgSalePrice: price,
            medianSalePrice: null,
            saleCount: null,
            activeListingCount: null,
            source: "pricecharting",
          });
        }

        // overall sold volume arrives per product, not per grade — keep it on
        // an aggregate row so supply-drain can still see volume moving
        const volume = Number(product["sales-volume"]);
        if (Number.isFinite(volume) && volume >= 0) {
          out.push({
            cardId: card.id,
            grade: "all",
            snapshotDate: today,
            avgSalePrice: null,
            medianSalePrice: null,
            saleCount: Math.trunc(volume),
            activeListingCount: null,
            source: "pricecharting",
          });
        }
      } catch (err) {
        log.warn(`${card.name}: ${errorMessage(err)} — continuing with next card`);
      }
    }
    return out;
  }
}
