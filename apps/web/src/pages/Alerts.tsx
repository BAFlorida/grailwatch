import { Link } from "wouter";
import { FRANCHISE_LABELS, fmtDate, fmtNum } from "../lib/format";
import { useApi } from "../lib/hooks";
import type { AlertRow } from "../lib/types";

export function AlertsPage() {
  const { data, error, loading } = useApi<{ alerts: AlertRow[] }>("/api/alerts");

  if (loading && !data) return <div className="panel dim">Loading alerts…</div>;
  if (error) return <div className="panel error">API error: {error}</div>;

  const alerts = data?.alerts ?? [];
  const byDate = new Map<string, AlertRow[]>();
  for (const alert of alerts) {
    const arr = byDate.get(alert.runDate) ?? [];
    arr.push(alert);
    byDate.set(alert.runDate, arr);
  }

  return (
    <>
      <div className="page-head">
        <h1>Alert Feed</h1>
        <div className="kpis">
          <span className="kpi">
            total <strong>{alerts.length}</strong>
          </span>
        </div>
      </div>
      {alerts.length === 0 && (
        <div className="panel dim">
          No alerts yet. They appear when a card newly crosses the trigger rule during a scoring
          run.
        </div>
      )}
      {[...byDate.entries()].map(([date, dateAlerts]) => (
        <section key={date} className="alert-day">
          <h2 className="date-head">{fmtDate(date)}</h2>
          {dateAlerts.map((alert) => (
            <article key={alert.id} className="panel alert-card">
              <header>
                <Link href={`/cards/${alert.cardId}`} className="card-link big">
                  {alert.cardName}
                </Link>
                <span className={`badge f-${alert.franchise}`}>
                  {FRANCHISE_LABELS[alert.franchise]}
                </span>
                <span className="composite accent big">{fmtNum(alert.compositeScore)}</span>
              </header>
              <ul className="reasons">
                {alert.reasons.map((reason, i) => (
                  <li key={i}>{reason}</li>
                ))}
              </ul>
              <footer className="dim">
                delivered:{" "}
                {alert.deliveredChannels.length > 0 ? alert.deliveredChannels.join(", ") : "pending"}
              </footer>
            </article>
          ))}
        </section>
      ))}
    </>
  );
}
