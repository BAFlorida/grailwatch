import { todayIso } from "@grailwatch/shared/dates";
import { createLogger } from "@grailwatch/shared/logger";
import type { Card } from "@grailwatch/db";
import { fetchTextCached, throttled } from "../http";
import { parseGradePopTable } from "../pop-table";
import { errorMessage, type PopSnapshotInput, type PopSource } from "../types";

const log = createLogger("cgc-pop");

/**
 * CGC census scraper for graded manga/comics — same pattern and politeness
 * rules as the PSA scraper: per-card cgc_pop_url, 1 req / 2s, 20h cache,
 * honest User-Agent.
 */
export class CgcPopSource implements PopSource {
  name = "cgc_pop";

  disabled(): string | null {
    return null; // keyless; gated per card by cgc_pop_url
  }

  async fetchPopSnapshots(cards: Card[]): Promise<PopSnapshotInput[]> {
    const targets = cards.filter((c) => c.cgcPopUrl);
    if (targets.length === 0) {
      log.info("no cards have cgc_pop_url set — nothing to scrape");
      return [];
    }
    const gate = throttled(2000);
    const today = todayIso();
    const out: PopSnapshotInput[] = [];

    for (const card of targets) {
      try {
        const html = await fetchTextCached(card.cgcPopUrl!, {
          cacheKey: `cgc/${card.id}`,
          ttlMs: 20 * 60 * 60 * 1000,
          onNetwork: gate,
        });
        const pops = parseGradePopTable(html, "cgc");
        const grades = Object.entries(pops);
        if (grades.length === 0) {
          log.warn(`${card.name}: no census table recognized at ${card.cgcPopUrl}`);
          continue;
        }
        for (const [grade, population] of grades) {
          out.push({ cardId: card.id, grader: "cgc", grade, snapshotDate: today, population });
        }
      } catch (err) {
        log.warn(`${card.name}: ${errorMessage(err)} — continuing with next card`);
      }
    }
    return out;
  }
}
