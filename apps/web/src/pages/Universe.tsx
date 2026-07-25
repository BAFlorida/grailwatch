import { useEffect, useState } from "react";
import { Link } from "wouter";
import { sendCsv, sendJson } from "../lib/api";
import { FRANCHISE_LABELS, SIGNAL_FULL, SIGNAL_UNIT, fmtNum } from "../lib/format";
import { useApi } from "../lib/hooks";
import {
  SIGNAL_NAMES,
  type Card,
  type CardsResponse,
  type ImportSummary,
  type ScoringConfig,
  type SignalName,
  type Watchlist,
} from "../lib/types";

const FRANCHISES = ["pokemon", "yugioh", "manga", "dbz_carddass", "soccer", "other"] as const;
const CATEGORIES = ["card", "book", "sealed"] as const;
const IMPORT_KINDS = ["market", "pop", "attention", "cards"] as const;

const EMPTY_FORM = {
  name: "",
  franchise: "pokemon" as (typeof FRANCHISES)[number],
  setName: "",
  cardNumber: "",
  language: "",
  category: "card" as (typeof CATEGORIES)[number],
  notes: "",
  psaPopUrl: "",
  cgcPopUrl: "",
};

type Msg = { kind: "ok" | "err"; text: string } | null;

export function UniversePage() {
  const cardsApi = useApi<CardsResponse>("/api/cards");
  const watchlistsApi = useApi<{ watchlists: Watchlist[] }>("/api/watchlists");
  const configApi = useApi<{ config: ScoringConfig }>("/api/config/weights");

  // ── add card ────────────────────────────────────────────────────────────
  const [form, setForm] = useState(EMPTY_FORM);
  const [formMsg, setFormMsg] = useState<Msg>(null);

  const submitCard = async () => {
    try {
      const { card } = await sendJson<{ card: Card }>("/api/cards", "POST", {
        ...form,
        setName: form.setName || null,
        cardNumber: form.cardNumber || null,
        language: form.language || null,
        notes: form.notes || null,
        psaPopUrl: form.psaPopUrl || null,
        cgcPopUrl: form.cgcPopUrl || null,
      });
      setFormMsg({ kind: "ok", text: `Created "${card.name}" (#${card.id})` });
      setForm(EMPTY_FORM);
      cardsApi.refetch();
    } catch (err) {
      setFormMsg({ kind: "err", text: err instanceof Error ? err.message : String(err) });
    }
  };

  // ── watchlists ──────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [wlLabel, setWlLabel] = useState("");
  const [wlMsg, setWlMsg] = useState<Msg>(null);

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const loadWatchlist = (wl: Watchlist) => {
    setSelected(new Set(wl.cardIds));
    setWlLabel(wl.label);
    setWlMsg({ kind: "ok", text: `Editing "${wl.label}" — adjust selection and save` });
  };

  const saveWatchlist = async () => {
    if (!wlLabel.trim()) {
      setWlMsg({ kind: "err", text: "Watchlist needs a label" });
      return;
    }
    try {
      const res = await sendJson<{ watchlist: Watchlist }>("/api/watchlists", "POST", {
        label: wlLabel.trim(),
        cardIds: [...selected],
      });
      setWlMsg({
        kind: "ok",
        text: `Saved "${res.watchlist.label}" with ${res.watchlist.cardIds.length} cards`,
      });
      watchlistsApi.refetch();
    } catch (err) {
      setWlMsg({ kind: "err", text: err instanceof Error ? err.message : String(err) });
    }
  };

  // ── CSV import ──────────────────────────────────────────────────────────
  const [importKind, setImportKind] = useState<(typeof IMPORT_KINDS)[number]>("market");
  const [csvText, setCsvText] = useState("");
  const [importMsg, setImportMsg] = useState<Msg>(null);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result ?? ""));
    reader.readAsText(file);
  };

  const runImport = async () => {
    if (!csvText.trim()) {
      setImportMsg({ kind: "err", text: "Paste CSV or choose a file first" });
      return;
    }
    try {
      const { summary } = await sendCsv<{ summary: ImportSummary }>(
        `/api/import/csv?kind=${importKind}`,
        csvText,
      );
      const unknown =
        summary.unknownNames.length > 0
          ? ` · unknown names: ${summary.unknownNames.slice(0, 5).join("; ")}${
              summary.unknownNames.length > 5 ? "…" : ""
            }`
          : "";
      setImportMsg({
        kind: "ok",
        text: `Imported ${summary.imported} ${summary.kind} rows (${summary.skipped} skipped)${unknown}`,
      });
      cardsApi.refetch();
    } catch (err) {
      setImportMsg({ kind: "err", text: err instanceof Error ? err.message : String(err) });
    }
  };

  // ── weights ─────────────────────────────────────────────────────────────
  const [weights, setWeights] = useState<Record<SignalName, number> | null>(null);
  const [weightsMsg, setWeightsMsg] = useState<Msg>(null);
  useEffect(() => {
    if (configApi.data && weights === null) setWeights(configApi.data.config.weights);
  }, [configApi.data, weights]);

  const saveWeights = async () => {
    if (!weights) return;
    try {
      const res = await sendJson<{ config: ScoringConfig }>("/api/config/weights", "PUT", {
        weights,
      });
      setWeights(res.config.weights);
      setWeightsMsg({ kind: "ok", text: "Weights saved — next scoring run uses them" });
    } catch (err) {
      setWeightsMsg({ kind: "err", text: err instanceof Error ? err.message : String(err) });
    }
  };

  const cards = cardsApi.data?.cards ?? [];
  const config = configApi.data?.config ?? null;
  const weightSum = weights
    ? Object.values(weights).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0)
    : 0;

  return (
    <>
      <div className="page-head">
        <h1>Universe Manager</h1>
        <div className="kpis">
          <span className="kpi">
            cards <strong>{cards.length}</strong>
          </span>
          <span className="kpi">
            watchlists <strong>{watchlistsApi.data?.watchlists.length ?? 0}</strong>
          </span>
        </div>
      </div>

      <div className="panel">
        <h3>Add card</h3>
        <div className="form-grid">
          <label>
            name*
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Berserk Vol. 1 (1st Printing)"
            />
          </label>
          <label>
            franchise
            <select
              value={form.franchise}
              onChange={(e) =>
                setForm({ ...form, franchise: e.target.value as (typeof FRANCHISES)[number] })
              }
            >
              {FRANCHISES.map((f) => (
                <option key={f} value={f}>
                  {FRANCHISE_LABELS[f]}
                </option>
              ))}
            </select>
          </label>
          <label>
            category
            <select
              value={form.category}
              onChange={(e) =>
                setForm({ ...form, category: e.target.value as (typeof CATEGORIES)[number] })
              }
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label>
            set
            <input
              value={form.setName}
              onChange={(e) => setForm({ ...form, setName: e.target.value })}
              placeholder="Dark Horse, 2003"
            />
          </label>
          <label>
            number
            <input
              value={form.cardNumber}
              onChange={(e) => setForm({ ...form, cardNumber: e.target.value })}
            />
          </label>
          <label>
            language
            <input
              value={form.language}
              onChange={(e) => setForm({ ...form, language: e.target.value })}
            />
          </label>
          <label>
            PSA pop URL
            <input
              value={form.psaPopUrl}
              onChange={(e) => setForm({ ...form, psaPopUrl: e.target.value })}
              placeholder="https://www.psacard.com/pop/…"
            />
          </label>
          <label>
            CGC pop URL
            <input
              value={form.cgcPopUrl}
              onChange={(e) => setForm({ ...form, cgcPopUrl: e.target.value })}
            />
          </label>
          <label className="wide">
            notes
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </label>
        </div>
        <div className="form-actions">
          <button className="primary" onClick={submitCard} disabled={!form.name.trim()}>
            Add card
          </button>
          {formMsg && <span className={`msg ${formMsg.kind}`}>{formMsg.text}</span>}
        </div>
      </div>

      <div className="panel">
        <h3>Cards &amp; watchlists</h3>
        <div className="wl-controls">
          <span className="dim">saved:</span>
          {(watchlistsApi.data?.watchlists ?? []).map((wl) => (
            <button key={wl.id} className="chip clickable" onClick={() => loadWatchlist(wl)}>
              {wl.label} ({wl.cardIds.length})
            </button>
          ))}
          <span className="spacer" />
          <input
            placeholder="watchlist label"
            value={wlLabel}
            onChange={(e) => setWlLabel(e.target.value)}
          />
          <button className="primary" onClick={saveWatchlist}>
            Save selection ({selected.size})
          </button>
        </div>
        {wlMsg && <div className={`msg ${wlMsg.kind}`}>{wlMsg.text}</div>}
        <table className="data">
          <thead>
            <tr>
              <th />
              <th>Card</th>
              <th>Franchise</th>
              <th>Set</th>
              <th>Category</th>
              <th className="num">Composite</th>
            </tr>
          </thead>
          <tbody>
            {cards.map((card) => (
              <tr key={card.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selected.has(card.id)}
                    onChange={() => toggle(card.id)}
                  />
                </td>
                <td>
                  <Link href={`/cards/${card.id}`} className="card-link">
                    {card.name}
                  </Link>
                </td>
                <td>
                  <span className={`badge f-${card.franchise}`}>
                    {FRANCHISE_LABELS[card.franchise]}
                  </span>
                </td>
                <td className="dim">{card.setName}</td>
                <td className="dim">{card.category}</td>
                <td className="num">{fmtNum(card.latestScore?.compositeScore ?? null)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h3>CSV import</h3>
        <p className="dim">
          Headers — market: <code>card_name,grade,snapshot_date,avg_sale_price,median_sale_price,sale_count,active_listing_count,source</code>{" "}
          · pop: <code>card_name,grader,grade,snapshot_date,population</code> · attention:{" "}
          <code>card_name,topic,snapshot_date,source,score</code> · cards:{" "}
          <code>name,franchise,set_name,card_number,language,category,notes</code>
        </p>
        <div className="import-row">
          <select
            value={importKind}
            onChange={(e) => setImportKind(e.target.value as (typeof IMPORT_KINDS)[number])}
          >
            {IMPORT_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} />
          <button className="primary" onClick={runImport}>
            Import
          </button>
          {importMsg && <span className={`msg ${importMsg.kind}`}>{importMsg.text}</span>}
        </div>
        <textarea
          rows={6}
          placeholder="…or paste CSV here"
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
        />
      </div>

      <div className="panel">
        <h3>Signal weights</h3>
        {config && weights ? (
          <>
            <table className="data weights-table">
              <thead>
                <tr>
                  <th>Signal</th>
                  <th className="num">Weight</th>
                  <th className="num">Trigger threshold (raw)</th>
                </tr>
              </thead>
              <tbody>
                {SIGNAL_NAMES.map((name) => (
                  <tr key={name}>
                    <td>{SIGNAL_FULL[name]}</td>
                    <td className="num">
                      <input
                        className="weight-input"
                        type="number"
                        step="0.05"
                        min="0"
                        value={weights[name]}
                        onChange={(e) =>
                          setWeights({ ...weights, [name]: Number(e.target.value) })
                        }
                      />
                    </td>
                    <td className="num dim">
                      ≥ {config.thresholds[name]} {SIGNAL_UNIT[name]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="form-actions">
              <span className="dim">
                sum {weightSum.toFixed(2)} (renormalized over computable signals) · trigger:
                composite ≥ {config.compositeTrigger} and ≥ {config.minSignalsAbove} signals above
                threshold
              </span>
              <button className="primary" onClick={saveWeights}>
                Save weights
              </button>
              {weightsMsg && <span className={`msg ${weightsMsg.kind}`}>{weightsMsg.text}</span>}
            </div>
          </>
        ) : (
          <div className="dim">Loading config…</div>
        )}
      </div>
    </>
  );
}
