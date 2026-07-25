interface SparklineProps {
  points: { d: string; p: number }[];
  width?: number;
  height?: number;
}

/** Dependency-free inline sparkline; green when the window is up, red when down. */
export function Sparkline({ points, width = 130, height = 30 }: SparklineProps) {
  if (points.length < 2) return <span className="dim">—</span>;
  const values = points.map((pt) => pt.p);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (points.length - 1);
  const path = points
    .map((pt, i) => {
      const x = i * step;
      const y = height - 3 - ((pt.p - min) / span) * (height - 6);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const first = values[0]!;
  const last = values[values.length - 1]!;
  const color = last >= first ? "var(--accent)" : "var(--warn)";
  const lastX = (points.length - 1) * step;
  const lastY = height - 3 - ((last - min) / span) * (height - 6);
  return (
    <svg width={width} height={height} className="sparkline" aria-hidden>
      <path d={path} fill="none" stroke={color} strokeWidth="1.4" />
      <circle cx={lastX} cy={lastY} r="2" fill={color} />
    </svg>
  );
}
