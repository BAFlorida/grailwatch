import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Sparkline } from "../components/Sparkline";
import { SignalCell } from "../components/SignalCell";
import { FRANCHISE_LABELS, compositeColor, fmtDate, fmtNum } from "../lib/format";
import { useApi } from "../lib/hooks";
import { SIGNAL_NAMES, type LeaderboardResponse, type LeaderboardRow, type SignalName } from "../lib/types";

type SortKey = "composite" | "name" | SignalName;

function sortValue(row: LeaderboardRow, key: SortKey): number | string {
  if (key === "name") return row.card.name.toLowerCase();
  if (key === "composite") return row.score.compositeScore ?? -1;
  return row.score[key] ?? -Infinity;
}

export function LeaderboardPage() {
  const { data, error, loading } = useApi<LeaderboardResponse>("/api/leaderboard");
  const [sortKey, setSortKey] = useState<SortKey>("composite");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  const rows = useMemo(() => {
    const list = [...(data?.rows ?? [])];
    list.sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      if (va < vb) return -1 * sortDir;
      if (va > vb) return 1 * sortDir;
      return 0;
    });
    return list;
  }, [data, sortKey, sortDir]);

  const setSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(key === "name" ? 1 : -1);
    }
  };

  const arrow = (key: SortKey) => (sortKey === key ? (sortDir === -1 ? " ▾" : " ▴") : "");
  const triggeredCount = rows.filter((r) => r.score.triggered).length;

  if (loading && !data) return <div className="panel dim">Loading leaderboard…</div>;
  if (error) return <div className="panel error">API error: {error}</div>;
  if (!data?.runDate) {
    return (
      <div className="panel">
        <h1>Leaderboard</h1>
        <p className="dim">
          No signal scores yet. Seed the database (<code>pnpm run seed</code>) and start the API —
          scoring runs automatically on boot — or run <code>pnpm run job:score</code>.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="page-head">
        <h1>Leaderboard</h1>
        <div className="kpis">
          <span className="kpi">
            run <strong>{fmtDate(data.runDate)}</strong>
          </span>
          <span className="kpi">
            cards <strong>{rows.length}</strong>
          </span>
          <span className="kpi">
            triggered <strong className="accent">{triggeredCount}</strong>
          </span>
        </div>
      </div>
      <div className="panel table-panel">
        <table className="data">
          <thead>
            <tr>
              <th className="num">#</th>
              <th className="sortable" onClick={() => setSort("name")}>
                Card{arrow("name")}
              </th>
              <th>Franchise</th>
              <th className="sortable num" onClick={() => setSort("composite")}>
                Composite{arrow("composite")}
              </th>
              {SIGNAL_NAMES.map((name) => (
                <th key={name} className="sortable num" onClick={() => setSort(name)}>
                  {({
                    velocityZ: "VEL",
                    supplyDrain: "DRN",
                    gradeCompression: "CMP",
                    popDelta: "POP",
                    attentionDivergence: "DIV",
                  } as const)[name]}
                  {arrow(name)}
                </th>
              ))}
              <th>90d price</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.card.id} className={row.score.triggered ? "triggered" : ""}>
                <td className="num dim">{i + 1}</td>
                <td>
                  <Link href={`/cards/${row.card.id}`} className="card-link">
                    {row.card.name}
                  </Link>
                  <div className="sub dim">{row.card.setName}</div>
                </td>
                <td>
                  <span className={`badge f-${row.card.franchise}`}>
                    {FRANCHISE_LABELS[row.card.franchise]}
                  </span>
                </td>
                <td className="num">
                  <span className="composite" style={{ color: compositeColor(row.score.compositeScore) }}>
                    {fmtNum(row.score.compositeScore)}
                  </span>
                  <span className="scorebar">
                    <span
                      style={{
                        width: `${Math.round((row.score.compositeScore ?? 0) * 100)}%`,
                        background: compositeColor(row.score.compositeScore),
                      }}
                    />
                  </span>
                </td>
                {SIGNAL_NAMES.map((name) => (
                  <SignalCell
                    key={name}
                    name={name}
                    raw={row.score[name]}
                    normalized={row.normalized[name]}
                  />
                ))}
                <td>
                  <Sparkline points={row.sparkline} />
                </td>
                <td>{row.score.triggered ? <span className="trig-chip">TRIGGERED</span> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="footnote dim">
        VEL velocity z · DRN supply drain (pp) · CMP grade compression (0–1) · POP pop delta (pp
        over norm) · DIV attention divergence (z). Cell heat = normalized contribution. Triggered =
        composite ≥ trigger and ≥2 signals above their thresholds.
      </p>
    </>
  );
}
