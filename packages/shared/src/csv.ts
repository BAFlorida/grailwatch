/**
 * Minimal RFC-4180-ish CSV: quoted fields, escaped quotes ("" inside quotes),
 * LF or CRLF line endings. Good enough for our seed/import formats without
 * pulling in a dependency.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || (r[0] ?? "").trim() !== "");
}

export interface CsvTable {
  header: string[];
  records: Record<string, string>[];
}

export function csvToRecords(text: string): CsvTable {
  const rows = parseCsv(text);
  const header = (rows[0] ?? []).map((h) => h.trim());
  const records = rows.slice(1).map((r) => {
    const rec: Record<string, string> = {};
    header.forEach((h, idx) => {
      rec[h] = (r[idx] ?? "").trim();
    });
    return rec;
  });
  return { header, records };
}

export function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [header.join(",")];
  for (const r of rows) lines.push(r.map(csvEscape).join(","));
  return lines.join("\n") + "\n";
}
