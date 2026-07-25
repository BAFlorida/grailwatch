import type {
  Card,
  NewAttentionSnapshot,
  NewMarketSnapshot,
  NewPopSnapshot,
} from "@grailwatch/db";

export type MarketSnapshotInput = NewMarketSnapshot;
export type PopSnapshotInput = NewPopSnapshot;
export type AttentionSnapshotInput = NewAttentionSnapshot;

/**
 * Adapter pattern: one interface per data kind, many sources. Every source
 * must degrade gracefully — a missing key means disabled() returns a reason
 * and the nightly run logs a warning and moves on; a runtime failure inside
 * fetch* is caught per card and per source, never crashing the run.
 */
export interface SourceBase {
  name: string;
  /** null = ready to run; otherwise a human-readable reason it is skipped */
  disabled(): string | null;
}

export interface MarketSource extends SourceBase {
  fetchSnapshots(cards: Card[], since: Date): Promise<MarketSnapshotInput[]>;
}

export interface PopSource extends SourceBase {
  fetchPopSnapshots(cards: Card[], since: Date): Promise<PopSnapshotInput[]>;
}

export interface AttentionSource extends SourceBase {
  fetchAttentionSnapshots(cards: Card[], since: Date): Promise<AttentionSnapshotInput[]>;
}

export interface SourceRegistry {
  market: MarketSource[];
  pop: PopSource[];
  attention: AttentionSource[];
}

export interface SourceRunResult {
  source: string;
  kind: "market" | "pop" | "attention";
  status: "ok" | "skipped" | "error";
  rows: number;
  note?: string;
}

export interface IngestSummary {
  startedAt: string;
  results: SourceRunResult[];
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
