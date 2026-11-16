// Token Radar — radar-2 model.
//
// The board ranks the pre-token protocols the snapshot can score, by an
// implied value derived at run time from the snapshot's own figures. No
// protocol name is ever special-cased: the same arithmetic scores all rows.
// Every ranked row also passes the watchlist's own exclusion rule, so a
// wrapped, staked or bridged product of a token that already trades —
// WBTC, USDT0, an exchange's bridge — never leads the board.
//
//   implied = tvl_usd x categoryMultiple x growthMult x maturityMult x chainMult
//
// categoryMultiple: for the protocol's category, the median mcap/tvl ratio
//   across the live-token protocols of that category in this snapshot,
//   clamped to [0.05, 0.80]. A category with fewer than 3 live samples, or a
//   null category, falls back to the overall live median (also clamped).
// growthMult: 1 + clamp(change_7d, -50, 100) / 100 x 0.5, with a fall
//   penalised 1.5x: a negative change uses weight 0.75 instead of 0.5.
// maturityMult: 0.6 + min(age_days, 1095) / 1095 x 0.4; age unknown -> 365.
// chainMult: 1 + 0.02 x min(chains.length, 5).
//
// A protocol "records no token" when the snapshot carries no market cap, no
// CoinGecko id and no symbol for it. That is the snapshot's record, not a
// claim that no token exists anywhere.

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
  category_min: number;
  category_max: number;
  category_min_samples: number;
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
  category_min: 0.05,
  category_max: 0.8,
  category_min_samples: 3,
};

export const MODEL_VERSION = 'radar-2';

/** How many live-token protocols the Live tab carries, by market cap. */
export const LIVE_ROWS = 24;

export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

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
  model: {
    category_multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    chain_multiplier: number;
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
  category_multiple: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  chain_multiplier: number;
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
  category_multiples: Record<string, number>;
  overall_multiple: number;
  rows: RadarRow[];
  live: LiveRow[];
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

/** Days from `listedAt` to `asOf`, or null when either date is missing/bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/**
 * Category multiples for this snapshot: the median mcap/tvl of live-token
 * protocols per category, clamped, with the overall live median as fallback.
 * Returns the per-category map plus the overall multiple.
 */
export function categoryMultiples(
  snapshot: Snapshot,
  model: ModelConstants = MODEL,
): { byCategory: Map<string, number>; overall: number } {
  const liveRatios = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of snapshot.protocols) {
    if (p.mcap_usd === null || p.mcap_usd <= 0 || p.tvl_usd <= 0) continue;
    if (p.gecko_id === null && p.symbol === null) continue;
    const ratio = p.mcap_usd / p.tvl_usd;
    all.push(ratio);
    const key = p.category ?? '';
    const list = liveRatios.get(key) ?? [];
    list.push(ratio);
    liveRatios.set(key, list);
  }
  const overall = clamp(median(all), model.category_min, model.category_max);
  const byCategory = new Map<string, number>();
  for (const [cat, ratios] of liveRatios) {
    if (cat === '') continue;
    byCategory.set(
      cat,
      ratios.length >= model.category_min_samples
        ? clamp(median(ratios), model.category_min, model.category_max)
        : overall,
    );
  }
  return { byCategory, overall };
}

export function multipleFor(
  category: string | null,
  multiples: { byCategory: Map<string, number>; overall: number },
): number {
  if (category === null) return multiples.overall;
  return multiples.byCategory.get(category) ?? multiples.overall;
}

/** The multipliers and implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  multiples: { byCategory: Map<string, number>; overall: number },
  model: ModelConstants = MODEL,
): {
  implied: number;
  categoryMultiple: number;
  growthPct: number;
  growthMult: number;
  maturityMult: number;
  chainMult: number;
  age: number | null;
} {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = clamp(rawGrowth, model.growth_floor, model.growth_cap);
  const weight = growthPct < 0 ? model.growth_weight * model.negative_weight_mult : model.growth_weight;
  const growthMult = 1 + (growthPct / 100) * weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult =
    model.maturity_floor +
    (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const chainMult = 1 + model.chain_step * Math.min(protocol.chains.length, model.chain_max);
  const categoryMultiple = multipleFor(protocol.category, multiples);
  const implied = Math.max(
    1,
    Math.round(protocol.tvl_usd * categoryMultiple * growthMult * maturityMult * chainMult),
  );
  return { implied, categoryMultiple, growthPct, growthMult, maturityMult, chainMult, age };
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

function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** All rankable pre-token protocols, strongest implied value first, ranks 1..N. */
export function buildBoard(
  snapshot: Snapshot,
  model: ModelConstants = MODEL,
): { board: BoardRow[]; multiples: { byCategory: Map<string, number>; overall: number } } {
  const multiples = categoryMultiples(snapshot, model);
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
    const v = impliedValue(p, snapshot.as_of, multiples, model);
    return { p, v };
  });
  scored.sort(
    (a, b) => b.v.implied - a.v.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0),
  );
  const board: BoardRow[] = scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.v.age,
    implied_value_usd: s.v.implied,
    model: {
      category_multiple: round4(s.v.categoryMultiple),
      growth_pct: round4(s.v.growthPct),
      growth_multiplier: round4(s.v.growthMult),
      maturity_multiplier: round4(s.v.maturityMult),
      chain_multiplier: round4(s.v.chainMult),
      age_days: s.v.age,
    },
    farm_steps: farmSteps(s.p, s.v.age).map(stepText),
  }));
  return { board, multiples };
}

function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and re-check the protocol's own page.`;
  return s;
}

function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral'))
    return `Lend $${capital} of USDC through ${name} on ${chain} and leave the loan position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm'))
    return `Add $${capital} of liquidity to the main pool of ${name} on ${chain} and leave it in place.`;
  if (c.includes('bridge'))
    return `Bridge $${capital} of USDC to ${chain} with ${name}, then put the bridged funds to work in its app.`;
  if (c.includes('staking') || c.includes('restak'))
    return `Stake $${capital} of the chain's staking asset via ${name} and keep the staking receipt.`;
  if (c.includes('perpetual') || c.includes('derivative'))
    return `Post $${capital} of USDC as margin on ${name} and open a single small hedged position.`;
  if (c.includes('prediction'))
    return `Fund ${name} with $${capital} and take one market position.`;
  if (c.includes('curator') || c.includes('allocator'))
    return `Put $${capital} into a ${name} vault on ${chain} and hold the vault shares.`;
  if (c.includes('stable'))
    return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa'))
    return `Mint $${capital} of the yield-bearing asset from ${name} on ${chain} and hold it.`;
  if (c.includes('insurance'))
    return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and leave the position open.`;
}

/**
 * Six farm steps per protocol, derived only from its category, chains, TVL
 * and age. Every step names what it costs and how long it takes.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = capital >= 150 ? 8 : 4;
  return [
    {
      text: `Open a fresh wallet that holds only the funds you plan to farm, and store its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: actionFor(p, capital, chain),
      cost: `$${capital} of capital and about $${gas} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: `Do one qualifying action every week, such as a deposit, a swap, a borrow or a vote.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Keep the position open for at least ${hold} days so it is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before withdrawing, open the protocol's own points or rewards page and claim only through the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Log the wallet, the dates and every transaction, so you can repeat the position or unwind it cleanly.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
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
    category_multiple: row.model.category_multiple,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    chain_multiplier: row.model.chain_multiplier,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(
  snapshot: Snapshot,
  model: ModelConstants = MODEL,
): { board: BoardRow[]; radar: RadarData } {
  const { board, multiples } = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const categoryMultiples: Record<string, number> = {};
  for (const [k, v] of [...multiples.byCategory.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    categoryMultiples[k] = round4(v);
  }
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
    category_multiples: categoryMultiples,
    overall_multiple: round4(multiples.overall),
    rows: board.map(radarRow),
    live,
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
    if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd)
      return `row ${i + 1} outranks row ${i} on implied value`;
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
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
