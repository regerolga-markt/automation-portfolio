/**
 * Pure functions: no SpreadsheetApp / UrlFetchApp calls here,
 * so the logic is unit-testable outside Apps Script (see tests/).
 */

const METRICS = ['spend', 'impressions', 'clicks', 'conversions'];

function toNumber_(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return isFinite(n) ? n : 0;
}

function safeDiv_(a, b) {
  return b ? a / b : null;
}

/** Relative change; null when the base is zero (avoid fake +∞%). */
function pctChange_(current, previous) {
  return previous ? (current - previous) / previous : null;
}

/** 'YYYY-MM-DD' for a Date, using UTC parts to stay timezone-stable. */
function dateKey_(d) {
  return d.toISOString().slice(0, 10);
}

function parseDateKey_(key) {
  return new Date(key + 'T00:00:00Z');
}

function addDays_(key, n) {
  const d = parseDateKey_(key);
  d.setUTCDate(d.getUTCDate() + n);
  return dateKey_(d);
}

/** Monday of the ISO week containing `key`. */
function weekStart_(key) {
  const d = parseDateKey_(key);
  const dow = (d.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  d.setUTCDate(d.getUTCDate() - dow);
  return dateKey_(d);
}

function assignRegion_(row, rules, unassigned) {
  for (const rule of rules) {
    const value = String(row[rule.field] || '');
    if (rule.pattern.test(value)) return rule.region;
  }
  return unassigned;
}

/**
 * Windsor rows → normalised rows in reporting currency with a region.
 * Rows from excluded accounts are dropped.
 */
function normalizeRows_(rawRows, cfg) {
  const out = [];
  for (const r of rawRows) {
    const account = String(r.account_name || '');
    if (cfg.EXCLUDED_ACCOUNT_PATTERNS.some(p => p.test(account))) continue;
    const currency = String(r.currency || cfg.DEFAULT_SOURCE_CURRENCY).toUpperCase();
    const fx = cfg.FX_TO_REPORTING[currency];
    if (fx === undefined) throw new Error('No FX rate for currency ' + currency);
    const row = {
      date: String(r.date).slice(0, 10),
      source: String(r.source || r.datasource || 'unknown'),
      account_name: account,
      campaign: String(r.campaign || ''),
      spend: toNumber_(r.spend) * fx,
      impressions: toNumber_(r.impressions),
      clicks: toNumber_(r.clicks),
      conversions: toNumber_(r.conversions),
    };
    row.region = assignRegion_(row, cfg.REGION_RULES, cfg.UNASSIGNED_REGION);
    out.push(row);
  }
  return out;
}

function emptyTotals_() {
  const t = {};
  METRICS.forEach(m => (t[m] = 0));
  return t;
}

function addInto_(target, row) {
  METRICS.forEach(m => (target[m] += row[m]));
}

function sumRows_(rows, predicate) {
  const t = emptyTotals_();
  rows.forEach(r => {
    if (predicate(r)) addInto_(t, r);
  });
  return t;
}

/** Derived ratios for a totals object. */
function withRatios_(t) {
  return Object.assign({}, t, {
    ctr: safeDiv_(t.clicks, t.impressions),
    cpc: safeDiv_(t.spend, t.clicks),
    cpa: safeDiv_(t.spend, t.conversions),
  });
}

/** Daily totals for one region between fromKey and toKey inclusive (zero-filled). */
function dailySeries_(rows, region, fromKey, toKey) {
  const byDate = {};
  rows.forEach(r => {
    if (r.region !== region) return;
    byDate[r.date] = byDate[r.date] || emptyTotals_();
    addInto_(byDate[r.date], r);
  });
  const series = [];
  for (let k = fromKey; k <= toKey; k = addDays_(k, 1)) {
    series.push(Object.assign({ date: k }, withRatios_(byDate[k] || emptyTotals_())));
  }
  return series;
}

/**
 * Channel summary for one region as of `asOfKey` (last complete day):
 *  - L7D vs previous 7 days (WoW)
 *  - MTD vs the same number of days in the previous month (MoM)
 */
function channelSummary_(rows, region, asOfKey) {
  const l7From = addDays_(asOfKey, -6);
  const p7From = addDays_(asOfKey, -13);
  const p7To = addDays_(asOfKey, -7);

  const asOf = parseDateKey_(asOfKey);
  const dayOfMonth = asOf.getUTCDate();
  const mtdFrom = asOfKey.slice(0, 8) + '01';
  const prevMonthStart = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() - 1, 1));
  const prevMonthDays = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), 0)).getUTCDate();
  const pmFrom = dateKey_(prevMonthStart);
  const pmTo = addDays_(pmFrom, Math.min(dayOfMonth, prevMonthDays) - 1);

  const inRange = (r, a, b) => r.date >= a && r.date <= b;
  const sources = Array.from(new Set(rows.filter(r => r.region === region).map(r => r.source))).sort();

  const build = label => {
    const pick = label === '__total__' ? r => r.region === region : r => r.region === region && r.source === label;
    const l7 = withRatios_(sumRows_(rows, r => pick(r) && inRange(r, l7From, asOfKey)));
    const p7 = withRatios_(sumRows_(rows, r => pick(r) && inRange(r, p7From, p7To)));
    const mtd = withRatios_(sumRows_(rows, r => pick(r) && inRange(r, mtdFrom, asOfKey)));
    const pm = withRatios_(sumRows_(rows, r => pick(r) && inRange(r, pmFrom, pmTo)));
    return {
      source: label === '__total__' ? 'Total' : label,
      l7d_spend: l7.spend,
      wow_spend: pctChange_(l7.spend, p7.spend),
      l7d_conversions: l7.conversions,
      wow_conversions: pctChange_(l7.conversions, p7.conversions),
      l7d_cpa: l7.cpa,
      mtd_spend: mtd.spend,
      mom_spend: pctChange_(mtd.spend, pm.spend),
      mtd_conversions: mtd.conversions,
      mom_conversions: pctChange_(mtd.conversions, pm.conversions),
    };
  };

  return sources.map(build).concat([build('__total__')]);
}

/**
 * Weekly funnel for one region: ad spend joined with CRM stage counts.
 * funnelRows: [{week_start, region, stage, count}] pasted from the CRM report.
 */
function weeklyFunnel_(rows, funnelRows, region, stages, weeks, asOfKey) {
  const lastWeek = weekStart_(asOfKey);
  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = addDays_(lastWeek, -7 * i);
    const we = addDays_(ws, 6);
    const spend = sumRows_(rows, r => r.region === region && r.date >= ws && r.date <= we).spend;
    const row = { week_start: ws, spend: spend };
    stages.forEach(stage => {
      row[stage] = funnelRows
        .filter(f => weekStart_(String(f.week_start).slice(0, 10)) === ws && f.region === region && f.stage === stage)
        .reduce((acc, f) => acc + toNumber_(f.count), 0);
      row['cost_per_' + stage] = safeDiv_(spend, row[stage]);
    });
    for (let s = 1; s < stages.length; s++) {
      row[stages[s - 1] + '_to_' + stages[s]] = safeDiv_(row[stages[s]], row[stages[s - 1]]);
    }
    out.push(row);
  }
  return out;
}
