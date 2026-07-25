import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { CsvMarketSource } from "../src/adapters/csv";
import type { Card } from "@grailwatch/db";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "grailwatch-csv-"));
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const card = {
  id: 1,
  name: "Berserk Vol. 1 (1st Printing)",
} as Card;

describe("CsvMarketSource", () => {
  it("reports disabled without a directory", () => {
    expect(new CsvMarketSource(undefined).disabled()).toMatch(/CSV_SOURCE_DIR/);
  });

  it("reports disabled when market.csv is missing", () => {
    expect(new CsvMarketSource(dir).disabled()).toMatch(/market\.csv not found/);
  });

  it("maps known card names and filters by since-date", async () => {
    fs.writeFileSync(
      path.join(dir, "market.csv"),
      [
        "card_name,grade,snapshot_date,avg_sale_price,median_sale_price,sale_count,active_listing_count,source",
        `${card.name},cgc_9_8,2026-01-05,1200,1180,2,7,test`,
        `${card.name},cgc_9_8,2025-01-05,900,890,1,9,test`, // before `since`
        `Unknown Card,raw,2026-01-05,10,10,1,3,test`,
      ].join("\n"),
    );
    const source = new CsvMarketSource(dir);
    expect(source.disabled()).toBeNull();
    const rows = await source.fetchSnapshots([card], new Date("2025-12-01T00:00:00Z"));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      cardId: 1,
      grade: "cgc_9_8",
      snapshotDate: "2026-01-05",
      avgSalePrice: 1200,
      saleCount: 2,
      activeListingCount: 7,
    });
  });
});
