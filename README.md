[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/terasoa/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/terasoa/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

# Token Radar

Token Radar ranks the protocols that record no token yet by what a launch
would be worth, and shows a reader how to farm each one — and whether
farming pays. It reads a sealed DefiLlama snapshot (758 protocols, fetched
2026-11-14), scores all 198 rankable pre-token protocols — the 40 on the
watchlist plus 158 more, above and below the $50M floor — and hands in a
static dashboard: a sortable, filterable board with a P10–P90 band and a
rank range per row, netted farm verdicts, a detail view for every protocol
with its model breakdown and farm plan, a budget allocator, a model lab,
and set-aside, calibration and backtest tabs.

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

## The model (radar-3)

Implied value is the model's claim, not a promise, and it never predicts
whether or when a token is issued:

```
implied = 10^(3.9578 + 0.394 x log10(TVL)) x growthMult x seasonMult
```

The curve is a least-squares fit on the 92 traded tokens in this snapshot
that pass the same exclusion rule as the board. A flat multiple would
charge a giant protocol the same rate as a small one; the fitted slope
below 1 compresses big TVL, which is what the traded tokens show.

- **growthMult** — `1 + clamp(change_7d, -50, 100) / 100 x 0.5`, with a fall
  penalised 1.5x.
- **seasonMult** — `0.6 + min(age_days, 1095) / 1095 x 0.4`; an unknown age
  uses 365 days. Age is the time since DefiLlama first listed the protocol.

Five tilts were tested by leave-one-out error and kept only when they cut
the blind miss by at least 1%: growth and seasoning survived. Category
effects, the chain tilt and kinship did not, so they are not in the model —
and the page says so. The time split (fit on tokens listed before 2024,
tested on newer ones) is reported alongside as a check, not the gate.

Backtest, priced blind on the 92 comparables: leave-one-out median miss
x2.98 against x4.65 for a flat multiple; time-split miss x2.18 against
x4.52 flat; 50% of blind prices land within 3x, 77% within 10x. Each row
carries a P10–P90 band from the blind residuals and a rank range over 200
seeded bootstrap refits of the curve.

No protocol name is special-cased: the same function scores every row, and
the dashboard recomputes each row in the page and checks it against
`board.json` — the page prints how many of the 198 rows match. A protocol
is called pre-token only when the snapshot records no token for it (no
market cap, no CoinGecko id, no symbol) — that is the snapshot's record,
never a claim that no token exists.

## Farm verdicts

Each row carries an eight-step farm plan for a $1,000 ticket, derived from
the protocol's own category, chains, TVL and age, with what each step costs
and how long it takes. The verdict nets it: slice is the reader's share if
10% of the launch goes to depositors pro-rata on TVL, minus gas and fees
and the forgone 4% T-bill yield over the hold. ROBUST pays at least $20 an
hour of hands-on work with break-even odds of at least 60%; FARM pays at
least $5 an hour; THIN pays but slowly; SKIP does not pay. Counts on this
board: ROBUST 1, FARM 36, THIN 35, SKIP 126. The detail view also shows
the net at $1K / $10K / $100K tickets against 5% / 10% / 20% drops, and
whether the row pays at the low end of its band. "Farm this budget" takes
a budget and hours per week and allocates them across the farms that pay
best per hour.

## Files

- `main.ts` — the entry program: reads the snapshot, writes `board.json`,
  `data.js`, copies `dashboard/` and `screenshots/`, writes `dossier.json`.
- `lib/model.ts` — the radar-3 model, the board builder, the backtest and
  the farm verdicts.
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
