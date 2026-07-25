import { closeDb } from "@grailwatch/db";
import { runIngest } from "@grailwatch/ingest";

runIngest()
  .then((summary) => {
    console.table(
      summary.results.map((r) => ({
        source: r.source,
        kind: r.kind,
        status: r.status,
        rows: r.rows,
        note: r.note ?? "",
      })),
    );
  })
  .catch((err) => {
    console.error("ingest failed:", err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
