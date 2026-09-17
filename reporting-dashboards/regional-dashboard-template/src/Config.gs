/**
 * Regional Paid Media Dashboard — configuration.
 *
 * Everything account-specific lives here or in Script Properties.
 * The API key is NEVER stored in code: set it via the menu
 * "Dashboard → Set Windsor API key" (saved to Script Properties).
 */
const CONFIG = {
  // Windsor.ai connector: "all" pulls every connected ad platform.
  WINDSOR_CONNECTOR: 'all',
  WINDSOR_FIELDS: ['date', 'source', 'account_name', 'campaign', 'spend', 'impressions', 'clicks', 'conversions'],

  // How many days to (re)load on each daily run. Covers late conversions.
  // 70 days covers WoW and a full month-over-month comparison.
  LOOKBACK_DAYS: 70,

  // Reporting currency. Rows are converted with FX_TO_REPORTING[currency].
  REPORTING_CURRENCY: 'EUR',
  FX_TO_REPORTING: { EUR: 1, USD: 0.92, GBP: 1.17 },
  DEFAULT_SOURCE_CURRENCY: 'USD',

  /**
   * Region rules, evaluated top to bottom. The first rule whose regex matches
   * the campaign name (or the account name, if `field` says so) wins.
   * Example naming convention: "brand_us_search_2026q3" → region token "us".
   */
  REGION_RULES: [
    { region: 'US', field: 'campaign', pattern: /(^|[_\-\s])(us|na|usa)([_\-\s]|$)/i },
    { region: 'Europe', field: 'campaign', pattern: /(^|[_\-\s])(eu|emea|de|uk|fr|dach)([_\-\s]|$)/i },
    { region: 'LATAM', field: 'campaign', pattern: /(^|[_\-\s])(latam|br|mx|ar|co)([_\-\s]|$)/i },
  ],
  UNASSIGNED_REGION: 'Unassigned',

  /**
   * Accounts to ignore entirely (e.g. a sister brand sharing the Windsor workspace).
   * Matched case-insensitively against account_name.
   */
  EXCLUDED_ACCOUNT_PATTERNS: [/test/i, /sandbox/i],

  // Sheet names.
  SHEETS: {
    RAW: 'RAW_ADS',
    FUNNEL: 'RAW_FUNNEL',   // pasted from CRM: week_start | region | stage | count
    LOG: 'RUN_LOG',
  },

  // Funnel stages in order, as they appear in RAW_FUNNEL.
  FUNNEL_STAGES: ['Lead', 'MQL', 'SQL'],

  // Daily refresh hour (project timezone).
  TRIGGER_HOUR: 6,
};

/** Regions that get their own tab, in display order. */
function regionList_() {
  const regions = CONFIG.REGION_RULES.map(r => r.region);
  return regions.concat([CONFIG.UNASSIGNED_REGION]);
}
