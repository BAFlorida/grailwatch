import { describe, expect, it } from "vitest";
import { DEFAULT_SCORING_CONFIG } from "@grailwatch/shared/scoring";
import { computeCardSignals } from "../src/index";
import { buildReasons } from "../src/reasons";
import { buildSeries, FIXTURE_END } from "./fixtures";

describe("buildReasons", () => {
  it("produces ranked plain-English reasons for an accumulation", () => {
    const result = computeCardSignals(buildSeries("accumulation"), FIXTURE_END);
    const reasons = buildReasons(result.signals, DEFAULT_SCORING_CONFIG);

    expect(reasons.length).toBeGreaterThanOrEqual(3);
    const joined = reasons.join(" | ");
    expect(joined).toMatch(/attention flat/i);
    expect(joined).toMatch(/active listings down \d+%/i);
    expect(joined).toMatch(/lockstep/i);
    // ranked: the top-weighted contributor (attention divergence) leads
    expect(reasons[0]).toMatch(/price velocity z=/i);
  });

  it("stays quiet for a flat market", () => {
    const result = computeCardSignals(buildSeries("flat"), FIXTURE_END);
    const reasons = buildReasons(result.signals, DEFAULT_SCORING_CONFIG);
    expect(reasons.length).toBeLessThanOrEqual(1);
  });
});
