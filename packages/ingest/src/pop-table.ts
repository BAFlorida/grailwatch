import * as cheerio from "cheerio";

/**
 * Parse a grader pop-report HTML page into { "<prefix>_<grade>": population }.
 *
 * Both PSA pop pages and CGC census pages render "a table whose header row is
 * grade labels (10, 9.5, 9, …) and whose body has a TOTAL row". Markup drifts,
 * so this parser is deliberately structural rather than selector-pinned:
 *   1. find a table whose header row contains ≥ 4 numeric grade labels
 *   2. prefer a body row labeled TOTAL; otherwise the first numeric-heavy row
 *   3. align cells to headers from the offset of any leading label columns
 * Returns {} when nothing parseable is found — callers log and move on.
 */
export function parseGradePopTable(html: string, prefix: "psa" | "cgc" | "bgs"): Record<string, number> {
  const $ = cheerio.load(html);
  let result: Record<string, number> = {};

  $("table").each((_, table) => {
    if (Object.keys(result).length > 0) return;

    const headerCells = $(table).find("tr").first().find("th,td");
    // keep the raw label text: "4.0" must become <prefix>_4_0, not <prefix>_4
    const headers: (string | null)[] = [];
    headerCells.each((_, cell) => {
      const label = $(cell).text().trim();
      const m = /^(\d{1,2}(?:\.\d)?)$/.exec(label);
      headers.push(m ? m[1]! : null);
    });
    const gradeCount = headers.filter((h) => h !== null).length;
    if (gradeCount < 4) return; // not a pop table

    let chosen: string[] | null = null;
    $(table)
      .find("tr")
      .slice(1)
      .each((_, tr) => {
        const cells = $(tr)
          .find("td,th")
          .map((_, td) => $(td).text().trim())
          .get();
        if (cells.length === 0) return;
        const label = (cells[0] ?? "").toUpperCase();
        const numericCells = cells.filter((c) => /^[\d,]+$/.test(c)).length;
        if (label.includes("TOTAL")) {
          chosen = cells; // TOTAL row wins
        } else if (chosen === null && numericCells >= Math.min(4, gradeCount)) {
          chosen = cells;
        }
      });
    if (chosen === null) return;
    const cells: string[] = chosen;

    // leading label columns shift data cells right of the header positions
    const offset = Math.max(cells.length - headers.length, 0);
    const parsed: Record<string, number> = {};
    headers.forEach((h, i) => {
      if (h === null) return;
      const cellText = cells[i + offset];
      if (cellText === undefined) return;
      const value = Number(cellText.replace(/,/g, ""));
      if (!Number.isFinite(value)) return;
      parsed[`${prefix}_${h.replace(".", "_")}`] = value;
    });
    if (Object.keys(parsed).length >= 4) result = parsed;
  });

  return result;
}
