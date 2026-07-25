import { closeDb } from "@grailwatch/db";
import { runScore } from "@grailwatch/ingest";

runScore()
  .then((summary) => {
    console.log(JSON.stringify(summary, null, 2));
  })
  .catch((err) => {
    console.error("score failed:", err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
