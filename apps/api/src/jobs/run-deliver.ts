import { closeDb } from "@grailwatch/db";
import { deliverAlerts } from "@grailwatch/ingest";

deliverAlerts()
  .then((summary) => {
    console.log(JSON.stringify(summary, null, 2));
  })
  .catch((err) => {
    console.error("deliver failed:", err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
