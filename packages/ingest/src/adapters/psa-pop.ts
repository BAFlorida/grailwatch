import { todayIso } from "@grailwatch/shared/dates";
import { createLogger } from "@grailwatch/shared/logger";
import type { Card } from "@grailwatch/db";
import { fetchTextCached, throttled } from "../http";
import { parseGradePopTable } from "../pop-table";
import { errorMessage, type PopSnapshotInput, type PopSource } from "../types";

const log = createLogger("psa-pop");

/**
 * PSA pop report scraper. Politeness rules baked in:
 *   - only cards with psa_pop_url set are visited (no guessing URLs)
 *   - 1 request / 2 seconds
 *   - 20h on-disk cache, so re-runs and same-day retries cost nothing
 *   - honest User-Agent (set SCRAPER_CONTACT in .env)
 */
export class PsaPopSource implements PopSource {
  name = "psa_pop";

  disabled(): string | null {
    return null; // keyless; gated per card by psa_pop_url
  }

  async fetchPopSnapshots(cards: Card[]): Promise<PopSnapshotInput[]> {
    const targets = cards.filter((c) => c.psaPopUrl);
    if (targets.length === 0) {
      log.info("no cards have psa_pop_url set — nothing to scrape");
      return [];
    }
    const gate = throttled(2000);
    const today = todayIso();
    const out: PopSnapshotInput[] = [];

    for (const card of targets) {
      try {
        const html = await fetchTextCached(card.psaPopUrl!, {
          cacheKey: `psa/${card.id}`,
          ttlMs: 20 * 60 * 60 * 1000,
          onNetwork: gate,
        });
        const pops = parseGradePopTable(html, "psa");
        const grades = Object.entries(pops);
        if (grades.length === 0) {
          log.warn(`${card.name}: no pop table recognized at ${card.psaPopUrl}`);
          continue;
        }
        for (const [grade, population] of grades) {
          out.push({ cardId: card.id, grader: "psa", grade, snapshotDate: today, population });
        }
      } catch (err) {
        log.warn(`${card.name}: ${errorMessage(err)} — continuing with next card`);
      }
    }
    return out;
  }
}
