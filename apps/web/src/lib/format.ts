import type { CSSProperties } from "react";
import type { Franchise, SignalName } from "./types";

export const SIGNAL_SHORT: Record<SignalName, string> = {
  velocityZ: "VEL",
  supplyDrain: "DRN",
  gradeCompression: "CMP",
  popDelta: "POP",
  attentionDivergence: "DIV",
};

export const SIGNAL_FULL: Record<SignalName, string> = {
  velocityZ: "Velocity Z",
  supplyDrain: "Supply Drain",
  gradeCompression: "Grade Compression",
  popDelta: "Pop Delta",
  attentionDivergence: "Attention Divergence",
};

export const SIGNAL_UNIT: Record<SignalName, string> = {
  velocityZ: "z",
  supplyDrain: "pp",
  gradeCompression: "0–1",
  popDelta: "pp",
  attentionDivergence: "z",
};

export const FRANCHISE_LABELS: Record<Franchise, string> = {
  pokemon: "Pokémon",
  yugioh: "Yu-Gi-Oh!",
  manga: "Manga",
  dbz_carddass: "DBZ Carddass",
  soccer: "Soccer",
  other: "Other",
};

export function fmtMoney(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  if (v >= 1000) return `$${Math.round(v).toLocaleString("en-US")}`;
  return `$${v.toFixed(v >= 100 ? 0 : 2)}`;
}

export function fmtNum(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return v.toFixed(digits);
}

export function fmtPct(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits)}%`;
}

export function fmtDate(d: string | null | undefined): string {
  return d ? d.slice(0, 10) : "—";
}

/** heat background for a 0–1 normalized signal value */
export function heatStyle(v: number | null): CSSProperties {
  if (v === null) return { color: "var(--dim)" };
  const alpha = 0.06 + 0.66 * Math.max(0, Math.min(1, v));
  return {
    background: `rgba(76, 195, 138, ${alpha.toFixed(3)})`,
    color: v > 0.55 ? "#06130c" : "var(--text)",
  };
}

export function compositeColor(v: number | null): string {
  if (v === null) return "var(--dim)";
  if (v >= 0.65) return "var(--accent)";
  if (v >= 0.4) return "var(--amber)";
  return "var(--text)";
}
