# GrailWatch

**Collectibles accumulation detector.** Influencers and whales quietly buy thin-supply vintage
collectibles for months before publishing the video that reprices the market. GrailWatch is built
to catch the *quiet* phase: it scores accumulation probability nightly and alerts when price and
volume start moving while public attention stays flat.

This is **not a price tracker**. Price trackers report the past. GrailWatch looks for
**divergence** — the market microstructure of someone clearing a book before a reveal:

- low grades rising in lockstep with high grades (an accumulator buys *any* copy)
- active listings draining while sold volume accelerates
- a dead card suddenly getting graded again
- all of it happening **without** a matching move in Google Trends

Target universe: first-print English manga, Dragon Ball Carddass (1988–1997), CoroCoro-era
Pokémon promos, Yu-Gi-Oh! tournament/prize cards. `soccer` is supported and intentionally empty.

---

## Quickstart (zero API keys)

Prerequisites: **Node 24+** (works on 22.12+), **pnpm 10**, **PostgreSQL** running locally.

```bash
cp .env.example .env                # defaults work; set DATABASE_URL if yours differs
createdb grailwatch                 # or: sudo -u postgres createdb grailwatch

pnpm install && pnpm run db:migrate && pnpm run seed && pnpm run dev
```

Open **http://localhost:5173**. The seed loads a 20-card starter universe with ~9 months of
deterministic synthetic market/pop/attention data containing three planted quiet-accumulation
patterns (Berserk Vol. 1, Carddass No.1 Goku Prism, CoroCoro Pikachu #025), two already-viral
patterns that must NOT trigger (Naruto Vol. 1, Topsun Charizard), and fifteen flat/drift cards.

On first boot the API notices there are snapshots but no scores and **runs scoring
automatically** (`ENABLE_BOOTSTRAP_SCORE`), so the leaderboard shows three `TRIGGERED` rows and
the Alert Feed has three alerts within a few seconds of `pnpm run dev` — no API keys, no manual
jobs. (Alert "email" delivery is a console stub; you'll see the alerts printed in the API log.)

```bash
pnpm run test          # all unit tests (signal engine + ingest parsers)
pnpm run typecheck     # strict TS across every package
pnpm run job:ingest    # manual nightly ingest (CSV sources only until you add keys)
pnpm run job:score     # manual scoring run
pnpm run job:deliver   # manual alert delivery
```

---

## Architecture

```
apps/
  api/            Express 5 API + node-cron wiring + manual job runners
  web/            React 19 + Vite dashboard (leaderboard, card detail, alerts, universe)
packages/
  shared/         env (zod-validated), logger, CSV utils, date helpers, scoring vocabulary
  db/             Drizzle schema + migrations, upserts, seed, synthetic CSV generator
  signals/        PURE scoring engine — no DB, no env, fully unit tested
  ingest/         source adapters + nightly jobs (ingest / score / deliver)
```

```
PriceCharting ─┐
eBay Browse  ──┤  MarketSource[]  ─┐
seed/user CSV ─┘                   │
PSA pop page ──┐                   ├─►  canonical snapshot tables  ─►  signal engine  ─►  signal_scores
CGC census  ───┤  PopSource[]  ────┤    (market / pop / attention)     (5 signals +        + alerts
seed/user CSV ─┘                   │     idempotent upserts             composite)             │
Google Trends ─┬  AttentionSource[]┘                                                          ▼
seed/user CSV ─┘                                                              Discord webhook · email stub
                                                                              API · web dashboard
```

Every write is an **idempotent upsert** keyed on the snapshot unique constraints
(`card_id, grade, snapshot_date` — plus `grader` for pop, plus `topic, source` for attention), so
re-running any job or re-importing any CSV refreshes rather than duplicates.

Postgres enums cover franchises, categories, graders, and attention sources; all date-range
queries run against `(card_id, snapshot_date)` composite indexes.

---

## The signals — exact math

All five signals are pure functions in `packages/signals/src/` with explicit data-sufficiency
gates (insufficient history ⇒ `null`, never a guess). Raw values are normalized to 0–1 by the
saturation caps in `packages/shared/src/scoring.ts` (`NORMALIZATION_SCALE`).

### 1. `velocity_z` — price moving vs its own history

Per grade: mean of daily average sale prices over the trailing **30 days**, z-scored against the
**180 days immediately before** that window:

```
z_grade = (mean(price, last 30d) − mean(price, prior 180d)) / max(stddev(price, prior 180d), 1% of mean)
velocity_z = max over grades
```

Gates: a grade needs **≥ 10 sales** and ≥ 20 priced days in the baseline, ≥ 3 priced days in the
window. The 1%-of-mean stddev floor keeps a dead-flat book from dividing by ~zero while still
letting it score huge when it finally moves. Normalized: `z / 3`. Default trigger threshold: **1.5**.

### 2. `supply_drain` — the book being cleared

```
supply_drain = Δ%sold − Δ%listings
Δ%sold     = (sales last 30d − sales prior 30d) / max(prior, 1) × 100
Δ%listings = (7d-smoothed listing count now − 30d ago) / then × 100     (summed across grades)
```

Large positive = buying accelerating while the shelf empties. Sellers flooding into hype makes it
small or negative — which is exactly why it helps separate accumulation from virality.
Normalized: `pp / 50`. Threshold: **+25pp**.

### 3. `grade_compression` — accumulators buy ANY copy

Over **60 days** in 7-day buckets, split graded prices into LOW (≤ 4) and HIGH (≥ 7) cohorts
(raw/`all` rows excluded). Each grade becomes a relative index (divided by its first populated
bucket) so $40 PSA 2s and $3,000 PSA 10s are comparable; the cohort index is the mean.

```
ratioScore = clamp01((lowGrowth / highGrowth) / 0.7)      ← the 70% rule from the thesis
corrFactor = 0.5 + 0.5 · max(corr(lowIndex, highIndex), 0)
magnitude  = clamp01(lowGrowth / 5)                        ← ±1% noise isn't a signal
score      = ratioScore · corrFactor · magnitude           ∈ [0, 1]
```

Special case: highs flat (≤ 0.5%) while lows move ≥ 3% ⇒ `clamp01(0.7 + lowGrowth/50)` — lows
moving with no public bid for gems is the purest accumulation shape. Threshold: **0.7**.

### 4. `pop_delta` — a dead card suddenly getting graded

Total population is a step function per (grader, grade) — the latest snapshot at or before a date
counts. Compare the last **60 days** against the card's **own 12-month norm**:

```
current = %change(totalPop, last 60d)
norm    = mean of %change over 60d windows sampled at monthly offsets, 2–12 months back
pop_delta = current − norm            (percentage points; needs ≥ 3 norm samples)
```

Normalized: `pp / 15`. Threshold: **+5pp** over norm.

### 5. `attention_divergence` — THE core signal

```
slope     = least-squares slope of daily attention score, trailing 60d
relSlope% = slope × 60 / max(mean(attention, prior 120d), 1) × 100
attention_divergence = velocity_z − (relSlope% / 100) × 3
```

The slope is normalized against the **pre-window baseline level**, so a 15→90 Trends explosion
registers as several z-equivalents even though the index caps at 100. High price velocity + flat
attention ⇒ large positive = quiet accumulation. High both ⇒ ~0 or negative = already public,
deprioritized. Normalized: `/3`. Threshold: **1.25**.

### Composite & trigger

```
composite = Σ weight_i · normalized_i / Σ weight_i     (over signals that computed)
triggered = composite ≥ 0.65  AND  ≥ 2 raw signals at/above their thresholds
```

Null signals drop out and the remaining weights renormalize; a signal that computed to **zero**
(e.g. divergence killed by an attention spike) still counts against the composite — that's the
mechanism that keeps already-viral cards out of the feed. Defaults:

| signal | weight | threshold (raw) |
|---|---|---|
| attention_divergence | 0.30 | ≥ 1.25 z |
| velocity_z | 0.25 | ≥ 1.5 z |
| supply_drain | 0.20 | ≥ +25pp |
| grade_compression | 0.15 | ≥ 0.70 |
| pop_delta | 0.10 | ≥ +5pp |

The test suite (`pnpm --filter @grailwatch/signals test`, 41 cases) includes the three mandated
proofs: a synthetic quiet-accumulation series **triggers**, an already-viral series **does not**,
and a flat market scores **near zero**.

---

## Nightly jobs

Wired with node-cron in the API bootstrap (`apps/api/src/index.ts`), all env-configurable:

| job | default | what it does |
|---|---|---|
| `ingest:nightly` | `0 2 * * *` | run every registered adapter for all cards, upsert snapshots |
| `score:nightly` | `45 2 * * *` | compute signals as of the latest snapshot date, write `signal_scores`, create alerts for **newly** triggered cards |
| `alerts:deliver` | `0 3 * * *` | Discord webhook embed (card, composite, top-2 plain-English reasons, link to the card page) + email console stub; `delivered_channels` prevents double-sends |

Manual runs: `pnpm run job:ingest` / `job:score` / `job:deliver`. Set `DISCORD_WEBHOOK_URL` to get
real Discord pings; alert links use `WEB_BASE_URL`.

---

## Data sources

Every adapter degrades gracefully: **missing key = logged warning + skip, never a crash.**
Per-card failures are caught and logged; a source-level throw is recorded in the run summary and
the run continues.

| source | kind | env | notes |
|---|---|---|---|
| CSV files | market/pop/attention | `CSV_SOURCE_DIR` | the zero-key path; point it at `packages/db/seed-data` or your own exports |
| PriceCharting | market (backbone) | `PRICECHARTING_API_KEY` | sold comps per grade via their legacy field mapping (loose→raw, cib→7, new→8, graded→9, box-only→9.5, manual-only→PSA 10, prices in pennies), volume on an aggregate row |
| eBay Browse | market (listings) | `EBAY_APP_ID` + `EBAY_CERT_ID` | client-credentials OAuth; active-listing counts per card query → grade `all`; feeds supply drain |
| PSA pop report | pop | — | scrapes only cards with `psa_pop_url` set; 1 req/2s, 20h disk cache, honest User-Agent (`SCRAPER_CONTACT`) |
| CGC census | pop | — | same pattern via `cgc_pop_url`, for graded manga/comics |
| Google Trends | attention | `ENABLE_GOOGLE_TRENDS` | unofficial API, no key; rate limiting is detected and backed off, never fatal |

### CSV formats

Cards are referenced by exact `card_name` (or `card_id`). Unknown names are reported, not fatal.

```
market.csv     card_name,grade,snapshot_date,avg_sale_price,median_sale_price,sale_count,active_listing_count,source
pop.csv        card_name,grader,grade,snapshot_date,population
attention.csv  card_name,topic,snapshot_date,source,score
cards.csv      name,franchise,set_name,card_number,language,category,notes
```

Import via the Universe screen, `POST /api/import/csv?kind=…` (raw `text/csv` body or JSON
`{"csv": "…"}`), or by pointing `CSV_SOURCE_DIR` at a directory for the nightly run.
Grades use the canonical vocabulary: `raw`, `psa_2`…`psa_10`, `psa_9_5`, `cgc_9_8`, `bgs_9_5`, …

---

## Adding a new market source

One new file + one registry line:

```ts
// packages/ingest/src/adapters/my-source.ts
import type { Card } from "@grailwatch/db";
import type { MarketSnapshotInput, MarketSource } from "../types";

export class MySource implements MarketSource {
  name = "my_source";

  disabled(): string | null {
    return process.env.MY_SOURCE_KEY ? null : "MY_SOURCE_KEY not set";
  }

  async fetchSnapshots(cards: Card[], since: Date): Promise<MarketSnapshotInput[]> {
    // fetch per card, catch per card, return canonical rows
    return [];
  }
}
```

```ts
// packages/ingest/src/registry.ts   ← THE one registration point
market: [new CsvMarketSource(csvDir), new PriceChartingSource(), new EbayBrowseSource(), new MySource()],
```

Rules that keep the pipeline safe: report missing config through `disabled()` (the runner logs and
skips); catch per-card errors inside `fetchSnapshots`; return canonical rows and let the runner's
idempotent upserts handle writes. `PopSource` and `AttentionSource` work identically.

---

## Tuning weights

- **UI:** Universe → Signal weights. Edits are stored in the `app_config` table and used by the
  next scoring run (weights don't need to sum to 1 — they're renormalized).
- **API:** `PUT /api/config/weights` with `{"weights": {"attentionDivergence": 0.4}}` (partial
  updates merge; the sum must stay > 0).
- Raise `attentionDivergence` to be stricter about *quiet* setups; raise `velocityZ`/`supplyDrain`
  if you care more about raw momentum than stealth; `popDelta` is the earliest but noisiest tell.
- Trigger thresholds, the 0.65 composite trigger, and the min-2-signals rule live in the same
  config row (defaults in `packages/shared/src/scoring.ts`); normalization caps are
  `NORMALIZATION_SCALE` in the same file.

---

## API

`GET /api/healthz` · `GET /api/cards?franchise=&watchlist=&q=` · `POST /api/cards` ·
`GET /api/cards/:id?days=` · `GET /api/alerts?since=` · `GET /api/leaderboard` ·
`GET|POST /api/watchlists` · `GET|PUT /api/config/weights` · `POST /api/import/csv?kind=`

Zod-validated inputs; every failure returns `{ "error": { "code", "message", "details?" } }`;
requests are logged with status + latency.

---

## Implementation notes

- **Seed data spans 270 days (market/attention) and 15 monthly pop snapshots**, not just the
  ~90-day scenario window — the spec'd math needs a 180-day velocity baseline and a 12-month pop
  norm, so the scenarios play out in the last 90 days on top of a full baseline. Regenerate
  deterministically with `pnpm run seed:regen-csvs [END_DATE]`.
- **Migrations are generated on demand** (`drizzle/` output is gitignored per project convention):
  `pnpm run db:migrate` runs `drizzle-kit generate` (no-op when the schema hasn't changed) and then
  `drizzle-kit migrate`. The schema in `packages/db/src/schema.ts` is the source of truth.
- The pop-snapshot unique key includes `grader` (PSA 9 and CGC 9 must not collide); attention's
  unique key uses `NULLS NOT DISTINCT` so topic-only rows dedupe correctly.
- `cards.psa_pop_url` / `cards.cgc_pop_url` (nullable) gate the scrapers — no URL, no request.
- Velocity tolerates a partially-populated baseline (min 20 priced days / 10 sales) so the system
  still works on sparser real-world data; with the full seed the whole 180-day window is used.

## Roadmap

Real email delivery · YouTube/X attention adapters (schema already supports them) · per-watchlist
alert routing · auth (single-user assumption today) · retention/compaction for snapshot tables.

## License

MIT © BAFlorida
