/** "psa_10" → 10, "cgc_9_8" → 9.8, "bgs_9_5" → 9.5; "raw"/"all"/unknown → null. */
export function gradeNumeric(grade: string): number | null {
  const m = /^(?:psa|cgc|bgs)_(\d+)(?:_(\d+))?$/.exec(grade.toLowerCase());
  if (!m) return null;
  return Number(m[1]) + (m[2] ? Number(m[2]) / 10 : 0);
}

export function isLowGrade(grade: string, lowMax = 4): boolean {
  const n = gradeNumeric(grade);
  return n !== null && n <= lowMax;
}

export function isHighGrade(grade: string, highMin = 7): boolean {
  const n = gradeNumeric(grade);
  return n !== null && n >= highMin;
}

/** "psa_10" → "PSA 10", "cgc_9_8" → "CGC 9.8", "raw" → "Raw". */
export function formatGrade(grade: string): string {
  if (grade === "raw") return "Raw";
  if (grade === "all") return "All listings";
  const m = /^(psa|cgc|bgs)_(\d+)(?:_(\d+))?$/.exec(grade.toLowerCase());
  if (!m) return grade.toUpperCase();
  return `${m[1]!.toUpperCase()} ${m[2]}${m[3] ? `.${m[3]}` : ""}`;
}
