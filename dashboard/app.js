// Token Radar radar-3 dashboard. Reads window.RADAR (written beside
// dashboard/ by main.ts) and renders the board, filters, a detail view
// per protocol, the set-aside and calibration tabs, the model backtest,
// the budget allocator and the model lab. No network: every byte shown
// is in data.js. The page recomputes every row from the snapshot figures,
// so it can print how many rows match board.json.
(function () {
  'use strict';
  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var M = DATA.model, C = DATA.curve;
  var state = { q: '', category: 'all', chain: 'all', verdict: 'all', tab: 'board', sort: 'implied', dir: -1, selected: null, budget: 2000, hours: 4, slope: C.slope, level: C.intercept, gw: M.growth_weight };

  function usd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }
  function usd2(n) { return (n < 0 ? '-$' : '$') + Math.abs(n).toFixed(2); }
  function pct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function age(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function log10(x) { return Math.log(x) / Math.LN10; }
  // Recompute a row from the snapshot figures, as lib/model.ts does.
  function impliedOf(r) {
    return Math.max(1, Math.round(r.curve_value_usd * r.category_effect * r.growth_multiplier * r.maturity_multiplier * r.chain_multiplier * r.kin_multiplier));
  }
  function proofCount() {
    var ok = 0;
    DATA.rows.forEach(function (r) {
      var v = impliedOf(r);
      if (Math.abs(v - r.implied_value_usd) <= Math.max(1000, r.implied_value_usd * 0.001)) ok++;
    });
    return ok;
  }
  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'text') node.textContent = attrs[k];
      else if (k === 'html') node.innerHTML = attrs[k];
      else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c === null || c === undefined) continue;
      if (Array.isArray(c)) c.forEach(function (x) { if (x) node.appendChild(x); });
      else if (typeof c === 'string') node.appendChild(document.createTextNode(c));
      else node.appendChild(c);
    }
    return node;
  }
  function verdictPill(v) { return el('span', { class: 'verdict ' + v.toLowerCase(), text: v }); }
  function readHash() {
    var h = window.location.hash.replace(/^#/, '');
    if (!h) return;
    var ps = new URLSearchParams(h);
    if (ps.get('q')) state.q = ps.get('q');
    if (ps.get('p')) state.selected = ps.get('p');
    if (ps.get('category')) state.category = ps.get('category');
    if (ps.get('chain')) state.chain = ps.get('chain');
    if (ps.get('tab')) state.tab = ps.get('tab');
    if (ps.get('verdict')) state.verdict = ps.get('verdict');
  }
  function writeHash() {
    var ps = new URLSearchParams();
    if (state.q) ps.set('q', state.q);
    if (state.category !== 'all') ps.set('category', state.category);
    if (state.chain !== 'all') ps.set('chain', state.chain);
    if (state.verdict !== 'all') ps.set('verdict', state.verdict);
    if (state.tab !== 'board') ps.set('tab', state.tab);
    if (state.selected) ps.set('p', state.selected);
    var next = ps.toString();
    window.history.replaceState(null, '', next ? '#' + next : window.location.pathname + window.location.search);
  }
  function filtered() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && !(r.chains || []).includes(state.chain)) return false;
      if (state.verdict !== 'all' && r.verdict !== state.verdict) return false;
      if (!q) return true;
      return [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase().indexOf(q) >= 0;
    });
  }
  function sorted(list) {
    return list.slice().sort(function (a, b) {
      var av, bv, k = state.sort;
      if (k === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (k === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (k === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (k === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else if (k === 'net') { av = a.net_per_hour_usd; bv = b.net_per_hour_usd; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : 1;
    });
  }
  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { class: 'brand-name', text: 'Token Radar' })),
      el('div', { class: 'top-meta' },
        el('span', null, 'Snapshot ', el('b', { text: DATA.as_of })),
        el('span', null, 'DefiLlama protocol index'),
        el('span', null, el('b', { text: DATA.model_version }), ' model')));
  }
  function lede() {
    var vc = DATA.verdict_counts;
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: DATA.watchlist_size + ' watchlist protocols, ranked by a fitted value' }),
        el('p', null, 'The watchlist is the floor: every protocol with at least ', el('b', { text: '$' + Math.round(DATA.floor_usd / 1e6) + 'M' }), ' of TVL that records no token. The early radar adds ', el('b', { text: String(DATA.early_size) }), ' pre-token protocols below that floor. Implied value is the model\u2019s claim, not a promise.'),
        el('p', { class: 'proof', text: 'Page = board.json: ' + proofCount() + '/' + DATA.board_size + ' rows recomputed equal in this page.' })),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Verdicts (ROBUST / FARM / THIN / SKIP)' }), el('b', { text: (vc.ROBUST || 0) + ' / ' + (vc.FARM || 0) + ' / ' + (vc.THIN || 0) + ' / ' + (vc.SKIP || 0) })),
        el('div', { class: 'fact' }, el('span', { text: 'Leave-one-out miss vs flat' }), el('b', { text: 'x' + C.backtest.loo_miss + ' vs x' + C.backtest.loo_flat_miss })),
        el('div', { class: 'fact' }, el('span', { text: 'Set aside (not ranked)' }), el('b', { text: String(DATA.set_aside_size) }))));
  }
  function tabBar() {
    var tabs = [['board', 'Board'], ['live', 'Live token'], ['setaside', 'Set aside'], ['calib', 'Calibration'], ['model', 'Model & backtest']];
    return el('div', { class: 'tabs big' }, tabs.map(function (t) {
      return el('button', { type: 'button', 'aria-pressed': state.tab === t[0] ? 'true' : 'false', text: t[1], onclick: function () { state.tab = t[0]; state.selected = null; writeHash(); render(); } });
    }));
  }
  function controls() {
    var cats = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.flatMap(function (r) { return r.chains || []; }))).sort();
    var search = el('input', { type: 'search', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    function sel(label, opts, cur, fn) {
      var s = el('select', { 'aria-label': label },
        opts.map(function (o) { return el('option', { value: o[0], text: o[1], selected: o[0] === cur ? 'selected' : null }); }));
      s.addEventListener('change', function () { fn(s.value); writeHash(); render(); });
      return el('div', { class: 'field' }, el('label', { text: label }), s);
    }
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { text: 'Search' }), search),
      sel('Category', [['all', 'All categories']].concat(cats.map(function (c) { return [c, c]; })), state.category, function (v) { state.category = v; }),
      sel('Chain', [['all', 'All chains']].concat(chains.map(function (c) { return [c, c]; })), state.chain, function (v) { state.chain = v; }),
      sel('Verdict', [['all', 'All verdicts'], ['ROBUST', 'ROBUST'], ['FARM', 'FARM'], ['THIN', 'THIN'], ['SKIP', 'SKIP']], state.verdict, function (v) { state.verdict = v; }),
      el('span', { class: 'count', text: filtered().length + ' rows shown' }));
  }
  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label, state.sort === key ? el('span', { text: state.dir < 0 ? ' \u25bc' : ' \u25b2' }) : null));
  }

  function boardTable() {
    var list = sorted(filtered());
    if (!list.length) return el('div', { class: 'panel' }, el('div', { class: 'empty' },
      el('h2', { text: 'No protocol matches that filter' }),
      el('p', { text: 'Clear the search or pick another category, chain or verdict to see the board again.' }),
      el('button', { class: 'button', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.verdict = 'all'; writeHash(); render(); } })));
    var max = list[0].implied_value_usd || 1, tbody = el('tbody');
    list.forEach(function (r) {
      var gc = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var loPc = clamp(((log10(r.p10_usd) - 5) / 6) * 100, 0, 100), hiPc = clamp(((log10(r.p90_usd) - 5) / 6) * 100, 0, 100);
      tbody.appendChild(el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false', tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num' }, el('b', { text: String(r.rank) }), el('div', { class: 'sub', text: r.rank_lo === r.rank_hi ? 'rank ' + r.rank_lo : 'rank ' + r.rank_lo + '\u2013' + r.rank_hi })),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + ((r.chains || []).slice(0, 2).join(', ') || 'an unnamed chain') }))),
        el('td', { class: 'num', text: usd(r.tvl_usd) }),
        el('td', { class: 'num ' + gc, text: pct(r.change_7d) }),
        el('td', { class: 'num', text: age(r.age_days) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num', text: usd(r.implied_value_usd) }),
          el('div', { class: 'rangebar', title: 'P10\u2013P90: ' + usd(r.p10_usd) + ' to ' + usd(r.p90_usd) }, el('i', { style: 'left:' + loPc.toFixed(1) + '%;width:' + Math.max(2, hiPc - loPc).toFixed(1) + '%' })),
          el('span', { class: 'sub', text: usd(r.p10_usd) + '\u2013' + usd(r.p90_usd) }))),
        el('td', null, verdictPill(r.verdict), el('div', { class: 'sub', text: r.net_per_hour_usd >= 0 ? '+' + usd2(r.net_per_hour_usd) + '/h' : usd2(r.net_per_hour_usd) + '/h' }))));
    });
    return el('div', { class: 'panel' }, el('div', { class: 'table-wrap' },
      el('table', null,
        el('caption', { text: 'Pre-token protocols, strongest implied value first. The bar under each value is its P10\u2013P90 band; the rank line is its range over 200 refits. Select a row for its model breakdown, verdict and farm plan.' }),
        el('thead', null, el('tr', null,
          sortHeader('implied', 'Rank'), sortHeader('name', 'Protocol'), sortHeader('tvl', 'TVL'),
          sortHeader('growth', '7d'), sortHeader('age', 'Age'), sortHeader('implied', 'Implied value'),
          sortHeader('net', 'Verdict'))),
        tbody)));
  }
  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + ((r.chains || []).slice(0, 2).join(', ') || 'an unnamed chain') }))),
        el('td', { class: 'num', text: usd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: pct(r.change_7d) }),
        el('td', { class: 'num', text: usd(r.mcap_usd) }),
        el('td', null, el('span', { class: 'status', text: 'already trades' }))));
    });
    return el('div', { class: 'panel' }, el('div', { class: 'table-wrap' },
      el('table', null,
        el('caption', { text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking — and 92 of them are the comparables the curve is fitted on (see Calibration).' }),
        el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
        tbody)));
  }
  function farmNext() {
    var best = DATA.rows.filter(function (r) { return (r.verdict === 'FARM' || r.verdict === 'ROBUST') && r.net_usd > 0; })
      .sort(function (a, b) { return b.net_per_hour_usd - a.net_per_hour_usd; }).slice(0, 5);
    if (!best.length) return null;
    return el('section', { class: 'panel farmnext' },
      el('h2', { text: 'Farm next — best net per hands-on hour' }),
      el('p', { class: 'note', text: 'For a $1,000 ticket with 10% of the launch going to depositors, net of gas, fees and the forgone 4% T-bill yield.' }),
      el('div', { class: 'cards' }, best.map(function (r) {
        return el('div', { class: 'card', tabindex: '0', onclick: function () { openDetail(r.slug); }, onkeydown: function (e) { if (e.key === 'Enter') openDetail(r.slug); } },
          el('div', { class: 'card-rank', text: '#' + r.rank + ' ' + r.name }),
          el('div', { class: 'card-net', text: '+' + usd2(r.net_usd) + ' net' }),
          el('div', { class: 'card-rate', text: '+' + usd2(r.net_per_hour_usd) + ' per hour \u00b7 ' + r.farm_hours.toFixed(1) + 'h work' }),
          verdictPill(r.verdict));
      })));
  }
  function allocate() {
    var cands = DATA.rows.filter(function (r) { return (r.verdict === 'FARM' || r.verdict === 'ROBUST') && r.net_usd > 0; })
      .sort(function (a, b) { return b.net_per_hour_usd - a.net_per_hour_usd; });
    var budget = state.budget, hoursLeft = state.hours * 8, perChain = {};
    var picks = [], spent = 0, net = 0, hours = 0;
    cands.forEach(function (r) {
      if (spent + 1000 > budget || hours + r.farm_hours > hoursLeft) return;
      var ch = (r.chains || [])[0] || 'other';
      if ((perChain[ch] || 0) >= 2) return;
      perChain[ch] = (perChain[ch] || 0) + 1;
      picks.push(r); spent += 1000; net += r.net_usd; hours += r.farm_hours;
    });
    var body = picks.length ? el('table', null,
      el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'Ticket' }), el('th', { scope: 'col', text: 'Net' }), el('th', { scope: 'col', text: 'Hours' }), el('th', { scope: 'col', text: 'Per hour' }))),
      el('tbody', null, picks.map(function (r) {
        return el('tr', { onclick: function () { openDetail(r.slug); } },
          el('td', null, el('b', { text: r.name })),
          el('td', { class: 'num', text: '$1,000' }),
          el('td', { class: 'num', text: '+' + usd2(r.net_usd) }),
          el('td', { class: 'num', text: r.farm_hours.toFixed(1) + 'h' }),
          el('td', { class: 'num', text: '+' + usd2(r.net_per_hour_usd) + '/h' }));
      }))) : el('p', { class: 'note', text: 'No farm pays at this budget and these hours — raise the budget or the hours and the allocator will find one.' });
    return { picks: picks, spent: spent, net: net, hours: hours, body: body };
  }
  function allocatorPanel() {
    var res = allocate();
    var budget = el('input', { type: 'number', min: '1000', max: '10000', step: '500', value: String(state.budget), 'aria-label': 'Budget in dollars' });
    budget.addEventListener('input', function () { state.budget = clamp(parseInt(budget.value, 10) || 1000, 1000, 10000); render(); });
    var hours = el('input', { type: 'number', min: '1', max: '20', step: '1', value: String(state.hours), 'aria-label': 'Hours per week' });
    hours.addEventListener('input', function () { state.hours = clamp(parseInt(hours.value, 10) || 4, 1, 20); render(); });
    return el('section', { class: 'panel alloc' },
      el('h2', { text: 'Farm this budget' }),
      el('p', { class: 'note', text: 'Enter a budget and the hours you can give each week, and the page allocates it across the farms that pay best per hour — $1,000 a ticket, at most two farms per chain, over an 8-week window. Expected net is the model\u2019s claim, not a promise.' }),
      el('div', { class: 'alloc-form' },
        el('div', { class: 'field' }, el('label', { text: 'Budget ($1,000\u2013$10,000)' }), budget),
        el('div', { class: 'field' }, el('label', { text: 'Hours per week (1\u201320)' }), hours),
        el('div', { class: 'fact' }, el('span', { text: 'Allocated' }), el('b', { text: '$' + res.spent.toLocaleString() + ' of $' + state.budget.toLocaleString() })),
        el('div', { class: 'fact' }, el('span', { text: 'Expected net' }), el('b', { text: (res.net >= 0 ? '+' : '') + usd2(res.net) })),
        el('div', { class: 'fact' }, el('span', { text: 'Hands-on work' }), el('b', { text: res.hours.toFixed(1) + 'h' }))),
      res.body);
  }
  function labPanel() {
    function slider(label, min, max, step, val, fn) {
      var inp = el('input', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(val), 'aria-label': label });
      inp.addEventListener('input', function () { fn(parseFloat(inp.value)); render(); });
      return el('div', { class: 'field' }, el('label', { text: label + ': ' + val.toFixed(2) }), inp);
    }
    var rescored = DATA.rows.map(function (r) {
      var curve = Math.pow(10, state.level + state.slope * log10(r.tvl_usd));
      var g = clamp(r.growth_pct, M.growth_floor, M.growth_cap);
      var w = g < 0 ? state.gw * M.negative_weight_mult : state.gw;
      var gm = 1 + (g / 100) * w;
      return { slug: r.slug, name: r.name, v: Math.max(1, Math.round(curve * r.category_effect * gm * r.maturity_multiplier * r.chain_multiplier * r.kin_multiplier)) };
    }).sort(function (a, b) { return b.v - a.v; });
    var top = rescored.slice(0, 10);
    var oldTop = DATA.rows[0];
    var newTop = top[0];
    return el('section', { class: 'panel lab' },
      el('h2', { text: 'Model lab — exploration, not the board' }),
      el('p', { class: 'note', text: 'Move the curve and watch the board re-rank live. board.json is the submitted artifact and does not change; this is how you test whether the ranking is fragile. Now: rank 1 is ' + (oldTop ? oldTop.name : 'n/a') + ' at ' + usd(oldTop ? oldTop.implied_value_usd : 0) + '; with these settings it would be ' + (newTop ? newTop.name : 'n/a') + ' at ' + usd(newTop ? newTop.v : 0) + '.' }),
      el('div', { class: 'lab-form' },
        slider('Curve slope', 0.2, 0.6, 0.01, state.slope, function (v) { state.slope = v; }),
        slider('Curve level', 3.5, 4.5, 0.01, state.level, function (v) { state.level = v; }),
        slider('Growth weight', 0, 1, 0.05, state.gw, function (v) { state.gw = v; })),
      el('ol', { class: 'lab-top' }, top.map(function (r, i) {
        return el('li', null, el('b', { text: (i + 1) + '. ' + r.name }), el('span', { class: 'num', text: usd(r.v) }));
      })));
  }

  function setAsideTable() {
    var byReason = {};
    DATA.set_aside.forEach(function (r) { byReason[r.reason] = (byReason[r.reason] || 0) + 1; });
    var summary = Object.keys(byReason).sort().map(function (k) { return k + ' ' + byReason[k]; }).join(' \u00b7 ');
    var tbody = el('tbody');
    DATA.set_aside.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', null, el('b', { text: r.name })),
        el('td', { text: r.category || 'Other' }),
        el('td', { class: 'num', text: usd(r.tvl_usd) }),
        el('td', { text: r.reason })));
    });
    return el('div', { class: 'panel' }, el('div', { class: 'table-wrap' },
      el('table', null,
        el('caption', { text: DATA.set_aside.length + ' pre-token protocols were set aside, not ranked: ' + summary + '. Every one records no token, and every one fails the watchlist\u2019s own exclusion rule — a wrapped, staked or bridged product of a token that already trades is not a launch still to come.' }),
        el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'Category' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: 'Reason' }))),
        tbody)));
  }
  function calibTable() {
    var tbody = el('tbody');
    DATA.calibration.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', null, el('b', { text: r.name })),
        el('td', { text: r.category || 'Other' }),
        el('td', { class: 'num', text: usd(r.tvl_usd) }),
        el('td', { class: 'num', text: usd(r.mcap_usd) }),
        el('td', { class: 'num', text: (r.mcap_usd / r.tvl_usd).toFixed(2) }),
        el('td', { class: 'num', text: r.listed_at || 'n/a' })));
    });
    return el('div', { class: 'panel' }, el('div', { class: 'table-wrap' },
      el('table', null,
        el('caption', { text: 'The ' + DATA.calibration.length + ' traded tokens the curve is fitted on. Each one records a token and passes the same exclusion rule as the board, so no wrapped or bridged product teaches the curve. The curve is fitted on these, and the backtest prices each one without it.' }),
        el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'Category' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'mcap / TVL' }), el('th', { scope: 'col', text: 'Listed' }))),
        tbody)));
  }
  function scatter() {
    var W = 640, H = 300, pad = 34;
    var xs = DATA.calibration.map(function (r) { return log10(r.tvl_usd); });
    var ys = DATA.calibration.map(function (r) { return log10(r.mcap_usd); });
    var x0 = 6.5, x1 = 10, y0 = 5, y1 = 10.5;
    function X(v) { return pad + ((v - x0) / (x1 - x0)) * (W - pad * 2); }
    function Y(v) { return H - pad - ((v - y0) / (y1 - y0)) * (H - pad * 2); }
    var s = '';
    s += '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#0b1220"/>';
    for (var g = 7; g <= 10; g++) {
      s += '<line x1="' + X(g) + '" y1="' + Y(y0) + '" x2="' + X(g) + '" y2="' + Y(y1) + '" stroke="#26344f" stroke-width="1"/>';
      s += '<text x="' + X(g) + '" y="' + (H - 10) + '" fill="#9aa8c0" font-size="10" text-anchor="middle">$10^' + g + '</text>';
    }
    for (var h = 6; h <= 10; h++) {
      s += '<line x1="' + X(x0) + '" y1="' + Y(h) + '" x2="' + X(x1) + '" y2="' + Y(h) + '" stroke="#26344f" stroke-width="1"/>';
      s += '<text x="6" y="' + (Y(h) + 3) + '" fill="#9aa8c0" font-size="10">$10^' + h + '</text>';
    }
    var sg = C.backtest.sigma_log;
    s += '<polygon points="' + X(x0) + ',' + Y(C.intercept + C.slope * x0 + sg) + ' ' + X(x1) + ',' + Y(C.intercept + C.slope * x1 + sg) + ' ' + X(x1) + ',' + Y(C.intercept + C.slope * x1 - sg) + ' ' + X(x0) + ',' + Y(C.intercept + C.slope * x0 - sg) + '" fill="#f0b429" opacity="0.12"/>';
    s += '<line x1="' + X(x0) + '" y1="' + Y(C.intercept + C.slope * x0) + '" x2="' + X(x1) + '" y2="' + Y(C.intercept + C.slope * x1) + '" stroke="#f0b429" stroke-width="2"/>';
    DATA.calibration.forEach(function (r) {
      s += '<circle cx="' + X(log10(r.tvl_usd)).toFixed(1) + '" cy="' + Y(log10(r.mcap_usd)).toFixed(1) + '" r="2.5" fill="#9aa8c0"/>';
    });
    DATA.rows.forEach(function (r) {
      s += '<circle cx="' + X(log10(r.tvl_usd)).toFixed(1) + '" cy="' + Y(log10(r.implied_value_usd)).toFixed(1) + '" r="2" fill="#f0b429"/>';
    });
    s += '<text x="' + (W / 2) + '" y="16" fill="#e8edf5" font-size="12" text-anchor="middle">Market cap vs TVL (log scale) — grey: traded comps; amber: board rows; line: fitted curve \u00b1 1 sigma</text>';
    return el('div', { class: 'scatter' }, el('div', { html: '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="Scatter plot of market cap against TVL">' + s + '</svg>' }));
  }
  function modelTab() {
    var b = C.backtest;
    var dropped = b.dropped_tilts.length ? b.dropped_tilts.join(', ') : 'none';
    var tilts = [];
    Object.keys(C.tilts).forEach(function (k) { if (C.tilts[k]) tilts.push(k); });
    return el('div', null,
      el('section', { class: 'panel model' },
        el('h2', { text: 'How implied value is computed' }),
        el('p', { text: 'One function scores every row, from the snapshot\u2019s own figures. No protocol name is special-cased, and no row is hand-picked.' }),
        el('div', { class: 'formula' }, 'implied = 10^(' + C.intercept + ' + ' + C.slope + ' x log10(TVL)) x growthMult x seasonMult'),
        el('p', { text: 'The curve is a least-squares fit on ' + C.n_comps + ' traded tokens (see Calibration). A flat multiple would charge a giant protocol the same rate as a small one; the fitted slope below 1 compresses big TVL, which is what the traded tokens show. Tilts kept: ' + (tilts.length ? tilts.join(', ') : 'none') + '. growthMult = 1 + clamp(change_7d, ' + M.growth_floor + ', ' + M.growth_cap + ') / 100 x ' + M.growth_weight + ', with a fall penalised 1.5x. seasonMult = ' + M.maturity_floor + ' + min(age_days, ' + M.maturity_days + ') / ' + M.maturity_days + ' x ' + M.maturity_range + '; an unknown age uses ' + M.unknown_age_days + ' days. Age is the time since first listing — how long the protocol has run while it records no token.' }),
        el('p', { text: 'Dropped tilts: ' + dropped + '. Each was tested by leave-one-out error and kept only when it cut the blind miss by at least 1%; category effects, the chain tilt and kinship did not survive, so they are not in the model — and the page says so instead of pretending they did. The time split (fit on tokens listed before 2024, tested on newer ones) is a check alongside, not the gate: with only 29 tokens in the training half it is too thin to decide a tilt on its own.' })),
      el('section', { class: 'panel model' },
        el('h2', { text: 'Backtest — priced blind' }),
        el('div', { class: 'equation' },
          el('div', null, el('span', { text: 'Leave-one-out miss' }), el('b', { text: 'x' + b.loo_miss })),
          el('div', null, el('span', { text: 'Flat multiple, same test' }), el('b', { text: 'x' + b.loo_flat_miss })),
          el('div', null, el('span', { text: 'Time-split miss' }), el('b', { text: 'x' + b.ts_miss })),
          el('div', null, el('span', { text: 'Flat multiple, time split' }), el('b', { text: 'x' + b.ts_flat_miss })),
          el('div', null, el('span', { text: 'Within 3x / 10x (blind)' }), el('b', { text: Math.round(b.within3 * 100) + '% / ' + Math.round(b.within10 * 100) + '%' })),
          el('div', null, el('span', { text: 'Residual spread (1 sigma, dex)' }), el('b', { text: String(b.sigma_log) }))),
        el('p', { class: 'note', text: 'Leave-one-out prices each traded token with a curve fitted without it; the time split fits on tokens listed before 2024 and tests the newer ones. The miss is the median factor by which the price is wrong — lower is better. The board is a model, not a promise, and it never predicts whether or when a token is issued.' }),
        scatter()));
  }
  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });
  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug; writeHash();
    dialog.textContent = '';
    var recomputed = impliedOf(row);
    var ok = Math.abs(recomputed - row.implied_value_usd) <= Math.max(1000, row.implied_value_usd * 0.001);
    var mults = [['Curve', row.curve_value_usd], ['Growth', row.growth_multiplier], ['Seasoning', row.maturity_multiplier], ['Chain', row.chain_multiplier], ['Kin', row.kin_multiplier], ['Category', row.category_effect]];
    var drag = mults.filter(function (m) { return m[1] < 1; }).sort(function (a, b) { return a[1] - b[1]; })[0];
    var flatValue = row.growth_multiplier !== 1 ? Math.round(row.implied_value_usd / row.growth_multiplier) : row.implied_value_usd;
    function netAt(ticket, drop) {
      var slice = row.slice_usd * (ticket / 1000) * (1 - drop);
      return slice - row.cost_usd - row.forgone_usd * (ticket / 1000);
    }
    var tickets = [1000, 10000, 100000], drops = [0.05, 0.1, 0.2];
    var sensRows = tickets.map(function (t) {
      return el('tr', null, el('td', { class: 'num', text: '$' + t.toLocaleString() }),
        drops.map(function (d) {
          var n = netAt(t, d);
          return el('td', { class: 'num ' + (n >= 0 ? 'pos' : 'neg'), text: (n >= 0 ? '+' : '') + usd2(n) });
        }));
    });
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size + ' \u00b7 rank range ' + row.rank_lo + '\u2013' + row.rank_hi }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + ((row.chains || []).join(', ') || 'an unnamed chain') + ' — records no token' })),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value — model breakdown' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { text: usd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { text: pct(row.change_7d) })),
        el('div', null, el('span', { text: 'Age, records no token' }), el('b', { text: age(row.age_days) })),
        el('div', null, el('span', { text: 'Curve value' }), el('b', { text: usd(row.curve_value_usd) })),
        el('div', null, el('span', { text: 'Growth multiplier' }), el('b', { text: String(row.growth_multiplier) })),
        el('div', null, el('span', { text: 'Seasoning multiplier' }), el('b', { text: String(row.maturity_multiplier) })),
        el('div', null, el('span', { text: 'Chain multiplier' }), el('b', { text: String(row.chain_multiplier) })),
        el('div', null, el('span', { text: 'Kin multiplier' }), el('b', { text: String(row.kin_multiplier) })),
        el('div', null, el('span', { text: 'Category effect' }), el('b', { text: String(row.category_effect) })),
        el('div', null, el('span', { text: 'Implied value' }), el('b', { text: usd(row.implied_value_usd) })),
        el('div', null, el('span', { text: 'P10\u2013P90 band' }), el('b', { text: usd(row.p10_usd) + ' \u2013 ' + usd(row.p90_usd) })),
        el('div', null, el('span', { text: 'Recomputed in page' }), el('b', { text: usd(recomputed) }))),
      el('p', { class: ok ? 'check' : 'check bad', text: ok ? 'Recomputed value matches board.json (within rounding).' : 'Recomputed value differs from board.json — the data would be stale.' }),
      el('p', { class: 'note', text: 'Model ' + DATA.model_version + ': the same function scores every protocol. The band is the leave-one-out residual range — the value is uncertain, and the rank range over 200 refits (' + row.rank_lo + '\u2013' + row.rank_hi + ') is the steadier number. This is an estimate, not a price.' }),
      el('p', { class: 'note', text: drag ? 'Biggest drag on this value: ' + drag[0] + ' at x' + drag[1] + '.' : 'No multiplier drags this value below the curve.' }),
      el('p', { class: 'note', text: row.growth_multiplier !== 1 ? 'If 7d TVL were flat, the value would be ' + usd(flatValue) + '.' : 'Seven-day growth is flat, so no counterfactual applies.' })));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm verdict — does it pay?' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'Verdict' }), verdictPill(row.verdict)),
        el('div', null, el('span', { text: 'Slice of a $1,000 ticket' }), el('b', { text: usd2(row.slice_usd) })),
        el('div', null, el('span', { text: 'Gas and fees' }), el('b', { text: usd2(row.cost_usd) })),
        el('div', null, el('span', { text: 'Forgone T-bill yield' }), el('b', { text: usd2(row.forgone_usd) })),
        el('div', null, el('span', { text: 'Net' }), el('b', { text: (row.net_usd >= 0 ? '+' : '') + usd2(row.net_usd) })),
        el('div', null, el('span', { text: 'Net per hands-on hour' }), el('b', { text: (row.net_per_hour_usd >= 0 ? '+' : '') + usd2(row.net_per_hour_usd) + '/h' })),
        el('div', null, el('span', { text: 'Break-even launch value' }), el('b', { text: usd(row.break_even_usd) })),
        el('div', null, el('span', { text: 'Break-even odds' }), el('b', { text: Math.round(row.break_even_odds * 100) + '%' })),
        el('div', null, el('span', { text: 'Pays at the band\u2019s low end' }), el('b', { text: row.pays_at_p10 ? 'Yes' : 'No — the band is wide, so that bar is high' }))),
      el('p', { class: 'note', text: 'Slice is the reader\u2019s share if 10% of the launch goes to depositors pro-rata on TVL. Break-even odds are the model\u2019s chance the launch clears the break-even value, from the blind residual spread.' }),
      el('h3', { text: 'Net at other tickets and drops' }),
      el('table', { class: 'sens' },
        el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Ticket' }), drops.map(function (d) { return el('th', { scope: 'col', text: (d * 100) + '% drop' }); }))),
        el('tbody', null, sensRows))));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan — 8 steps, $1,000 ticket' }),
      el('ol', { class: 'steps' }, row.farm_steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        return el('li', null, el('b', { text: at >= 0 ? s.slice(0, at) : s }), el('span', { class: 'cost', text: at >= 0 ? s.slice(at + 1) : '' }));
      }))));
    if (typeof dialog.showModal === 'function') { if (!dialog.open) dialog.showModal(); }
    else dialog.setAttribute('open', '');
  }
  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    shell.appendChild(tabBar());
    if (state.tab === 'board') {
      shell.appendChild(controls());
      var fn = farmNext();
      if (fn) shell.appendChild(fn);
      shell.appendChild(boardTable());
      shell.appendChild(allocatorPanel());
      shell.appendChild(labPanel());
    } else if (state.tab === 'live') {
      shell.appendChild(liveTable());
    } else if (state.tab === 'setaside') {
      shell.appendChild(setAsideTable());
    } else if (state.tab === 'calib') {
      shell.appendChild(calibTable());
    } else if (state.tab === 'model') {
      shell.appendChild(modelTab());
    }
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }
  readHash();
  render();
  window.addEventListener('keydown', function (e) { if (e.key === 'Escape' && dialog.open) dialog.close(); });
})();
