import { useMemo } from "react";
import { Link, useParams } from "wouter";
import {
  CartesianGrid,
  Line,
  LineChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FRANCHISE_LABELS, SIGNAL_FULL, compositeColor, fmtDate, fmtNum } from "../lib/format";
import { useApi } from "../lib/hooks";
import { SIGNAL_NAMES, type CardDetailResponse } from "../lib/types";

const GRADE_COLORS = ["#5aa7ff", "#4cc38a", "#e0b84c", "#c678dd", "#e5484d", "#56b6c2"];
const SIGNAL_COLORS: Record<string, string> = {
  composite: "#ffffff",
  velocityZ: "#5aa7ff",
  supplyDrain: "#4cc38a",
  gradeCompression: "#e0b84c",
  popDelta: "#c678dd",
  attentionDivergence: "#e5484d",
};

function gradeRank(grade: string): number {
  const m = /^(?:psa|cgc|bgs)_(\d+)(?:_(\d+))?$/.exec(grade);
  if (m) return Number(m[1]) + (m[2] ? Number(m[2]) / 10 : 0);
  return grade === "raw" ? -1 : -2;
}

const axisProps = {
  stroke: "#232a37",
  tick: { fill: "#7d8ba1", fontSize: 10 },
  tickLine: false,
} as const;

const tooltipProps = {
  contentStyle: {
    background: "#171c26",
    border: "1px solid #232a37",
    borderRadius: 4,
    fontSize: 11,
  },
  labelStyle: { color: "#7d8ba1" },
} as const;

export function CardDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { data, error, loading } = useApi<CardDetailResponse>(
    Number.isFinite(id) && id > 0 ? `/api/cards/${id}?days=365` : null,
  );

  const grades = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of data?.marketSnapshots ?? []) {
      if (m.avgSalePrice !== null) counts.set(m.grade, (counts.get(m.grade) ?? 0) + 1);
    }
    // 2 highest + 2 lowest qualified grades, so grade compression is visible
    const qualified = [...counts.entries()]
      .filter(([, n]) => n >= 10)
      .map(([grade]) => grade)
      .sort((a, b) => gradeRank(b) - gradeRank(a));
    const picked = [...qualified.slice(0, 2), ...qualified.slice(-2)];
    return [...new Set(picked)];
  }, [data]);

  const priceRows = useMemo(() => {
    const byDate = new Map<string, Record<string, number | string | null>>();
    for (const m of data?.marketSnapshots ?? []) {
      const row = byDate.get(m.snapshotDate) ?? { date: m.snapshotDate, listings: null };
      if (m.avgSalePrice !== null && grades.includes(m.grade)) row[m.grade] = m.avgSalePrice;
      if (m.activeListingCount !== null) {
        row.listings = ((row.listings as number | null) ?? 0) + m.activeListingCount;
      }
      byDate.set(m.snapshotDate, row);
    }
    return [...byDate.values()].sort((a, b) =>
      String(a.date).localeCompare(String(b.date)),
    );
  }, [data, grades]);

  const attentionRows = useMemo(() => {
    const byDate = new Map<string, { total: number; n: number }>();
    for (const a of data?.attentionSnapshots ?? []) {
      const agg = byDate.get(a.snapshotDate) ?? { total: 0, n: 0 };
      agg.total += a.score;
      agg.n++;
      byDate.set(a.snapshotDate, agg);
    }
    return [...byDate.entries()]
      .map(([date, agg]) => ({ date, attention: agg.total / agg.n }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  const popRows = useMemo(() => {
    const byDate = new Map<string, Record<string, number | string>>();
    for (const p of data?.popSnapshots ?? []) {
      const row = byDate.get(p.snapshotDate) ?? { date: p.snapshotDate };
      const key = p.grade;
      row[key] = ((row[key] as number | undefined) ?? 0) + p.population;
      byDate.set(p.snapshotDate, row);
    }
    return [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [data]);

  const popGrades = useMemo(() => {
    const set = new Set<string>();
    for (const p of data?.popSnapshots ?? []) set.add(p.grade);
    return [...set].sort((a, b) => gradeRank(b) - gradeRank(a)).slice(0, 5);
  }, [data]);

  const historyRows = useMemo(
    () =>
      (data?.signalHistory ?? []).map((h) => ({
        date: h.runDate,
        composite: h.compositeScore,
        ...h.normalized,
      })),
    [data],
  );

  if (loading && !data) return <div className="panel dim">Loading card…</div>;
  if (error) return <div className="panel error">API error: {error}</div>;
  if (!data) return <div className="panel error">Card not found.</div>;

  const { card } = data;
  const latest = data.signalHistory[data.signalHistory.length - 1] ?? null;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="breadcrumb dim">
            <Link href="/">← leaderboard</Link>
          </div>
          <h1>{card.name}</h1>
          <div className="meta-chips">
            <span className={`badge f-${card.franchise}`}>{FRANCHISE_LABELS[card.franchise]}</span>
            {card.setName && <span className="chip">{card.setName}</span>}
            {card.cardNumber && <span className="chip">#{card.cardNumber}</span>}
            {card.language && <span className="chip">{card.language}</span>}
            <span className="chip">{card.category}</span>
          </div>
        </div>
        {latest && (
          <div className="score-block">
            <div className="composite huge" style={{ color: compositeColor(latest.compositeScore) }}>
              {fmtNum(latest.compositeScore)}
            </div>
            <div className="dim">composite · run {fmtDate(latest.runDate)}</div>
            {latest.triggered && <span className="trig-chip">TRIGGERED</span>}
          </div>
        )}
      </div>

      {latest && (
        <div className="sig-summary panel">
          {SIGNAL_NAMES.map((name) => (
            <div key={name} className="sig-item">
              <div className="dim">{SIGNAL_FULL[name]}</div>
              <div className="num big">{fmtNum(latest[name], name === "gradeCompression" ? 2 : 1)}</div>
              <div className="dim sub">norm {fmtNum(latest.normalized[name])}</div>
            </div>
          ))}
        </div>
      )}

      <div className="charts-grid">
        <div className="panel chart-panel">
          <h3>Price by grade · active listings (dashed, right)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={priceRows} syncId="card">
              <CartesianGrid stroke="#1b212c" strokeDasharray="3 3" />
              <XAxis dataKey="date" {...axisProps} minTickGap={40} />
              <YAxis yAxisId="price" {...axisProps} width={52} />
              <YAxis yAxisId="listings" orientation="right" {...axisProps} width={36} />
              <Tooltip {...tooltipProps} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {grades.map((grade, i) => (
                <Line
                  key={grade}
                  yAxisId="price"
                  dataKey={grade}
                  stroke={GRADE_COLORS[i % GRADE_COLORS.length]}
                  dot={false}
                  strokeWidth={1.4}
                  connectNulls
                />
              ))}
              <Line
                yAxisId="listings"
                dataKey="listings"
                stroke="#7d8ba1"
                strokeDasharray="4 3"
                dot={false}
                strokeWidth={1.2}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="panel chart-panel">
          <h3>Public attention (google trends)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={attentionRows} syncId="card">
              <CartesianGrid stroke="#1b212c" strokeDasharray="3 3" />
              <XAxis dataKey="date" {...axisProps} minTickGap={40} />
              <YAxis {...axisProps} width={36} domain={[0, 100]} />
              <Tooltip {...tooltipProps} />
              <Line dataKey="attention" stroke="#e5484d" dot={false} strokeWidth={1.4} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="panel chart-panel">
          <h3>Graded population history</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={popRows}>
              <CartesianGrid stroke="#1b212c" strokeDasharray="3 3" />
              <XAxis dataKey="date" {...axisProps} minTickGap={40} />
              <YAxis {...axisProps} width={52} />
              <Tooltip {...tooltipProps} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {popGrades.map((grade, i) => (
                <Line
                  key={grade}
                  type="stepAfter"
                  dataKey={grade}
                  stroke={GRADE_COLORS[i % GRADE_COLORS.length]}
                  dot={false}
                  strokeWidth={1.4}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="panel chart-panel">
          <h3>Signal history (normalized 0–1)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={historyRows}>
              <CartesianGrid stroke="#1b212c" strokeDasharray="3 3" />
              <XAxis dataKey="date" {...axisProps} minTickGap={40} />
              <YAxis {...axisProps} width={36} domain={[0, 1]} />
              <Tooltip {...tooltipProps} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line
                dataKey="composite"
                stroke={SIGNAL_COLORS.composite}
                strokeWidth={2}
                dot={historyRows.length < 15}
              />
              {SIGNAL_NAMES.map((name) => (
                <Line
                  key={name}
                  dataKey={name}
                  stroke={SIGNAL_COLORS[name]}
                  strokeWidth={1}
                  dot={historyRows.length < 15}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {data.alerts.length > 0 && (
        <div className="panel">
          <h3>Alerts for this card</h3>
          {data.alerts.map((alert) => (
            <div key={alert.id} className="alert-line">
              <span className="dim">{fmtDate(alert.runDate)}</span>
              <span className="composite accent">{fmtNum(alert.compositeScore)}</span>
              <span>{alert.reasons[0]}</span>
            </div>
          ))}
        </div>
      )}

      {card.notes && <p className="footnote dim">{card.notes}</p>}
    </>
  );
}
