import fs from "node:fs";
import path from "node:path";
import { isoDate } from "@grailwatch/shared/dates";
import { createLogger } from "@grailwatch/shared/logger";
import { mapAttentionCsv, mapMarketCsv, mapPopCsv } from "@grailwatch/db";
import type { Card } from "@grailwatch/db";
import type {
  AttentionSnapshotInput,
  AttentionSource,
  MarketSnapshotInput,
  MarketSource,
  PopSnapshotInput,
  PopSource,
} from "../types";

const log = createLogger("csv-source");

/**
 * File-based sources so the whole pipeline runs with zero API keys: point
 * CSV_SOURCE_DIR at a directory containing market.csv / pop.csv /
 * attention.csv (the seed-data directory works) and the nightly ingest
 * re-reads them like any other source. Formats are documented in
 * packages/db/src/csv-import.ts.
 */

function idMap(cards: Card[]): Map<string, number> {
  return new Map(cards.map((c) => [c.name, c.id]));
}

function readIfExists(dir: string, file: string): string | null {
  const p = path.join(dir, file);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
}

function disabledReason(dir: string | undefined, file: string): string | null {
  if (!dir) return "CSV_SOURCE_DIR not set";
  if (!fs.existsSync(path.join(dir, file))) return `${file} not found in ${dir}`;
  return null;
}

export class CsvMarketSource implements MarketSource {
  name = "csv";
  constructor(private dir: string | undefined) {}

  disabled(): string | null {
    return disabledReason(this.dir, "market.csv");
  }

  async fetchSnapshots(cards: Card[], since: Date): Promise<MarketSnapshotInput[]> {
    const text = readIfExists(this.dir!, "market.csv");
    if (text === null) return [];
    const sinceIso = isoDate(since);
    const { rows, skipped, unknownNames } = mapMarketCsv(text, idMap(cards));
    if (unknownNames.length > 0) {
      log.warn(`market.csv: ${unknownNames.length} unknown card names skipped`);
    }
    if (skipped > 0) log.debug(`market.csv: ${skipped} malformed rows skipped`);
    return rows.filter((r) => r.snapshotDate >= sinceIso);
  }
}

export class CsvPopSource implements PopSource {
  name = "csv";
  constructor(private dir: string | undefined) {}

  disabled(): string | null {
    return disabledReason(this.dir, "pop.csv");
  }

  async fetchPopSnapshots(cards: Card[], since: Date): Promise<PopSnapshotInput[]> {
    const text = readIfExists(this.dir!, "pop.csv");
    if (text === null) return [];
    const sinceIso = isoDate(since);
    const { rows, unknownNames } = mapPopCsv(text, idMap(cards));
    if (unknownNames.length > 0) {
      log.warn(`pop.csv: ${unknownNames.length} unknown card names skipped`);
    }
    return rows.filter((r) => r.snapshotDate >= sinceIso);
  }
}

export class CsvAttentionSource implements AttentionSource {
  name = "csv";
  constructor(private dir: string | undefined) {}

  disabled(): string | null {
    return disabledReason(this.dir, "attention.csv");
  }

  async fetchAttentionSnapshots(cards: Card[], since: Date): Promise<AttentionSnapshotInput[]> {
    const text = readIfExists(this.dir!, "attention.csv");
    if (text === null) return [];
    const sinceIso = isoDate(since);
    const { rows, unknownNames } = mapAttentionCsv(text, idMap(cards));
    if (unknownNames.length > 0) {
      log.warn(`attention.csv: ${unknownNames.length} unknown card names skipped`);
    }
    return rows.filter((r) => r.snapshotDate >= sinceIso);
  }
}
