[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/terasoa/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/terasoa/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

# Token Radar

Token Radar ranks the protocols that record no token yet by what a launch
would be worth, and shows a reader how to farm each one. It reads a sealed
DefiLlama snapshot (758 protocols, fetched 2026-11-14), scores all 198
rankable pre-token protocols — the 40 on the watchlist plus 158 more, above
and below the $50M floor — and hands in a static dashboard: a sortable,
filterable board, a detail view for every protocol with its model breakdown
and farm plan, and a live-token tab that sets the already-trading protocols
aside with their market caps.

This is an entry for the [make.fun](https://make.fun/c/token-radar-01)
token-radar-01 bounty ($1,325, 10 paid places).

## Run

Node 22 or later, nothing to install — `main.ts` uses the standard library
only, and the dashboard is plain static files with no network requests.

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
# then serve out/ and open out/dashboard/
python3 -m http.server --directory out 8080
```

Run it twice and the outputs are byte-identical: the program is
deterministic, and the sealed snapshot never moves.

## The model (radar-2)

Implied value is the model's claim, not a promise, and it never predicts
whether or when a token is issued:

```
implied = round(tvl_usd x categoryMultiple x growthMult x maturityMult x chainMult)
```

- **categoryMultiple** — for the protocol's category, the median
  market-cap-to-TVL ratio of the live-token protocols in that category in
  this snapshot, clamped to [0.05, 0.80]. A category with fewer than 3 live
  samples, or a null category, uses the overall live median (0.20).
- **growthMult** — `1 + clamp(change_7d, -50, 100) / 100 x 0.5`, with a fall
  penalised 1.5x the weight of a rise.
- **maturityMult** — `0.6 + min(age_days, 1095) / 1095 x 0.4`; an unknown age
  uses 365 days. Age is the time since DefiLlama first listed the protocol.
- **chainMult** — `1 + 0.02 x min(chains, 5)`.

No protocol name is special-cased: the same function scores every row, and
the dashboard recomputes each row in the page and checks it against
`board.json`. A protocol is called pre-token only when the snapshot records
no token for it (no market cap, no CoinGecko id, no symbol) — that is the
snapshot's record, never a claim that no token exists.

Each row carries a six-step farm plan derived from the protocol's own
category, chains, TVL and age, with what each step costs and how long it
takes.

## Files

- `main.ts` — the entry program: reads the snapshot, writes `board.json`,
  `data.js`, copies `dashboard/` and `screenshots/`, writes `dossier.json`.
- `lib/model.ts` — the radar-2 model, the board builder and the farm plans.
- `vendor/makefun-board.ts` — make.fun's dossier library, verbatim from the kit.
- `dashboard/` — the static page: `index.html`, `app.css`, `app.js`.
- `screenshots/` — the three screenshots the dossier carries.

## Screenshots

| File | View |
| --- | --- |
| `screenshots/1-board.jpg` | The board, strongest implied value first |
| `screenshots/2-detail.jpg` | Detail view, rank-1 protocol (Steakhouse Financial) |
| `screenshots/3-filtered.jpg` | Filtered view, Dexs category |

## License

MIT — see `LICENSE`.
