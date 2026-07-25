import { env } from "@grailwatch/shared/env";
import { todayIso } from "@grailwatch/shared/dates";
import { createLogger } from "@grailwatch/shared/logger";
import type { Card } from "@grailwatch/db";
import { fetchJson, throttled } from "../http";
import { errorMessage, type MarketSnapshotInput, type MarketSource } from "../types";

const log = createLogger("ebay");

/**
 * eBay Browse API: active-listing counts per card query. This feeds the
 * supply-drain signal's listing side. Uses the application (client
 * credentials) OAuth flow, which needs BOTH the App ID and Cert ID.
 * Counts land on grade "all" — they are per-query, not per-grade.
 */
interface EbayTokenResponse {
  access_token: string;
  expires_in: number;
}

interface EbaySearchResponse {
  total?: number;
}

export class EbayBrowseSource implements MarketSource {
  name = "ebay_browse";

  private token: { value: string; expiresAt: number } | null = null;

  disabled(): string | null {
    if (!env.EBAY_APP_ID) return "EBAY_APP_ID not set";
    if (!env.EBAY_CERT_ID) return "EBAY_CERT_ID not set (client-credentials flow needs both keys)";
    return null;
  }

  private apiBase(): string {
    return env.EBAY_ENV === "sandbox" ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
  }

  private async getToken(): Promise<string> {
    if (this.token && Date.now() < this.token.expiresAt - 60_000) return this.token.value;
    const basic = Buffer.from(`${env.EBAY_APP_ID}:${env.EBAY_CERT_ID}`).toString("base64");
    const json = await fetchJson<EbayTokenResponse>(`${this.apiBase()}/identity/v1/oauth2/token`, {
      method: "POST",
      headers: {
        authorization: `Basic ${basic}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        scope: "https://api.ebay.com/oauth/api_scope",
      }).toString(),
    });
    this.token = {
      value: json.access_token,
      expiresAt: Date.now() + json.expires_in * 1000,
    };
    return json.access_token;
  }

  async fetchSnapshots(cards: Card[]): Promise<MarketSnapshotInput[]> {
    const gate = throttled(200);
    const today = todayIso();
    const out: MarketSnapshotInput[] = [];

    for (const card of cards) {
      try {
        await gate();
        const token = await this.getToken();
        const query = [card.name, card.setName].filter(Boolean).join(" ");
        const url = `${this.apiBase()}/buy/browse/v1/item_summary/search?q=${encodeURIComponent(
          query,
        )}&limit=1`;
        const result = await fetchJson<EbaySearchResponse>(url, {
          headers: {
            authorization: `Bearer ${token}`,
            "x-ebay-c-marketplace-id": "EBAY_US",
          },
        });
        if (typeof result.total !== "number") continue;
        out.push({
          cardId: card.id,
          grade: "all",
          snapshotDate: today,
          avgSalePrice: null,
          medianSalePrice: null,
          saleCount: null,
          activeListingCount: result.total,
          source: "ebay_browse",
        });
      } catch (err) {
        log.warn(`${card.name}: ${errorMessage(err)} — continuing with next card`);
      }
    }
    return out;
  }
}
