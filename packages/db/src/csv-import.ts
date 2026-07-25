import { csvToRecords } from "@grailwatch/shared/csv";
import type {
  NewAttentionSnapshot,
  NewCard,
  NewMarketSnapshot,
  NewPopSnapshot,
} from "./schema";

/**
 * CSV → row mappers shared by the seed script, the CSV ingest adapter, and
 * the POST /api/import/csv route. Cards are referenced by exact `card_name`
 * (or numeric `card_id`); unknown names are reported, not fatal.
 *
 * Formats (headers required):
 *   market.csv    card_name,grade,snapshot_date,avg_sale_price,median_sale_price,sale_count,active_listing_count,source
 *   pop.csv       card_name,grader,grade,snapshot_date,population
 *   attention.csv card_name,topic,snapshot_date,source,score
 *   cards.csv     name,franchise,set_name,card_number,language,category,notes
 */

export interface CsvImportResult<T> {
  rows: T[];
  skipped: number;
  unknownNames: string[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const GRADERS = new Set(["psa", "cgc", "bgs"]);
const ATTENTION_SOURCES = new Set(["google_trends", "youtube", "x"]);
const FRANCHISES = new Set(["pokemon", "yugioh", "manga", "dbz_carddass", "soccer", "other"]);
const CATEGORIES = new Set(["card", "book", "sealed"]);

function num(v: string | undefined): number | null {
  if (v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function int(v: string | undefined): number | null {
  const n = num(v);
  return n === null ? null : Math.trunc(n);
}

function resolveCardId(
  rec: Record<string, string>,
  idByName: Map<string, number>,
  unknown: Set<string>,
): number | null {
  const rawId = int(rec.card_id);
  if (rawId !== null) return rawId;
  const name = (rec.card_name ?? "").trim();
  if (name && idByName.has(name)) return idByName.get(name)!;
  if (name) unknown.add(name);
  return null;
}

export function mapMarketCsv(
  text: string,
  idByName: Map<string, number>,
): CsvImportResult<NewMarketSnapshot> {
  const { records } = csvToRecords(text);
  const rows: NewMarketSnapshot[] = [];
  const unknown = new Set<string>();
  let skipped = 0;
  for (const rec of records) {
    const cardId = resolveCardId(rec, idByName, unknown);
    const grade = (rec.grade ?? "").trim();
    const dateStr = (rec.snapshot_date ?? "").trim();
    if (cardId === null || !grade || !DATE_RE.test(dateStr)) {
      skipped++;
      continue;
    }
    rows.push({
      cardId,
      grade,
      snapshotDate: dateStr,
      avgSalePrice: num(rec.avg_sale_price),
      medianSalePrice: num(rec.median_sale_price),
      saleCount: int(rec.sale_count),
      activeListingCount: int(rec.active_listing_count),
      source: (rec.source ?? "").trim() || "csv",
    });
  }
  return { rows, skipped, unknownNames: [...unknown] };
}

export function mapPopCsv(
  text: string,
  idByName: Map<string, number>,
): CsvImportResult<NewPopSnapshot> {
  const { records } = csvToRecords(text);
  const rows: NewPopSnapshot[] = [];
  const unknown = new Set<string>();
  let skipped = 0;
  for (const rec of records) {
    const cardId = resolveCardId(rec, idByName, unknown);
    const grader = (rec.grader ?? "").trim().toLowerCase();
    const grade = (rec.grade ?? "").trim();
    const dateStr = (rec.snapshot_date ?? "").trim();
    const population = int(rec.population);
    if (cardId === null || !GRADERS.has(grader) || !grade || !DATE_RE.test(dateStr) || population === null) {
      skipped++;
      continue;
    }
    rows.push({
      cardId,
      grader: grader as NewPopSnapshot["grader"],
      grade,
      snapshotDate: dateStr,
      population,
    });
  }
  return { rows, skipped, unknownNames: [...unknown] };
}

export function mapAttentionCsv(
  text: string,
  idByName: Map<string, number>,
): CsvImportResult<NewAttentionSnapshot> {
  const { records } = csvToRecords(text);
  const rows: NewAttentionSnapshot[] = [];
  const unknown = new Set<string>();
  let skipped = 0;
  for (const rec of records) {
    const name = (rec.card_name ?? "").trim();
    const cardId = name || rec.card_id ? resolveCardId(rec, idByName, unknown) : null;
    const topic = (rec.topic ?? "").trim() || null;
    const dateStr = (rec.snapshot_date ?? "").trim();
    const source = (rec.source ?? "").trim().toLowerCase();
    const score = num(rec.score);
    // a row must anchor to a card or at least a topic
    if ((cardId === null && topic === null) || !DATE_RE.test(dateStr) || !ATTENTION_SOURCES.has(source) || score === null) {
      skipped++;
      continue;
    }
    rows.push({
      cardId,
      topic,
      snapshotDate: dateStr,
      source: source as NewAttentionSnapshot["source"],
      score,
    });
  }
  return { rows, skipped, unknownNames: [...unknown] };
}

export function mapCardsCsv(text: string): CsvImportResult<NewCard> {
  const { records } = csvToRecords(text);
  const rows: NewCard[] = [];
  let skipped = 0;
  for (const rec of records) {
    const name = (rec.name ?? "").trim();
    const franchise = (rec.franchise ?? "").trim().toLowerCase();
    const category = (rec.category ?? "").trim().toLowerCase() || "card";
    if (!name || !FRANCHISES.has(franchise) || !CATEGORIES.has(category)) {
      skipped++;
      continue;
    }
    rows.push({
      name,
      franchise: franchise as Exclude<NewCard["franchise"], undefined>,
      setName: (rec.set_name ?? "").trim() || null,
      cardNumber: (rec.card_number ?? "").trim() || null,
      language: (rec.language ?? "").trim() || null,
      category: category as Exclude<NewCard["category"], undefined>,
      notes: (rec.notes ?? "").trim() || null,
    });
  }
  return { rows, skipped, unknownNames: [] };
}
