/**
 * Sheet I/O: menu, refresh, rendering. All calculations live in Core.gs.
 */

const DAILY_DAYS = 28;
const FUNNEL_WEEKS = 8;
const MODE_PROP = 'DATA_MODE'; // 'live' | 'sample'

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Dashboard')
    .addItem('Refresh now', 'refreshDashboard')
    .addItem('Recompute from RAW (no API call)', 'recomputeFromRaw')
    .addSeparator()
    .addItem('Load sample data', 'loadSampleData')
    .addItem('Set Windsor API key', 'promptApiKey')
    .addItem('Install daily trigger', 'installDailyTrigger')
    .addToUi();
}

function promptApiKey() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt('Windsor API key', 'Stored in Script Properties, never in the sheet.', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  PropertiesService.getScriptProperties().setProperty(API_KEY_PROP, res.getResponseText().trim());
  PropertiesService.getScriptProperties().setProperty(MODE_PROP, 'live');
  ui.alert('Saved. Run Dashboard → Refresh now.');
}

function installDailyTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'refreshDashboard')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('refreshDashboard').timeBased().everyDays(1).atHour(CONFIG.TRIGGER_HOUR).create();
  SpreadsheetApp.getActive().toast('Daily refresh at ' + CONFIG.TRIGGER_HOUR + ':00 installed.');
}

/** Last complete day in the project timezone. */
function yesterdayKey_() {
  const tz = Session.getScriptTimeZone();
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  return addDays_(today, -1);
}

function refreshDashboard() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Another refresh is running.');
  const started = new Date();
  try {
    const asOf = yesterdayKey_();
    const from = addDays_(asOf, -CONFIG.LOOKBACK_DAYS);
    const mode = PropertiesService.getScriptProperties().getProperty(MODE_PROP) || 'sample';
    const raw = mode === 'live' ? fetchWindsor_(from, asOf) : generateSampleAds_(from, asOf);
    writeRaw_(raw);
    render_(raw, asOf);
    logRun_(started, 'ok', mode + ': ' + raw.length + ' rows');
  } catch (e) {
    logRun_(started, 'error', e.message);
    throw e;
  } finally {
    lock.releaseLock();
  }
}

function loadSampleData() {
  PropertiesService.getScriptProperties().setProperty(MODE_PROP, 'sample');
  const asOf = yesterdayKey_();
  writeFunnel_(generateSampleFunnel_(asOf, FUNNEL_WEEKS));
  refreshDashboard();
}

function recomputeFromRaw() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(CONFIG.SHEETS.RAW);
  if (!sheet) throw new Error('No ' + CONFIG.SHEETS.RAW + ' sheet yet. Run Refresh first.');
  render_(readObjects_(sheet), yesterdayKey_());
}

// ---------- rendering ----------

function render_(raw, asOf) {
  const rows = normalizeRows_(raw, CONFIG);
  const funnelSheet = SpreadsheetApp.getActive().getSheetByName(CONFIG.SHEETS.FUNNEL);
  const funnelRows = funnelSheet ? readObjects_(funnelSheet) : [];
  regionList_().forEach(region => renderRegion_(region, rows, funnelRows, asOf));
}

function renderRegion_(region, rows, funnelRows, asOf) {
  const sheet = getOrCreateSheet_(region);
  sheet.clear();
  sheet.setConditionalFormatRules([]);
  let r = 1;
  sheet.getRange(r, 1).setValue(region + ' — paid media (' + CONFIG.REPORTING_CURRENCY + '), data through ' + asOf)
    .setFontWeight('bold').setFontSize(14);
  r += 2;

  // 1. Channel summary
  const summary = channelSummary_(rows, region, asOf);
  r = writeTable_(sheet, r, 'Channel summary', [
    ['Channel', 'source'], ['Spend L7D', 'l7d_spend', 'money'], ['WoW', 'wow_spend', 'pct'],
    ['Conv. L7D', 'l7d_conversions', 'int'], ['WoW', 'wow_conversions', 'pct'], ['CPA L7D', 'l7d_cpa', 'money'],
    ['Spend MTD', 'mtd_spend', 'money'], ['MoM', 'mom_spend', 'pct'],
    ['Conv. MTD', 'mtd_conversions', 'int'], ['MoM', 'mom_conversions', 'pct'],
  ], summary);

  // 2. Funnel
  const stages = CONFIG.FUNNEL_STAGES;
  const funnelCols = [['Week', 'week_start'], ['Spend', 'spend', 'money']];
  stages.forEach(s => funnelCols.push([s, s, 'int'], ['Cost / ' + s, 'cost_per_' + s, 'money']));
  for (let i = 1; i < stages.length; i++) {
    funnelCols.push([stages[i - 1] + '→' + stages[i], stages[i - 1] + '_to_' + stages[i], 'pct']);
  }
  r = writeTable_(sheet, r, 'Weekly funnel (CRM stages from ' + CONFIG.SHEETS.FUNNEL + ')', funnelCols,
    weeklyFunnel_(rows, funnelRows, region, stages, FUNNEL_WEEKS, asOf));

  // 3. Daily view
  r = writeTable_(sheet, r, 'Daily (last ' + DAILY_DAYS + ' days)', [
    ['Date', 'date'], ['Spend', 'spend', 'money'], ['Impr.', 'impressions', 'int'], ['Clicks', 'clicks', 'int'],
    ['CTR', 'ctr', 'pct'], ['CPC', 'cpc', 'money'], ['Conv.', 'conversions', 'int'], ['CPA', 'cpa', 'money'],
  ], dailySeries_(rows, region, addDays_(asOf, -(DAILY_DAYS - 1)), asOf));

  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 12);
}

const FORMATS = { money: '#,##0.00', int: '#,##0', pct: '0.0%' };

function writeTable_(sheet, startRow, title, columns, objects) {
  sheet.getRange(startRow, 1).setValue(title).setFontWeight('bold');
  const header = columns.map(c => c[0]);
  const values = objects.map(o => columns.map(c => (o[c[1]] === null || o[c[1]] === undefined ? '' : o[c[1]])));
  const top = startRow + 1;
  sheet.getRange(top, 1, 1, header.length).setValues([header]).setFontWeight('bold').setBackground('#f1f3f4');
  if (values.length) {
    sheet.getRange(top + 1, 1, values.length, header.length).setValues(values);
    columns.forEach((c, i) => {
      if (c[2]) sheet.getRange(top + 1, i + 1, values.length, 1).setNumberFormat(FORMATS[c[2]]);
    });
    columns.forEach((c, i) => {
      if (c[2] === 'pct' && /^(wow|mom)/.test(c[1])) {
        const range = sheet.getRange(top + 1, i + 1, values.length, 1);
        const rules = sheet.getConditionalFormatRules();
        rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThan(0).setFontColor('#1e8e3e').setRanges([range]).build());
        rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberLessThan(0).setFontColor('#d93025').setRanges([range]).build());
        sheet.setConditionalFormatRules(rules);
      }
    });
  }
  return top + values.length + 3;
}

// ---------- sheet helpers ----------

function getOrCreateSheet_(name) {
  const ss = SpreadsheetApp.getActive();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function writeRaw_(raw) {
  const sheet = getOrCreateSheet_(CONFIG.SHEETS.RAW);
  sheet.clear();
  const cols = CONFIG.WINDSOR_FIELDS.concat(['currency']);
  const values = [cols].concat(raw.map(r => cols.map(c => (r[c] === undefined ? '' : r[c]))));
  sheet.getRange(1, 1, values.length, cols.length).setValues(values);
}

function writeFunnel_(funnel) {
  const sheet = getOrCreateSheet_(CONFIG.SHEETS.FUNNEL);
  sheet.clear();
  const cols = ['week_start', 'region', 'stage', 'count'];
  const values = [cols].concat(funnel.map(r => cols.map(c => r[c])));
  sheet.getRange(1, 1, values.length, cols.length).setValues(values);
}

function readObjects_(sheet) {
  const values = sheet.getDataRange().getValues();
  const header = values.shift().map(String);
  const tz = Session.getScriptTimeZone();
  return values.filter(v => v.join('') !== '').map(v => {
    const o = {};
    header.forEach((h, i) => {
      o[h] = v[i] instanceof Date ? Utilities.formatDate(v[i], tz, 'yyyy-MM-dd') : v[i];
    });
    return o;
  });
}

function logRun_(started, status, message) {
  const sheet = getOrCreateSheet_(CONFIG.SHEETS.LOG);
  if (sheet.getLastRow() === 0) sheet.appendRow(['started', 'seconds', 'status', 'message']);
  sheet.appendRow([started, (new Date() - started) / 1000, status, message]);
}
