import { SIGNAL_FULL, SIGNAL_UNIT, fmtNum, heatStyle } from "../lib/format";
import type { SignalName } from "../lib/types";

interface SignalCellProps {
  name: SignalName;
  raw: number | null;
  normalized: number | null;
}

/** Dense colored cell: normalized heat + raw value, tooltip with the details. */
export function SignalCell({ name, raw, normalized }: SignalCellProps) {
  const title =
    raw === null
      ? `${SIGNAL_FULL[name]}: not computable (insufficient data)`
      : `${SIGNAL_FULL[name]}: raw ${fmtNum(raw)} ${SIGNAL_UNIT[name]} · normalized ${fmtNum(
          normalized,
        )}`;
  return (
    <td className="signal-cell num" style={heatStyle(normalized)} title={title}>
      {raw === null ? "·" : fmtNum(raw, name === "gradeCompression" ? 2 : 1)}
    </td>
  );
}
