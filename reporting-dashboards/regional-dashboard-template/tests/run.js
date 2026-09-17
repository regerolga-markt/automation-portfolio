// Runs the Apps Script sources in a Node VM with a minimal mock of the Apps Script services.
// Usage: node tests/run.js
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');

// ---- minimal Apps Script mocks ----
function makeSheet(name) {
  const cells = [];
  const sheet = {
    name, cells, rules: [], frozen: 0,
    clear() { cells.length = 0; },
    getRange(r, c, h = 1, w = 1) {
      const range = {
        setValue(v) { return range.setValues([[v]]); },
        setValues(vals) {
          assert.strictEqual(vals.length, h, `rows mismatch in ${name}`);
          vals.forEach((row, i) => { assert.strictEqual(row.length, w, `cols mismatch in ${name}`); cells[r - 1 + i] = cells[r - 1 + i] || []; row.forEach((v, j) => (cells[r - 1 + i][c - 1 + j] = v)); });
          return range;
        },
        setFontWeight() { return range; }, setFontSize() { return range; }, setBackground() { return range; }, setNumberFormat() { return range; },
      };
      return range;
    },
    getDataRange() { return { getValues: () => cells.map(row => (row || []).slice()) }; },
    appendRow(row) { cells.push(row); },
    getLastRow() { return cells.length; },
    getConditionalFormatRules() { return sheet.rules.slice(); },
    setConditionalFormatRules(r) { sheet.rules = r; },
    setFrozenRows(n) { sheet.frozen = n; }, autoResizeColumns() {},
  };
  return sheet;
}
const sheets = {};
const props = {};
const ruleBuilder = () => { const b = { whenNumberGreaterThan: () => b, whenNumberLessThan: () => b, setFontColor: () => b, setRanges: () => b, build: () => ({}) }; return b; };
const ctx = {
  console,
  SpreadsheetApp: {
    getActive: () => ({ getSheetByName: n => sheets[n] || null, insertSheet: n => (sheets[n] = makeSheet(n)), toast() {} }),
    newConditionalFormatRule: ruleBuilder,
  },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => (props[k] = v) }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  Session: { getScriptTimeZone: () => 'UTC' },
  Utilities: { formatDate: (d, tz, f) => d.toISOString().slice(0, 10), sleep() {} },
  UrlFetchApp: { fetch: () => { throw new Error('network disabled in tests'); } },
};
vm.createContext(ctx);
for (const f of ['Config.gs', 'Core.gs', 'SampleData.gs', 'Windsor.gs', 'Dashboard.gs']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8'), ctx, { filename: f });
}
const g = expr => vm.runInContext(expr, ctx);
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('ok -', name); };

// ---- unit tests ----
test('weekStart_ returns Monday', () => {
  assert.strictEqual(g("weekStart_('2026-09-17')"), '2026-09-14'); // Thu → Mon
  assert.strictEqual(g("weekStart_('2026-09-20')"), '2026-09-14'); // Sun → Mon
  assert.strictEqual(g("weekStart_('2026-09-14')"), '2026-09-14');
});
test('pctChange_ is null on zero base', () => {
  assert.strictEqual(g('pctChange_(10, 0)'), null);
  assert.strictEqual(g('pctChange_(15, 10)'), 0.5);
});
test('region rules: token match, first rule wins, unassigned fallback', () => {
  const rules = 'CONFIG.REGION_RULES, CONFIG.UNASSIGNED_REGION';
  assert.strictEqual(g(`assignRegion_({campaign:'brand_us_search'}, ${rules})`), 'US');
  assert.strictEqual(g(`assignRegion_({campaign:'leadgen_emea_form'}, ${rules})`), 'Europe');
  assert.strictEqual(g(`assignRegion_({campaign:'retarget_latam_video'}, ${rules})`), 'LATAM');
  assert.strictEqual(g(`assignRegion_({campaign:'awareness_global_reach'}, ${rules})`), 'Unassigned');
  assert.strictEqual(g(`assignRegion_({campaign:'business_campaign'}, ${rules})`), 'Unassigned'); // 'us' inside a word must not match
});
test('normalizeRows_: FX conversion and account exclusion', () => {
  const out = g(`normalizeRows_([
    {date:'2026-09-01', source:'google_ads', account_name:'Demo', campaign:'x_us_y', spend:'100', currency:'USD', clicks:5},
    {date:'2026-09-01', source:'google_ads', account_name:'Sandbox Test', campaign:'x_us_y', spend:50},
  ], CONFIG)`);
  assert.strictEqual(out.length, 1);
  assert.ok(Math.abs(out[0].spend - 92) < 1e-9);
  assert.strictEqual(out[0].region, 'US');
});
test('normalizeRows_: unknown currency fails loudly', () => {
  assert.throws(() => g(`normalizeRows_([{date:'2026-09-01', account_name:'A', currency:'JPY', spend:1}], CONFIG)`), /No FX rate/);
});
test('channelSummary_: WoW and MoM on hand-computed data', () => {
  // US google: 10/day in current 7d, 5/day in previous 7d → WoW +100%.
  const rows = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(Date.UTC(2026, 8, 17 - i)).toISOString().slice(0, 10);
    rows.push({ date: d, source: 'google_ads', region: 'US', campaign: '', account_name: '', spend: i < 7 ? 10 : 5, impressions: 0, clicks: 0, conversions: i < 7 ? 1 : 0 });
  }
  // Previous month, same days 1..17 → 3/day → MoM compares 17 days each.
  for (let day = 1; day <= 17; day++) {
    rows.push({ date: `2026-08-${String(day).padStart(2, '0')}`, source: 'google_ads', region: 'US', campaign: '', account_name: '', spend: 3, impressions: 0, clicks: 0, conversions: 0 });
  }
  ctx.__rows = rows;
  const s = g("channelSummary_(__rows, 'US', '2026-09-17')");
  const google = s.find(x => x.source === 'google_ads');
  assert.strictEqual(google.l7d_spend, 70);
  assert.strictEqual(google.wow_spend, 1);
  assert.strictEqual(google.wow_conversions, null); // previous week had 0 conversions
  assert.strictEqual(google.l7d_cpa, 10);
  // MTD Sep 1–17: 14 days in rows (Sep 4–17): 7×10 + 7×5 = 105; Aug 1–17: 51 → MoM = 105/51 − 1
  assert.strictEqual(google.mtd_spend, 105);
  assert.ok(Math.abs(google.mom_spend - (105 / 51 - 1)) < 1e-9);
  assert.strictEqual(s[s.length - 1].source, 'Total');
});
test('channelSummary_: MoM window clamps to shorter previous month', () => {
  ctx.__rows = [
    { date: '2026-02-28', source: 'x', region: 'US', spend: 10, impressions: 0, clicks: 0, conversions: 0 },
    { date: '2026-03-31', source: 'x', region: 'US', spend: 10, impressions: 0, clicks: 0, conversions: 0 },
  ];
  const t = g("channelSummary_(__rows, 'US', '2026-03-31')").find(x => x.source === 'Total');
  assert.strictEqual(t.mom_spend, 0); // Mar 1–31 (10) vs Feb 1–28 (10)
});
test('weeklyFunnel_: joins CRM stages, cost per stage, stage conversion', () => {
  ctx.__rows = [{ date: '2026-09-15', source: 'x', region: 'US', spend: 300, impressions: 0, clicks: 0, conversions: 0 }];
  ctx.__funnel = [
    { week_start: '2026-09-14', region: 'US', stage: 'Lead', count: 30 },
    { week_start: '2026-09-14', region: 'US', stage: 'MQL', count: 10 },
    { week_start: '2026-09-14', region: 'US', stage: 'SQL', count: 0 },
    { week_start: '2026-09-14', region: 'Europe', stage: 'Lead', count: 99 },
  ];
  const f = g("weeklyFunnel_(__rows, __funnel, 'US', CONFIG.FUNNEL_STAGES, 2, '2026-09-17')");
  assert.strictEqual(f.length, 2);
  const w = f[1];
  assert.strictEqual(w.week_start, '2026-09-14');
  assert.strictEqual(w.Lead, 30);
  assert.strictEqual(w.cost_per_Lead, 10);
  assert.strictEqual(w.cost_per_SQL, null);
  assert.ok(Math.abs(w.Lead_to_MQL - 1 / 3) < 1e-9);
  assert.strictEqual(f[0].spend, 0);
});
test('dailySeries_ zero-fills missing days', () => {
  ctx.__rows = [{ date: '2026-09-02', source: 'x', region: 'US', spend: 5, impressions: 100, clicks: 2, conversions: 1 }];
  const s = g("dailySeries_(__rows, 'US', '2026-09-01', '2026-09-03')");
  assert.strictEqual(JSON.stringify(s.map(d => d.spend)), '[0,5,0]');
  assert.strictEqual(s[1].ctr, 0.02);
  assert.strictEqual(s[0].cpa, null);
});
test('sample data is deterministic', () => {
  const a = JSON.stringify(g("generateSampleAds_('2026-09-01','2026-09-03')"));
  const b = JSON.stringify(g("generateSampleAds_('2026-09-01','2026-09-03')"));
  assert.strictEqual(a, b);
});

// ---- end-to-end with mocked sheets ----
test('loadSampleData renders all region tabs without errors', () => {
  g('loadSampleData()');
  for (const name of ['US', 'Europe', 'LATAM', 'Unassigned', 'RAW_ADS', 'RAW_FUNNEL', 'RUN_LOG']) assert.ok(sheets[name], 'missing sheet ' + name);
  const log = sheets.RUN_LOG.cells;
  assert.strictEqual(log[log.length - 1][2], 'ok');
  assert.ok(sheets.US.cells[0][0].startsWith('US — paid media'));
  // Sandbox account must not reach any region tab.
  const raw = sheets.RAW_ADS.cells.slice(1).filter(r => r[2] === 'Sandbox Test');
  assert.ok(raw.length > 0, 'sample contains excluded account');
  const flat = JSON.stringify(sheets.US.cells);
  assert.ok(flat.includes('Channel summary') && flat.includes('Weekly funnel') && flat.includes('Daily (last 28 days)'));
  // Re-render must not stack conditional-format rules.
  const n = sheets.US.rules.length;
  g('recomputeFromRaw()');
  assert.strictEqual(sheets.US.rules.length, n);
});
test('live mode without API key fails with a clear message and is logged', () => {
  ctx.PropertiesService.getScriptProperties().setProperty('DATA_MODE', 'live');
  assert.throws(() => g('refreshDashboard()'), /API key is not set/);
  const log = sheets.RUN_LOG.cells;
  assert.strictEqual(log[log.length - 1][2], 'error');
});

console.log(`\n${passed} tests passed`);
