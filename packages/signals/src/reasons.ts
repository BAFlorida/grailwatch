import { SIGNAL_NAMES, type ScoringConfig, type SignalName } from "@grailwatch/shared/scoring";
import { formatGrade } from "./grades";
import type { SignalValue } from "./types";

/**
 * Plain-English reason strings for alerts and Discord messages, ranked by
 * weighted contribution to the composite. Only signals that meaningfully
 * contributed (normalized ≥ minNormalized) get a sentence.
 */

const num = (v: number | string | null | undefined): number =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;
const str = (v: number | string | null | undefined): string => (typeof v === "string" ? v : "");

function fmtPct(v: number, digits = 0): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits)}%`;
}

function fmtMoney(v: number): string {
  if (v >= 1000) return `$${Math.round(v).toLocaleString("en-US")}`;
  return `$${v.toFixed(v >= 100 ? 0 : 2)}`;
}

function capitalize(s: string): string {
  return s.length > 0 ? s[0]!.toUpperCase() + s.slice(1) : s;
}

function reasonFor(name: SignalName, s: SignalValue): string | null {
  if (s.raw === null) return null;
  const d = s.detail;
  switch (name) {
    case "velocityZ":
      return `${formatGrade(str(d.grade))} 30-day avg ${fmtMoney(num(d.recentMean))} vs ${fmtMoney(
        num(d.baselineMean),
      )} baseline (${fmtPct(num(d.pctChange))}, z=${s.raw.toFixed(1)})`;
    case "supplyDrain": {
      const lc = num(d.listingChangePct);
      const sc = num(d.soldChangePct);
      const listPart =
        lc <= 0
          ? `active listings down ${Math.abs(lc).toFixed(0)}%`
          : `active listings up ${lc.toFixed(0)}%`;
      const soldPart =
        sc >= 0
          ? `sold volume up ${sc.toFixed(0)}%`
          : `sold volume down ${Math.abs(sc).toFixed(0)}%`;
      return `${capitalize(listPart)} in 30 days while ${soldPart}`;
    }
    case "gradeCompression":
      return `Low-grade prices rising in near-lockstep with high grades (${fmtPct(
        num(d.lowGrowthPct),
      )} vs ${fmtPct(num(d.highGrowthPct))} over 60d)`;
    case "popDelta":
      return `Graded population ${fmtPct(num(d.curPct), 1)} in 60 days vs ${fmtPct(
        num(d.normPct),
        1,
      )} 12-month norm — fresh slabs being prepped`;
    case "attentionDivergence": {
      const slope = num(d.attentionSlopePct);
      const attnPart =
        Math.abs(slope) < 10
          ? "public attention flat"
          : slope < 0
            ? `public attention fading (${fmtPct(slope)})`
            : `attention up only ${fmtPct(slope)}`;
      return `Price velocity z=${num(d.velocityZ).toFixed(1)} while ${attnPart} over 60d`;
    }
  }
}

export function buildReasons(
  signals: Record<SignalName, SignalValue>,
  config: ScoringConfig,
  minNormalized = 0.2,
): string[] {
  return SIGNAL_NAMES.map((name) => ({ name, s: signals[name] }))
    .filter(({ s }) => s.normalized !== null && s.normalized >= minNormalized)
    .sort(
      (a, b) =>
        (config.weights[b.name] ?? 0) * b.s.normalized! -
        (config.weights[a.name] ?? 0) * a.s.normalized!,
    )
    .map(({ name, s }) => reasonFor(name, s))
    .filter((r): r is string => r !== null);
}
