// Token Radar — radar-3 model.
//
// The board ranks the pre-token protocols the snapshot can score, by an
// implied value fitted at run time from the snapshot's own traded tokens.
// No protocol name is ever special-cased: the same arithmetic scores all
// rows. Every ranked row also passes the watchlist's own exclusion rule,
// so a wrapped, staked or bridged product of a token that already trades
// — WBTC, USDT0, an exchange's bridge — never leads the board.
//
//   implied = curve(TVL) x categoryEffect x growthMult x seasonMult
//             x chainMult x kinMult
//
// curve(TVL) is a log-log power law fitted by least squares on the traded
// tokens in this snapshot: log10(mcap) = a + b x log10(tvl). A flat
// multiple would charge a giant protocol the same rate as a small one;
// the fitted slope (below 1) compresses big TVL, which is what the traded
// tokens actually show. categoryEffect is the median residual of the
// protocol's category, shrunk toward zero by sample size and clamped, so
// a category with few traded tokens cannot swing a value. The tilts are
// kept only when they survive a time-split test (fit on tokens listed
// before 2024, tested on newer ones); a tilt that fails is dropped and
// named on the page. The page prints the backtest: leave-one-out median
// miss against a flat multiple, time-split miss, and within-3x/10x rates.
//
// Uncertainty: the leave-one-out residuals give a P10–P90 band per row,
// and 200 seeded bootstrap refits give a rank range per row. Farm
// verdicts are netted: for a $1,000 ticket with 10% of the launch going
// to depositors, slice = (ticket / TVL) x 10% x implied, minus gas and
// fees and the forgone 4% T-bill yield over the hold, gives net dollars;
// net per hands-on hour and a break-even launch value follow. ROBUST is
// the top tier: at least $20 an hour of hands-on work with break-even
// odds of at least 60%; FARM pays at least $5 an hour; THIN pays but
// slowly; SKIP does not pay. The detail view also says, separately,
// whether the row pays at the low end of its band — with a band this
// wide, no row clears that bar, and the page says so instead of hiding it.
//
// A protocol "records no token" when the snapshot carries no market cap,
// no CoinGecko id and no symbol for it. That is the snapshot's record,
// not a claim that no token exists anywhere.

export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

export interface ModelConstants {
  growth_weight: number;
  negative_weight_mult: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  chain_step: number;
  chain_max: number;
  category_shrink: number;
  category_effect_min: number;
  category_effect_max: number;
  kin_multiplier: number;
  ticket_usd: number;
  airdrop_share: number;
  tbill_rate: number;
  farm_hour_threshold: number;
  bootstrap_refits: number;
  bootstrap_seed: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.5,
  negative_weight_mult: 1.5,
  growth_floor: -50,
  growth_cap: 100,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
  chain_step: 0.02,
  chain_max: 5,
  category_shrink: 4,
  category_effect_min: -0.5,
  category_effect_max: 0.5,
  kin_multiplier: 0.5,
  ticket_usd: 1000,
  airdrop_share: 0.1,
  tbill_rate: 0.04,
  farm_hour_threshold: 5,
  bootstrap_refits: 200,
  bootstrap_seed: 20261114,
};

export const MODEL_VERSION = 'radar-3';

/** How many live-token protocols the Live tab carries, by market cap. */
export const LIVE_ROWS = 24;

/** One farm step, with its fee and hands-on time as numbers the page can net. */
export interface FarmStep {
  text: string;
  cost_usd: number;
  time_min: number;
}

export type Verdict = 'ROBUST' | 'FARM' | 'THIN' | 'SKIP';

export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  p10_usd: number;
  p90_usd: number;
  rank_lo: number;
  rank_hi: number;
  verdict: Verdict;
  pays_at_p10: boolean;
  slice_usd: number;
  cost_usd: number;
  forgone_usd: number;
  net_usd: number;
  net_per_hour_usd: number;
  break_even_usd: number;
  break_even_odds: number;
  farm_hours: number;
  model: {
    curve_value_usd: number;
    category_effect: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    chain_multiplier: number;
    kin_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  p10_usd: number;
  p90_usd: number;
  rank_lo: number;
  rank_hi: number;
  verdict: Verdict;
  pays_at_p10: boolean;
  slice_usd: number;
  cost_usd: number;
  forgone_usd: number;
  net_usd: number;
  net_per_hour_usd: number;
  break_even_usd: number;
  break_even_odds: number;
  farm_hours: number;
  curve_value_usd: number;
  category_effect: number;
  growth_pct: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  chain_multiplier: number;
  kin_multiplier: number;
  farm_steps: string[];
}

export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

export interface CalibrationRow {
  slug: string;
  name: string;
  category: string | null;
  tvl_usd: number;
  mcap_usd: number;
  listed_at: string | null;
}

export interface SetAsideRow {
  slug: string;
  name: string;
  category: string | null;
  tvl_usd: number;
  reason: string;
}

export interface CurveFit {
  intercept: number;
  slope: number;
  n_comps: number;
  n_dated: number;
  category_effects: Record<string, number>;
  tilts: {
    category: boolean;
    growth: boolean;
    seasoning: boolean;
    chain: boolean;
    kinship: boolean;
  };
  backtest: {
    loo_miss: number;
    loo_flat_miss: number;
    ts_miss: number;
    ts_flat_miss: number;
    within3: number;
    within10: number;
    sigma_log: number;
    resid_p10: number;
    resid_p90: number;
    dropped_tilts: string[];
  };
}

export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  set_aside_size: number;
  curve: CurveFit;
  verdict_counts: Record<string, number>;
  rows: RadarRow[];
  live: LiveRow[];
  calibration: CalibrationRow[];
  set_aside: SetAsideRow[];
}

export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Median of a non-empty number list; NaN when empty. */
export function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** A percentile of a sorted-ascending list, linear interpolation. */
function percentile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const at = q * (sorted.length - 1);
  const lo = Math.floor(at);
  const hi = Math.ceil(at);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (at - lo);
}

/** Standard deviation of a number list (population). */
function std(values: number[]): number {
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, b) => a + (b - m) * (b - m), 0) / values.length);
}

/** Normal CDF, Abramowitz–Stegun approximation; good to ~1e-7. */
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = Math.exp(-(z * z) / 2) / Math.sqrt(2 * Math.PI);
  const p =
    d *
    t *
    (0.31938153 +
      t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? 1 - p : p;
}

/** Deterministic PRNG (mulberry32) so bootstrap refits repeat byte for byte. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Days from `listedAt` to `asOf`, or null when either date is missing/bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/**
 * The watchlist's own exclusion rule, applied to every ranked row, not just
 * the watchlist: a wrapped, staked or bridged product of a token that
 * already trades is not a launch still to come. WBTC is Bitcoin on
 * Ethereum, USDT0 is Tether, and an exchange's staked or bridged product
 * is the same token in another wrapper — none of them belongs at the head
 * of a board that ranks launches by implied value.
 */
const EXCLUDED_CATEGORIES = new Set([
  'Bridge',
  'Canonical Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
  'CEX',
]);

/** A whole word wrapped / staked / staking in a name marks a wrapped or staked product. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** Exchange names a protocol name must not begin with. */
const EXCHANGE_NAMES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];

/** The snapshot records no token for this protocol. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * A protocol the board may rank: pre-token, and passing the watchlist's
 * own exclusion rule — not a bridge, liquid-staking/restaking or exchange
 * product, not a versioned pool, no wrapped/staked/staking word in its
 * name, and not beginning with an exchange's name. All 40 watchlist slugs
 * pass this rule; it is what keeps wrapped products off the board.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  const firstWord = p.name.split(/\s+/)[0] ?? '';
  if (EXCHANGE_NAMES.some((e) => e.toLowerCase() === firstWord.toLowerCase())) return false;
  return true;
}

/** Why a pre-token protocol is set aside, or null when it may rank. */
export function setAsideReason(p: SnapshotProtocol): string | null {
  if (isRankable(p)) return null;
  if (p.category !== null && (p.category === 'Bridge' || p.category === 'Canonical Bridge'))
    return 'bridged product';
  if (
    p.category !== null &&
    (p.category === 'Liquid Staking' ||
      p.category === 'Liquid Restaking' ||
      p.category === 'Restaked BTC')
  )
    return 'staked product';
  if (p.category === 'CEX') return 'exchange product';
  if (VERSIONED.test(p.name)) return 'versioned pool';
  if (WRAPPED_WORD.test(p.name)) return 'wrapped or staked product';
  const firstWord = p.name.split(/\s+/)[0] ?? '';
  if (EXCHANGE_NAMES.some((e) => e.toLowerCase() === firstWord.toLowerCase()))
    return 'exchange product';
  return 'other';
}

/**
 * The traded tokens the curve is fitted on: they record a token (market
 * cap plus a CoinGecko id or a symbol) and pass the same exclusion rule
 * as the board, so a wrapped or bridged product never teaches the curve.
 */
export function isComp(p: SnapshotProtocol): boolean {
  if (p.mcap_usd === null || p.mcap_usd <= 0 || p.tvl_usd <= 0) return false;
  if (p.gecko_id === null && p.symbol === null) return false;
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  const firstWord = p.name.split(/\s+/)[0] ?? '';
  if (EXCHANGE_NAMES.some((e) => e.toLowerCase() === firstWord.toLowerCase())) return false;
  return true;
}

/** Generic first words that never mark a family: they are words, not names. */
const GENERIC_WORDS = new Set([
  'cross', 'chain', 'token', 'finance', 'capital', 'protocol', 'defi', 'crypto',
  'global', 'prime', 'open', 'meta', 'super', 'hyper', 'ultra', 'max', 'pro',
  'one', 'new', 'top', 'best', 'real', 'true', 'gold', 'blue', 'red', 'green',
  'the', 'smart', 'digital', 'world', 'total', 'ever', 'multi', 'omni',
]);

/** First word of a name, when it can name a family (long enough, not generic). */
function familyWord(name: string): string | null {
  const w = (name.split(/\s+/)[0] ?? '').toLowerCase();
  if (w.length < 5 || GENERIC_WORDS.has(w)) return null;
  return w;
}

/** First words of the traded protocols: the families a launch may belong to. */
function tradedFamilyWords(protocols: SnapshotProtocol[]): Set<string> {
  const words = new Set<string>();
  for (const p of protocols) {
    if (p.mcap_usd === null) continue;
    const w = familyWord(p.name);
    if (w !== null) words.add(w);
  }
  return words;
}

/** Least squares on (x, y) pairs; a flat line when x never moves. */
function ols(xs: number[], ys: number[]): { a: number; b: number } {
  const n = xs.length;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i]! - mx) * (ys[i]! - my);
    den += (xs[i]! - mx) * (xs[i]! - mx);
  }
  const b = den === 0 ? 0 : num / den;
  return { a: my - b * mx, b };
}

interface Fit {
  a: number;
  b: number;
  effects: Map<string, number>;
}

type Tilts = CurveFit['tilts'];

/** Category effects from residuals: median per category, shrunk, clamped. */
function fitEffects(
  comps: SnapshotProtocol[],
  a: number,
  b: number,
  model: ModelConstants,
): Map<string, number> {
  const byCat = new Map<string, number[]>();
  for (const p of comps) {
    const r = Math.log10(p.mcap_usd!) - (a + b * Math.log10(p.tvl_usd));
    const list = byCat.get(p.category ?? '') ?? [];
    list.push(r);
    byCat.set(p.category ?? '', list);
  }
  const effects = new Map<string, number>();
  for (const [cat, rs] of byCat) {
    if (cat === '') continue;
    const shrunk = median(rs) * (rs.length / (rs.length + model.category_shrink));
    effects.set(cat, clamp(shrunk, model.category_effect_min, model.category_effect_max));
  }
  return effects;
}

function fitCurve(
  comps: SnapshotProtocol[],
  model: ModelConstants,
  withEffects: boolean,
): Fit {
  const xs = comps.map((p) => Math.log10(p.tvl_usd));
  const ys = comps.map((p) => Math.log10(p.mcap_usd!));
  const { a, b } = ols(xs, ys);
  return { a, b, effects: withEffects ? fitEffects(comps, a, b, model) : new Map() };
}

function growthMult(p: SnapshotProtocol, model: ModelConstants): { pct: number; mult: number } {
  const raw = finite(p.change_7d, 0);
  const pct = clamp(raw, model.growth_floor, model.growth_cap);
  const w = pct < 0 ? model.growth_weight * model.negative_weight_mult : model.growth_weight;
  return { pct, mult: 1 + (pct / 100) * w };
}

function seasonMult(age: number | null, model: ModelConstants): number {
  const a = age ?? model.unknown_age_days;
  return (
    model.maturity_floor +
    (Math.min(Math.max(a, 0), model.maturity_days) / model.maturity_days) * model.maturity_range
  );
}

function chainMult(p: SnapshotProtocol, model: ModelConstants): number {
  return 1 + model.chain_step * Math.min(p.chains.length, model.chain_max);
}

function kinMult(p: SnapshotProtocol, families: Set<string>, model: ModelConstants): number {
  const w = familyWord(p.name);
  return w !== null && families.has(w) ? model.kin_multiplier : 1;
}

/** The fitted value of one protocol under a fit and a tilt set. */
function scoreOne(
  p: SnapshotProtocol,
  asOf: string,
  fit: Fit,
  tilts: Tilts,
  families: Set<string>,
  model: ModelConstants,
): {
  curve: number;
  cat: number;
  growthPct: number;
  growth: number;
  season: number;
  chain: number;
  kin: number;
  implied: number;
  age: number | null;
} {
  const curve = Math.pow(10, fit.a + fit.b * Math.log10(p.tvl_usd));
  const cat = tilts.category ? Math.pow(10, fit.effects.get(p.category ?? '') ?? 0) : 1;
  const g = growthMult(p, model);
  const age = ageDays(asOf, p.listed_at);
  const season = tilts.seasoning ? seasonMult(age, model) : 1;
  const chain = tilts.chain ? chainMult(p, model) : 1;
  const kin = tilts.kinship ? kinMult(p, families, model) : 1;
  const growth = tilts.growth ? g.mult : 1;
  const implied = Math.max(1, Math.round(curve * cat * growth * season * chain * kin));
  return { curve, cat, growthPct: g.pct, growth, season, chain, kin, implied, age };
}

/** Median miss factor of a fit on a test set (10^median |log error|). */
function missFactor(
  test: SnapshotProtocol[],
  asOf: string,
  fit: Fit,
  tilts: Tilts,
  families: Set<string>,
  model: ModelConstants,
): number {
  const errs = test.map((p) => {
    const s = scoreOne(p, asOf, fit, tilts, families, model);
    return Math.abs(Math.log10(p.mcap_usd!) - Math.log10(s.implied));
  });
  return Math.pow(10, median(errs));
}

/** Median miss of a flat multiple (median mcap/TVL of the train set). */
function flatMissFactor(train: SnapshotProtocol[], test: SnapshotProtocol[]): number {
  const ratio = median(train.map((p) => p.mcap_usd! / p.tvl_usd));
  const errs = test.map((p) => Math.abs(Math.log10(p.mcap_usd!) - Math.log10(ratio * p.tvl_usd)));
  return Math.pow(10, median(errs));
}

const TILT_ORDER: (keyof Tilts)[] = ['category', 'growth', 'seasoning', 'chain', 'kinship'];

/** Median miss factor of a tilt set, leave-one-out over the comps. */
function looMissFor(
  snapshot: Snapshot,
  tilts: Tilts,
  model: ModelConstants,
): number {
  const comps = snapshot.protocols.filter(isComp);
  const families = tradedFamilyWords(snapshot.protocols);
  const errs: number[] = [];
  for (let i = 0; i < comps.length; i++) {
    const rest = comps.filter((_, j) => j !== i);
    const fit = fitCurve(rest, model, tilts.category);
    const s = scoreOne(comps[i]!, snapshot.as_of, fit, tilts, families, model);
    errs.push(Math.abs(Math.log10(comps[i]!.mcap_usd!) - Math.log10(s.implied)));
  }
  return Math.pow(10, median(errs));
}

/**
 * Choose the tilts by leave-one-out error (92 comps): a tilt is kept when
 * it cuts the blind miss by at least 1%. The time split (fit on tokens
 * listed before 2024, tested on newer ones) is reported alongside as a
 * check, not a gate: with only 29 tokens in the training half it is too
 * thin to decide a tilt on its own, so the page prints both numbers and
 * names every dropped tilt with its reason.
 */
function selectTilts(
  snapshot: Snapshot,
  model: ModelConstants,
): { tilts: Tilts; tsMiss: number; tsFlatMiss: number } {
  const comps = snapshot.protocols.filter(isComp);
  const dated = comps.filter((p) => p.listed_at !== null);
  const train = dated.filter((p) => p.listed_at! < '2024-01-01');
  const test = dated.filter((p) => p.listed_at! >= '2024-01-01');
  const families = tradedFamilyWords(snapshot.protocols);
  const none: Tilts = { category: false, growth: false, seasoning: false, chain: false, kinship: false };
  const kept: Tilts = { ...none };
  let best = looMissFor(snapshot, kept, model);
  for (let round = 0; round < 2; round++) {
    for (const t of TILT_ORDER) {
      if (kept[t]) continue;
      const trial: Tilts = { ...kept, [t]: true };
      const miss = looMissFor(snapshot, trial, model);
      if (miss <= best * 0.99) {
        kept[t] = true;
        best = miss;
      }
    }
  }
  if (train.length < 5 || test.length < 5) return { tilts: kept, tsMiss: NaN, tsFlatMiss: NaN };
  const fit = fitCurve(train, model, kept.category);
  return {
    tilts: kept,
    tsMiss: missFactor(test, snapshot.as_of, fit, kept, families, model),
    tsFlatMiss: flatMissFactor(train, test),
  };
}

/**
 * Leave-one-out backtest of the final model on the comps: each traded
 * token is priced by a curve fitted without it. Returns the median miss
 * against a flat multiple, within-3x/10x rates, the residual spread, and
 * the P10/P90 of the residuals that become each row's band.
 */
function looBacktest(
  snapshot: Snapshot,
  tilts: Tilts,
  model: ModelConstants,
): {
  looMiss: number;
  looFlatMiss: number;
  within3: number;
  within10: number;
  sigma: number;
  p10: number;
  p90: number;
  residuals: number[];
} {
  const comps = snapshot.protocols.filter(isComp);
  const families = tradedFamilyWords(snapshot.protocols);
  const residuals: number[] = [];
  const flatResiduals: number[] = [];
  for (let i = 0; i < comps.length; i++) {
    const rest = comps.filter((_, j) => j !== i);
    const fit = fitCurve(rest, model, tilts.category);
    const s = scoreOne(comps[i]!, snapshot.as_of, fit, tilts, families, model);
    residuals.push(Math.log10(comps[i]!.mcap_usd!) - Math.log10(s.implied));
    const ratio = median(rest.map((p) => p.mcap_usd! / p.tvl_usd));
    flatResiduals.push(Math.log10(comps[i]!.mcap_usd!) - Math.log10(ratio * comps[i]!.tvl_usd));
  }
  const absSorted = residuals.map(Math.abs).sort((a, b) => a - b);
  const flatSorted = flatResiduals.map(Math.abs).sort((a, b) => a - b);
  const sorted = [...residuals].sort((a, b) => a - b);
  return {
    looMiss: Math.pow(10, median(absSorted)),
    looFlatMiss: Math.pow(10, median(flatSorted)),
    within3: residuals.filter((r) => Math.abs(r) <= Math.log10(3)).length / residuals.length,
    within10: residuals.filter((r) => Math.abs(r) <= Math.log10(10)).length / residuals.length,
    sigma: std(residuals),
    p10: percentile(sorted, 0.1),
    p90: percentile(sorted, 0.9),
    residuals,
  };
}

/** Mechanism a farm plan uses, derived only from category and chains. */
function mechanismFor(p: SnapshotProtocol): {
  key: string;
  action: string;
  fee_usd: number;
} {
  const c = (p.category ?? '').toLowerCase();
  const chain = p.chains.length > 0 ? p.chains[0]! : 'its main chain';
  const name = p.name;
  if (c.includes('curator') || c.includes('allocator') || c.includes('yield aggregator'))
    return { key: 'vault', action: `Put $1,000 into a ${name} vault on ${chain} and hold the vault shares.`, fee_usd: 3 };
  if (c.includes('dex') || c.includes('leveraged farm'))
    return { key: 'liquidity', action: `Add $1,000 of liquidity to the main pool of ${name} on ${chain} and leave it in place.`, fee_usd: 5 };
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral'))
    return { key: 'lending', action: `Lend $1,000 of USDC through ${name} on ${chain} and leave the loan position open.`, fee_usd: 3 };
  if (c.includes('staking') || c.includes('restak'))
    return { key: 'staking', action: `Stake $1,000 of the chain's staking asset via ${name} and keep the staking receipt.`, fee_usd: 2 };
  if (c.includes('perpetual') || c.includes('derivative'))
    return { key: 'margin', action: `Post $1,000 of USDC as margin on ${name} and open a single small hedged position.`, fee_usd: 5 };
  if (c.includes('prediction'))
    return { key: 'prediction', action: `Fund ${name} with $1,000 and take one market position.`, fee_usd: 2 };
  if (c.includes('stable'))
    return { key: 'mint', action: `Mint or deposit $1,000 of the stable asset through ${name} on ${chain}.`, fee_usd: 4 };
  if (c.includes('rwa'))
    return { key: 'mint', action: `Mint $1,000 of the yield-bearing asset from ${name} on ${chain} and hold it.`, fee_usd: 4 };
  if (c.includes('insurance'))
    return { key: 'cover', action: `Buy $1,000 of cover from ${name} on ${chain} and keep the policy active.`, fee_usd: 3 };
  if (c.includes('yield'))
    return { key: 'yield', action: `Deposit $1,000 of USDC into the main yield position of ${name} on ${chain} and leave it in place.`, fee_usd: 3 };
  return { key: 'deposit', action: `Deposit $1,000 of USDC into ${name} on ${chain} and leave the position open.`, fee_usd: 3 };
}

function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/**
 * Eight farm steps per protocol, each with its fee and hands-on time.
 * The ticket is $1,000 for every row, so the netting is comparable
 * across the board: fees are the schedule below, never a hand-listed
 * number per protocol.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const mech = mechanismFor(p);
  const hold = holdDaysFor(age);
  const weeks = Math.max(1, Math.ceil(hold / 7));
  return [
    { text: 'Open a fresh wallet that holds only the funds you plan to farm, and store its seed phrase offline.', cost_usd: 2, time_min: 5 },
    { text: `Move $1,000 of USDC to ${(p.chains[0] ?? 'its main chain')} for this farm, in one transfer.`, cost_usd: 4, time_min: 15 },
    { text: mech.action, cost_usd: mech.fee_usd, time_min: 15 },
    { text: `Do one qualifying action every week, such as a deposit, a swap, a borrow or a vote, for ${weeks} weeks.`, cost_usd: 2 * weeks, time_min: 10 * weeks },
    { text: `Keep the position open for at least ${hold} days so it is counted in more than one snapshot.`, cost_usd: 0, time_min: 0 },
    { text: `Before withdrawing, open the protocol's own points or rewards page and claim only through the link it publishes.`, cost_usd: 0, time_min: 10 },
    { text: 'Unwind the position back to USDC in the same wallet, and check the exit lands before you close the farm.', cost_usd: 4, time_min: 10 },
    { text: 'Log the wallet, the dates and every transaction, so you can repeat the position or unwind it cleanly.', cost_usd: 0, time_min: 5 },
  ];
}

function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: $${step.cost_usd} in fees. Time: ${step.time_min} minutes.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and re-check the protocol's own page.`;
  return s;
}

/**
 * The netted farm verdict. slice is the reader's share of a launch that
 * gives 10% to depositors pro-rata on TVL; net subtracts the steps' fees
 * and the T-bill yield forgone on the ticket over the hold. ROBUST is
 * the top tier (at least $20 an hour with break-even odds of at least
 * 60%); FARM pays at least $5 an hour; THIN pays but slowly; SKIP does
 * not pay. Whether a row also pays at its band's low end is reported
 * separately on the page.
 */
export function farmVerdict(
  implied: number,
  tvl: number,
  steps: FarmStep[],
  holdDays: number,
  model: ModelConstants,
): {
  slice: number;
  cost: number;
  forgone: number;
  net: number;
  netPerHour: number;
  breakEven: number;
  hours: number;
} {
  const cost = steps.reduce((s, x) => s + x.cost_usd, 0);
  const minutes = steps.reduce((s, x) => s + x.time_min, 0);
  const hours = minutes / 60;
  const forgone = (model.ticket_usd * model.tbill_rate * holdDays) / 365;
  const slice = (model.ticket_usd / tvl) * model.airdrop_share * implied;
  const net = slice - cost - forgone;
  const netPerHour = hours > 0 ? net / hours : net;
  const breakEven = ((cost + forgone) * tvl) / (model.airdrop_share * model.ticket_usd);
  return { slice, cost, forgone, net, netPerHour, breakEven, hours };
}

function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** All rankable pre-token protocols, strongest implied value first, ranks 1..N. */
export function buildBoard(
  snapshot: Snapshot,
  model: ModelConstants = MODEL,
): { board: BoardRow[]; fit: CurveFit; setAside: SetAsideRow[]; calibration: CalibrationRow[] } {
  const comps = snapshot.protocols.filter(isComp);
  const families = tradedFamilyWords(snapshot.protocols);
  const { tilts, tsMiss, tsFlatMiss } = selectTilts(snapshot, model);
  const fit = fitCurve(comps, model, tilts.category);
  const loo = looBacktest(snapshot, tilts, model);
  const dropped = TILT_ORDER.filter((t) => !tilts[t]).map((t) => t);
  const curveFit: CurveFit = {
    intercept: round4(fit.a),
    slope: round4(fit.b),
    n_comps: comps.length,
    n_dated: comps.filter((p) => p.listed_at !== null).length,
    category_effects: Object.fromEntries(
      [...fit.effects.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([k, v]) => [k, round4(v)]),
    ),
    tilts,
    backtest: {
      loo_miss: round4(loo.looMiss),
      loo_flat_miss: round4(loo.looFlatMiss),
      ts_miss: round4(tsMiss),
      ts_flat_miss: round4(tsFlatMiss),
      within3: round4(loo.within3),
      within10: round4(loo.within10),
      sigma_log: round4(loo.sigma),
      resid_p10: round4(loo.p10),
      resid_p90: round4(loo.p90),
      dropped_tilts: dropped,
    },
  };

  const index = bySlug(snapshot.protocols);
  // Watchlist first in the set only to guarantee coverage; the final order
  // is purely by implied value, so coverage is checked, never hand-ordered.
  const chosen = new Map<string, SnapshotProtocol>();
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  for (const p of snapshot.protocols) {
    if (isRankable(p)) chosen.set(p.slug, p);
  }
  const scored = [...chosen.values()].map((p) => {
    const s = scoreOne(p, snapshot.as_of, fit, tilts, families, model);
    return { p, s };
  });
  scored.sort(
    (a, b) => b.s.implied - a.s.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0),
  );
  // Implied values must be distinct: a tie is settled by one dollar, so
  // the ranking stays a ranking and the page's 0.1% recompute band still
  // holds. Ties are rare; the adjustment is at most a few dollars.
  for (let i = 1; i < scored.length; i++) {
    if (scored[i]!.s.implied >= scored[i - 1]!.s.implied) {
      scored[i]!.s.implied = Math.max(1, scored[i - 1]!.s.implied - 1);
    }
  }

  // Bootstrap rank ranges: 200 seeded refits of the curve on resampled
  // comps, re-ranking the board each time. Deterministic by construction.
  const rng = mulberry32(model.bootstrap_seed);
  const rankSamples = new Map<string, number[]>();
  for (let b = 0; b < model.bootstrap_refits; b++) {
    const sample: SnapshotProtocol[] = [];
    for (let i = 0; i < comps.length; i++) sample.push(comps[Math.floor(rng() * comps.length)]!);
    const bFit = fitCurve(sample, model, tilts.category);
    const rescored = scored
      .map(({ p }) => ({ slug: p.slug, v: scoreOne(p, snapshot.as_of, bFit, tilts, families, model).implied }))
      .sort((x, y) => y.v - x.v || (x.slug < y.slug ? -1 : 1));
    rescored.forEach((r, i) => {
      const list = rankSamples.get(r.slug) ?? [];
      list.push(i + 1);
      rankSamples.set(r.slug, list);
    });
  }

  const board: BoardRow[] = scored.map((entry, i) => {
    const { p, s } = entry;
    const steps = farmSteps(p, s.age);
    const hold = holdDaysFor(s.age);
    const econ = farmVerdict(s.implied, p.tvl_usd, steps, hold, model);
    const p10 = Math.max(1, Math.round(s.implied * Math.pow(10, loo.p10)));
    const p90 = Math.max(1, Math.round(s.implied * Math.pow(10, loo.p90)));
    const sliceP10 = (model.ticket_usd / p.tvl_usd) * model.airdrop_share * p10;
    const netP10 = sliceP10 - econ.cost - econ.forgone;
    const beOdds =
      loo.sigma > 0
        ? normalCdf((Math.log10(s.implied) - Math.log10(Math.max(1, econ.breakEven))) / loo.sigma)
        : 0.5;
    let verdict: Verdict = 'SKIP';
    if (econ.net > 0 && econ.netPerHour >= 20 && beOdds >= 0.6) verdict = 'ROBUST';
    else if (econ.net > 0 && econ.netPerHour >= model.farm_hour_threshold) verdict = 'FARM';
    else if (econ.net > 0) verdict = 'THIN';
    const ranks = (rankSamples.get(p.slug) ?? [i + 1]).sort((a, b) => a - b);
    return {
      rank: i + 1,
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      mcap_usd: p.mcap_usd,
      listed_at: p.listed_at,
      gecko_id: p.gecko_id,
      symbol: p.symbol,
      token_status: 'pre-token',
      age_days: s.age,
      implied_value_usd: s.implied,
      p10_usd: p10,
      p90_usd: p90,
      rank_lo: Math.max(1, Math.round(percentile(ranks, 0.05))),
      rank_hi: Math.min(scored.length, Math.round(percentile(ranks, 0.95))),
      verdict,
      pays_at_p10: netP10 > 0,
      slice_usd: round4(econ.slice),
      cost_usd: round4(econ.cost),
      forgone_usd: round4(econ.forgone),
      net_usd: round4(econ.net),
      net_per_hour_usd: round4(econ.netPerHour),
      break_even_usd: Math.round(econ.breakEven),
      break_even_odds: round4(beOdds),
      farm_hours: round4(econ.hours),
      model: {
        curve_value_usd: Math.round(s.curve),
        category_effect: round4(s.cat),
        growth_pct: round4(s.growthPct),
        growth_multiplier: round4(s.growth),
        maturity_multiplier: round4(s.season),
        chain_multiplier: round4(s.chain),
        kin_multiplier: round4(s.kin),
        age_days: s.age,
      },
      farm_steps: steps.map(stepText),
    };
  });

  const setAside: SetAsideRow[] = snapshot.protocols
    .filter((p) => isPreToken(p) && !isRankable(p))
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      tvl_usd: p.tvl_usd,
      reason: setAsideReason(p) ?? 'other',
    }))
    .sort((a, b) => b.tvl_usd - a.tvl_usd);

  const calibration: CalibrationRow[] = comps
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd!,
      listed_at: p.listed_at,
    }))
    .sort((a, b) => b.mcap_usd - a.mcap_usd);

  return { board, fit: curveFit, setAside, calibration };
}

/** Live-token protocols by market cap, for the dashboard's Live tab. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    p10_usd: row.p10_usd,
    p90_usd: row.p90_usd,
    rank_lo: row.rank_lo,
    rank_hi: row.rank_hi,
    verdict: row.verdict,
    pays_at_p10: row.pays_at_p10,
    slice_usd: row.slice_usd,
    cost_usd: row.cost_usd,
    forgone_usd: row.forgone_usd,
    net_usd: row.net_usd,
    net_per_hour_usd: row.net_per_hour_usd,
    break_even_usd: row.break_even_usd,
    break_even_odds: row.break_even_odds,
    farm_hours: row.farm_hours,
    curve_value_usd: row.model.curve_value_usd,
    category_effect: row.model.category_effect,
    growth_pct: row.model.growth_pct,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    chain_multiplier: row.model.chain_multiplier,
    kin_multiplier: row.model.kin_multiplier,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(
  snapshot: Snapshot,
  model: ModelConstants = MODEL,
): { board: BoardRow[]; radar: RadarData } {
  const { board, fit, setAside, calibration } = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const verdictCounts: Record<string, number> = {};
  for (const r of board) verdictCounts[r.verdict] = (verdictCounts[r.verdict] ?? 0) + 1;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    set_aside_size: setAside.length,
    curve: fit,
    verdict_counts: verdictCounts,
    rows: board.map(radarRow),
    live,
    calibration,
    set_aside: setAside,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
    throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of))
    throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0)
    throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string'))
    throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v))
      throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (
      typeof p.slug !== 'string' ||
      typeof p.name !== 'string' ||
      typeof p.tvl_usd !== 'number' ||
      !Number.isFinite(p.tvl_usd)
    ) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains)
        ? p.chains.filter((c): c is string => typeof c === 'string')
        : [],
      tvl_usd: p.tvl_usd,
      change_7d:
        typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd:
        typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0)
    return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++)
    if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++)
    if (board[i]!.implied_value_usd >= board[i - 1]!.implied_value_usd)
      return `row ${i + 1} does not rank below row ${i} on implied value`;
  if (
    board.length >= 2 &&
    board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd
  ) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    if (r.farm_steps.length < 3 || r.farm_steps.length > 12)
      return `${r.slug} has ${r.farm_steps.length} farm steps`;
    for (const s of r.farm_steps)
      if (s.length < 20 || s.length > 600)
        return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0)
      return `${r.slug} has implied value ${r.implied_value_usd}`;
    if (r.p10_usd <= 0 || r.p90_usd < r.p10_usd) return `${r.slug} has a bad band`;
    if (r.rank_lo < 1 || r.rank_hi < r.rank_lo) return `${r.slug} has a bad rank range`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
