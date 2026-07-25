/** Hand-mirrored API types — the web app talks HTTP only, no workspace imports. */

export type Franchise = "pokemon" | "yugioh" | "manga" | "dbz_carddass" | "soccer" | "other";
export type Category = "card" | "book" | "sealed";

export type SignalName =
  | "velocityZ"
  | "supplyDrain"
  | "gradeCompression"
  | "popDelta"
  | "attentionDivergence";

export const SIGNAL_NAMES: SignalName[] = [
  "velocityZ",
  "supplyDrain",
  "gradeCompression",
  "popDelta",
  "attentionDivergence",
];

export interface Card {
  id: number;
  name: string;
  franchise: Franchise;
  setName: string | null;
  cardNumber: string | null;
  language: string | null;
  category: Category;
  notes: string | null;
  psaPopUrl: string | null;
  cgcPopUrl: string | null;
  createdAt: string;
}

export interface SignalScoreRow {
  id: number;
  cardId: number;
  runDate: string;
  velocityZ: number | null;
  supplyDrain: number | null;
  gradeCompression: number | null;
  popDelta: number | null;
  attentionDivergence: number | null;
  compositeScore: number | null;
  triggered: boolean;
}

export type NormalizedMap = Record<SignalName, number | null>;

export interface LeaderboardRow {
  card: Card;
  score: SignalScoreRow;
  normalized: NormalizedMap;
  sparkline: { d: string; p: number }[];
}

export interface LeaderboardResponse {
  runDate: string | null;
  rows: LeaderboardRow[];
}

export interface CardsResponse {
  cards: (Card & { latestScore: SignalScoreRow | null; normalized: NormalizedMap | null })[];
}

export interface AlertRow {
  id: number;
  cardId: number;
  runDate: string;
  compositeScore: number;
  reasons: string[];
  deliveredChannels: string[];
  createdAt: string;
  cardName: string;
  franchise: Franchise;
}

export interface MarketSnapshotRow {
  id: number;
  cardId: number;
  grade: string;
  snapshotDate: string;
  avgSalePrice: number | null;
  medianSalePrice: number | null;
  saleCount: number | null;
  activeListingCount: number | null;
  source: string;
}

export interface PopSnapshotRow {
  id: number;
  cardId: number;
  grader: "psa" | "cgc" | "bgs";
  grade: string;
  snapshotDate: string;
  population: number;
}

export interface AttentionSnapshotRow {
  id: number;
  cardId: number | null;
  topic: string | null;
  snapshotDate: string;
  source: string;
  score: number;
}

export interface CardDetailResponse {
  card: Card;
  marketSnapshots: MarketSnapshotRow[];
  popSnapshots: PopSnapshotRow[];
  attentionSnapshots: AttentionSnapshotRow[];
  signalHistory: (SignalScoreRow & { normalized: NormalizedMap })[];
  alerts: Omit<AlertRow, "cardName" | "franchise">[];
}

export interface Watchlist {
  id: number;
  label: string;
  createdAt: string;
  cardIds: number[];
}

export interface ScoringConfig {
  weights: Record<SignalName, number>;
  thresholds: Record<SignalName, number>;
  compositeTrigger: number;
  minSignalsAbove: number;
}

export interface ImportSummary {
  kind: "cards" | "market" | "pop" | "attention";
  imported: number;
  skipped: number;
  unknownNames: string[];
}
