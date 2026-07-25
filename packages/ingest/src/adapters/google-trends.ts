import googleTrends from "google-trends-api";
import { env } from "@grailwatch/shared/env";
import { isoDate } from "@grailwatch/shared/dates";
import { createLogger } from "@grailwatch/shared/logger";
import type { Card } from "@grailwatch/db";
import { sleep } from "../http";
import { errorMessage, type AttentionSnapshotInput, type AttentionSource } from "../types";

const log = createLogger("google-trends");

interface TimelinePoint {
  time?: string;
  value?: number[];
}

/**
 * Google Trends via the unofficial google-trends-api package (no key). Rate
 * limiting shows up as an HTML payload instead of JSON — JSON.parse throws,
 * we count it as a failure, and after 3 consecutive failures the whole
 * adapter backs off until the next nightly run. Never crashes the run.
 */
export class GoogleTrendsSource implements AttentionSource {
  name = "google_trends";

  disabled(): string | null {
    return env.ENABLE_GOOGLE_TRENDS ? null : "ENABLE_GOOGLE_TRENDS=false";
  }

  async fetchAttentionSnapshots(cards: Card[], since: Date): Promise<AttentionSnapshotInput[]> {
    const out: AttentionSnapshotInput[] = [];
    let consecutiveFailures = 0;

    for (const card of cards) {
      if (consecutiveFailures >= 3) {
        log.warn("3 consecutive failures — likely rate-limited, backing off until next run");
        break;
      }
      try {
        await sleep(1000); // gentle pacing; this endpoint bans aggressively
        const raw = await googleTrends.interestOverTime({
          keyword: card.name,
          startTime: since,
          ...(env.GOOGLE_TRENDS_GEO ? { geo: env.GOOGLE_TRENDS_GEO } : {}),
        });
        const parsed = JSON.parse(raw) as { default?: { timelineData?: TimelinePoint[] } };
        const points = parsed.default?.timelineData ?? [];
        for (const point of points) {
          const seconds = Number(point.time);
          const value = Number(point.value?.[0]);
          if (!Number.isFinite(seconds) || !Number.isFinite(value)) continue;
          out.push({
            cardId: card.id,
            topic: card.name,
            snapshotDate: isoDate(new Date(seconds * 1000)),
            source: "google_trends",
            score: value,
          });
        }
        consecutiveFailures = 0;
      } catch (err) {
        consecutiveFailures++;
        log.warn(`${card.name}: ${errorMessage(err)} — continuing`);
      }
    }
    return out;
  }
}
