import cron from "node-cron";
import { max } from "drizzle-orm";
import { env } from "@grailwatch/shared/env";
import { createLogger } from "@grailwatch/shared/logger";
import { db, marketSnapshots, signalScores } from "@grailwatch/db";
import { deliverAlerts, runIngest, runScore } from "@grailwatch/ingest";
import { createApp } from "./app";

const log = createLogger("api");

const app = createApp();
app.listen(env.API_PORT, () => {
  log.info(`GrailWatch API listening on http://localhost:${env.API_PORT}`);
});

// ── nightly jobs ──────────────────────────────────────────────────────────────
if (env.ENABLE_CRON) {
  cron.schedule(env.CRON_INGEST, () => {
    log.info("cron: nightly ingest starting");
    runIngest().catch((err) => log.error("nightly ingest failed", err));
  });
  cron.schedule(env.CRON_SCORE, () => {
    log.info("cron: nightly score starting");
    runScore().catch((err) => log.error("nightly score failed", err));
  });
  cron.schedule(env.CRON_DELIVER, () => {
    log.info("cron: alert delivery starting");
    deliverAlerts().catch((err) => log.error("alert delivery failed", err));
  });
  log.info(
    `cron armed — ingest "${env.CRON_INGEST}", score "${env.CRON_SCORE}", deliver "${env.CRON_DELIVER}"`,
  );
} else {
  log.info("cron disabled (ENABLE_CRON=false)");
}

// ── bootstrap score ───────────────────────────────────────────────────────────
// If snapshots exist but the latest data date has no scores yet (fresh seed,
// restored dump, …), run score + deliver once so the dashboard is never empty.
if (env.ENABLE_BOOTSTRAP_SCORE) {
  void bootstrapScore();
}

async function bootstrapScore(): Promise<void> {
  try {
    const [m] = await db.select({ d: max(marketSnapshots.snapshotDate) }).from(marketSnapshots);
    if (!m?.d) {
      log.info("bootstrap: no snapshot data yet — run `pnpm run seed` (or an ingest) first");
      return;
    }
    const [s] = await db.select({ d: max(signalScores.runDate) }).from(signalScores);
    if (s?.d && s.d >= m.d) {
      log.info(`bootstrap: scores current through ${s.d}`);
      return;
    }
    log.info(`bootstrap: snapshots through ${m.d} have no scores yet — scoring now`);
    await runScore();
    await deliverAlerts();
  } catch (err) {
    log.error("bootstrap score failed", err);
  }
}
