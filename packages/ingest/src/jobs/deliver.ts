import { desc, eq, gte } from "drizzle-orm";
import { addDays, todayIso } from "@grailwatch/shared/dates";
import { env } from "@grailwatch/shared/env";
import { createLogger } from "@grailwatch/shared/logger";
import { alerts, cards, db } from "@grailwatch/db";

const log = createLogger("deliver");

export interface DeliverSummary {
  considered: number;
  discordSent: number;
  emailStubbed: number;
  failures: number;
}

/**
 * Deliver pending alerts (last 30 days) to every configured channel that
 * hasn't received them yet. Discord = webhook embed; email = console stub for
 * now. Channels append to delivered_channels so re-runs never double-send.
 */
export async function deliverAlerts(): Promise<DeliverSummary> {
  const wanted = ["email_console", ...(env.DISCORD_WEBHOOK_URL ? ["discord"] : [])];
  if (!env.DISCORD_WEBHOOK_URL) {
    log.info("DISCORD_WEBHOOK_URL not set — Discord delivery skipped, email stub only");
  }

  const rows = await db
    .select({ alert: alerts, cardName: cards.name })
    .from(alerts)
    .innerJoin(cards, eq(alerts.cardId, cards.id))
    .where(gte(alerts.runDate, addDays(todayIso(), -30)))
    .orderBy(desc(alerts.runDate));

  const summary: DeliverSummary = { considered: 0, discordSent: 0, emailStubbed: 0, failures: 0 };

  for (const { alert, cardName } of rows) {
    const missing = wanted.filter((c) => !alert.deliveredChannels.includes(c));
    if (missing.length === 0) continue;
    summary.considered++;
    const delivered = [...alert.deliveredChannels];

    if (missing.includes("discord")) {
      try {
        await postDiscord(env.DISCORD_WEBHOOK_URL!, cardName, alert);
        delivered.push("discord");
        summary.discordSent++;
      } catch (err) {
        summary.failures++;
        log.warn(`discord delivery failed for "${cardName}": ${err instanceof Error ? err.message : err}`);
      }
    }

    if (missing.includes("email_console")) {
      // email delivery is a console stub for now
      const lines = [
        "──────────────────────────────────────────────",
        `EMAIL STUB — GrailWatch alert (${alert.runDate})`,
        `${cardName}: composite ${alert.compositeScore.toFixed(2)}`,
        ...alert.reasons.map((r) => `  • ${r}`),
        `${env.WEB_BASE_URL}/cards/${alert.cardId}`,
        "──────────────────────────────────────────────",
      ];
      console.log(lines.join("\n"));
      delivered.push("email_console");
      summary.emailStubbed++;
    }

    await db.update(alerts).set({ deliveredChannels: delivered }).where(eq(alerts.id, alert.id));
  }

  log.info(
    `deliver: ${summary.considered} alerts processed, ${summary.discordSent} discord, ` +
      `${summary.emailStubbed} email stubs, ${summary.failures} failures`,
  );
  return summary;
}

async function postDiscord(
  webhookUrl: string,
  cardName: string,
  alert: { cardId: number; runDate: string; compositeScore: number; reasons: string[] },
): Promise<void> {
  const payload = {
    username: "GrailWatch",
    embeds: [
      {
        title: `🚨 ${cardName} — accumulation score ${alert.compositeScore.toFixed(2)}`,
        description: alert.reasons.slice(0, 2).map((r) => `• ${r}`).join("\n"),
        url: `${env.WEB_BASE_URL}/cards/${alert.cardId}`,
        color: 0x4cc38a,
        footer: { text: `GrailWatch nightly run ${alert.runDate}` },
      },
    ],
  };
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`webhook HTTP ${res.status}`);
}
