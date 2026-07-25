import { eq } from "drizzle-orm";
import {
  CONFIG_KEY_SCORING,
  DEFAULT_SCORING_CONFIG,
  type ScoringConfig,
} from "@grailwatch/shared/scoring";
import { db } from "./client";
import { appConfig } from "./schema";

/**
 * Read the scoring config, deep-merged over defaults so a partial row (e.g.
 * only weights edited from the UI) never loses thresholds or trigger rules.
 */
export async function getScoringConfig(): Promise<ScoringConfig> {
  const rows = await db
    .select()
    .from(appConfig)
    .where(eq(appConfig.key, CONFIG_KEY_SCORING))
    .limit(1);
  const stored = (rows[0]?.value ?? {}) as Partial<ScoringConfig>;
  return {
    ...DEFAULT_SCORING_CONFIG,
    ...stored,
    weights: { ...DEFAULT_SCORING_CONFIG.weights, ...(stored.weights ?? {}) },
    thresholds: { ...DEFAULT_SCORING_CONFIG.thresholds, ...(stored.thresholds ?? {}) },
  };
}

export async function saveScoringConfig(config: ScoringConfig): Promise<void> {
  await db
    .insert(appConfig)
    .values({ key: CONFIG_KEY_SCORING, value: config, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: appConfig.key,
      set: { value: config, updatedAt: new Date() },
    });
}
