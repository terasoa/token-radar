// Token Radar radar-2 dashboard. Reads window.RADAR (written beside
// dashboard/ by main.ts) and renders the board, filters, a detail view per
// protocol and the live-token tab. No network: every byte shown is in data.js.
(function () {
  'use strict';
  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', tab: 'pre-token', sort: 'implied', dir: -1, selected: null };
  var M = DATA.model;

  function usd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }
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
  // Recompute a row from the snapshot figures, as lib/model.ts does, so the
  // page proves its number is the same one board.json carries.
  function impliedOf(row) {
    var g = clamp(row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d, M.growth_floor, M.growth_cap);
    var w = g < 0 ? M.growth_weight * M.negative_weight_mult : M.growth_weight;
    var gm = 1 + (g / 100) * w;
    return Math.max(1, Math.round(row.tvl_usd * row.category_multiple * gm * row.maturity_multiplier * row.chain_multiplier));
  }
  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') node.className = attrs[k];
      else if (k === 'text') node.textContent = attrs[k];
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
  function chainOf(p) { return p.chains && p.chains.length ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdFor(a) { if (a === null || a === undefined) return 30; if (a < 180) return 60; if (a < 365) return 45; return 30; }
  function actionFor(p, cap, chain) {
    var c = (p.category || '').toLowerCase(), n = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Lend $' + cap + ' of USDC through ' + n + ' on ' + chain + ' and leave the loan position open.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Add $' + cap + ' of liquidity to the main pool of ' + n + ' on ' + chain + ' and leave it in place.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + cap + ' of USDC to ' + chain + ' with ' + n + ', then put the bridged funds to work in its app.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'Stake $' + cap + " of the chain's staking asset via " + n + ' and keep the staking receipt.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Post $' + cap + ' of USDC as margin on ' + n + ' and open a single small hedged position.';
    if (c.indexOf('prediction') >= 0) return 'Fund ' + n + ' with $' + cap + ' and take one market position.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Put $' + cap + ' into a ' + n + ' vault on ' + chain + ' and hold the vault shares.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + cap + ' of the stable asset through ' + n + ' on ' + chain + '.';
    if (c.indexOf('rwa') >= 0) return 'Mint $' + cap + ' of the yield-bearing asset from ' + n + ' on ' + chain + ' and hold it.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + cap + ' of cover from ' + n + ' on ' + chain + ' and keep the policy active.';
    return 'Deposit $' + cap + ' of USDC into ' + n + ' on ' + chain + ' and leave the position open.';
  }
  function farmSteps(p) {
    var chain = chainOf(p), cap = capitalFor(p), hold = holdFor(p.age_days), gas = cap >= 150 ? 8 : 4;
    var steps = [
      { text: 'Open a fresh wallet that holds only the funds you plan to farm, and store its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: actionFor(p, cap, chain), cost: '$' + cap + ' of capital and about $' + gas + ' of gas', time: '15 minutes to set up' },
      { text: 'Do one qualifying action every week, such as a deposit, a swap, a borrow or a vote.', cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: 'Keep the position open for at least ' + hold + ' days so it is counted in more than one snapshot.', cost: 'the $' + cap + ' stays in the position', time: hold + ' days' },
      { text: "Before withdrawing, open the protocol's own points or rewards page and claim only through the link it publishes.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Log the wallet, the dates and every transaction, so you can repeat the position or unwind it cleanly.', cost: 'nothing but the log', time: '5 minutes' }
    ];
    return steps.map(function (s) { return s.text + ' Cost: ' + s.cost + '. Time: ' + s.time + '.'; });
  }
  function readHash() {
    var h = window.location.hash.replace(/^#/, '');
    if (!h) return;
    var ps = new URLSearchParams(h);
    if (ps.get('q')) state.q = ps.get('q');
    if (ps.get('p')) state.selected = ps.get('p');
    if (ps.get('category')) state.category = ps.get('category');
    if (ps.get('chain')) state.chain = ps.get('chain');
    if (ps.get('tab')) state.tab = ps.get('tab');
  }
  function writeHash() {
    var ps = new URLSearchParams();
    if (state.q) ps.set('q', state.q);
    if (state.category !== 'all') ps.set('category', state.category);
    if (state.chain !== 'all') ps.set('chain', state.chain);
    if (state.tab !== 'pre-token') ps.set('tab', state.tab);
    if (state.selected) ps.set('p', state.selected);
    var next = ps.toString();
    window.history.replaceState(null, '', next ? '#' + next : window.location.pathname + window.location.search);
  }
  function filtered() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && !(r.chains || []).includes(state.chain)) return false;
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
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: DATA.watchlist_size + ' watchlist protocols, ranked by implied value' }),
        el('p', null, 'The watchlist is the floor: every protocol with at least ', el('b', { text: '$' + Math.round(DATA.floor_usd / 1e6) + 'M' }), ' of TVL that records no token. The early radar adds ', el('b', { text: String(DATA.early_size) }), ' pre-token protocols below that floor. Implied value is the model\u2019s claim, not a promise.')),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Early rows below the floor' }), el('b', { text: String(DATA.early_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Live-token set aside' }), el('b', { text: String(DATA.live_size) }))));
  }
  function controls() {
    var cats = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.flatMap(function (r) { return r.chains || []; }))).sort();
    var search = el('input', { type: 'search', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var catSel = el('select', { 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      cats.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); }));
    catSel.addEventListener('change', function () { state.category = catSel.value; writeHash(); render(); });
    var chainSel = el('select', { 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); }));
    chainSel.addEventListener('change', function () { state.chain = chainSel.value; writeHash(); render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; writeHash(); render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; writeHash(); render(); } });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { text: 'Category' }), catSel),
      el('div', { class: 'field' }, el('label', { text: 'Chain' }), chainSel),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
      el('span', { class: 'count', text: state.tab === 'pre-token' ? filtered().length + ' rows shown' : DATA.live.length + ' live-token protocols' }));
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
      el('p', { text: 'Clear the search or pick another category or chain to see the board again.' }),
      el('button', { class: 'button', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; writeHash(); render(); } })));
    var max = list[0].implied_value_usd || 1, tbody = el('tbody');
    list.forEach(function (r) {
      var gc = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      tbody.appendChild(el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false', tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + ((r.chains || []).slice(0, 2).join(', ') || 'an unnamed chain') }))),
        el('td', { class: 'num', text: usd(r.tvl_usd) }),
        el('td', { class: 'num ' + gc, text: pct(r.change_7d) }),
        el('td', { class: 'num', text: age(r.age_days) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num', text: usd(r.implied_value_usd) }))),
        el('td', null, el('span', { class: 'status hot', text: 'records no token' }))));
    });
    return el('div', { class: 'panel' }, el('div', { class: 'table-wrap' },
      el('table', null,
        el('caption', { text: 'Pre-token protocols, strongest implied value first. Select a row for its model breakdown and farm plan.' }),
        el('thead', null, el('tr', null,
          sortHeader('implied', 'Rank'), sortHeader('name', 'Protocol'), sortHeader('tvl', 'TVL'),
          sortHeader('growth', '7d'), sortHeader('age', 'Age'), sortHeader('implied', 'Implied value'),
          el('th', { scope: 'col', text: 'Token' }))),
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
        el('caption', { text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.' }),
        el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
        tbody)));
  }
  function modelPanel() {
    var m = DATA.model;
    var tops = Object.entries(DATA.category_multiples).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 5)
      .map(function (kv) { return kv[0] + ' ' + kv[1].toFixed(2); }).join(', ');
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed' }),
      el('p', { text: 'Every row is scored by one function of the snapshot figures. No protocol name is special-cased, and no row is hand-picked.' }),
      el('div', { class: 'formula' }, 'implied = round( tvl_usd x categoryMultiple x growthMult x maturityMult x chainMult )'),
      el('p', { text: 'categoryMultiple is the median market-cap-to-TVL ratio of live-token protocols in the same category (overall median ' + DATA.overall_multiple.toFixed(2) + ' when a category has fewer than 3 live samples), clamped to [0.05, 0.80]. Highest categories: ' + tops + '.' }),
      el('p', { text: 'growthMult = 1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 x ' + m.growth_weight + ', with a fall penalised 1.5x. maturityMult = ' + m.maturity_floor + ' + min(age_days, ' + m.maturity_days + ') / ' + m.maturity_days + ' x ' + m.maturity_range + '; an unknown age uses ' + m.unknown_age_days + ' days. chainMult = 1 + 0.02 x min(chains, 5). Age is the time since first listing — how long the protocol has run while it records no token. The board is a model, not a promise, and it never predicts whether or when a token is issued.' }));
  }
  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });
  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug; writeHash();
    dialog.textContent = '';
    var steps = farmSteps(row);
    var recomputed = impliedOf(row);
    // The page recomputes from the rounded multipliers data.js carries, so
    // the check allows a 0.1% rounding band around the board's exact value.
    var ok = Math.abs(recomputed - row.implied_value_usd) <= Math.max(1000, row.implied_value_usd * 0.001);
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + ((row.chains || []).join(', ') || 'an unnamed chain') + ' — records no token' })),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value — model breakdown' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { text: usd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { text: pct(row.change_7d) })),
        el('div', null, el('span', { text: 'Age, records no token' }), el('b', { text: age(row.age_days) })),
        el('div', null, el('span', { text: 'Category multiple' }), el('b', { text: String(row.category_multiple) })),
        el('div', null, el('span', { text: 'Growth multiplier' }), el('b', { text: String(row.growth_multiplier) })),
        el('div', null, el('span', { text: 'Maturity multiplier' }), el('b', { text: String(row.maturity_multiplier) })),
        el('div', null, el('span', { text: 'Chain multiplier' }), el('b', { text: String(row.chain_multiplier) })),
        el('div', null, el('span', { text: 'Implied value' }), el('b', { text: usd(row.implied_value_usd) })),
        el('div', null, el('span', { text: 'Recomputed in page' }), el('b', { text: usd(recomputed) }))),
      el('p', { class: ok ? 'check' : 'check bad', text: ok ? 'Recomputed value matches board.json (within rounding).' : 'Recomputed value differs from board.json — the data would be stale.' }),
      el('p', { class: 'note', text: 'Model ' + DATA.model_version + ': the same function scores every protocol. This is an estimate, not a price.' })));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, steps.map(function (s) {
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
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    if (state.tab === 'pre-token') shell.appendChild(modelPanel());
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }
  readHash();
  render();
  window.addEventListener('keydown', function (e) { if (e.key === 'Escape' && dialog.open) dialog.close(); });
})();
