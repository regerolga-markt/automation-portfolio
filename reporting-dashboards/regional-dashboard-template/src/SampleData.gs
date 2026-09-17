/**
 * Synthetic data so the dashboard can be explored without any ad account.
 * Deterministic (seeded) so screenshots and tests are reproducible.
 */

function seededRandom_(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function generateSampleAds_(fromKey, toKey) {
  const rnd = seededRandom_(42);
  const setup = [
    { source: 'google_ads', account_name: 'Demo Search', campaign: 'brand_us_search', base: 180, cpc: 2.4, cvr: 0.06 },
    { source: 'google_ads', account_name: 'Demo Search', campaign: 'generic_eu_search', base: 140, cpc: 1.9, cvr: 0.04 },
    { source: 'linkedin', account_name: 'Demo LinkedIn', campaign: 'abm_us_sponsored', base: 120, cpc: 7.5, cvr: 0.03 },
    { source: 'linkedin', account_name: 'Demo LinkedIn', campaign: 'leadgen_emea_form', base: 90, cpc: 6.8, cvr: 0.05 },
    { source: 'facebook', account_name: 'Demo Meta', campaign: 'retarget_latam_video', base: 60, cpc: 0.6, cvr: 0.02 },
    { source: 'facebook', account_name: 'Demo Meta', campaign: 'awareness_global_reach', base: 40, cpc: 0.4, cvr: 0.005 },
    { source: 'google_ads', account_name: 'Sandbox Test', campaign: 'qa_us_test', base: 5, cpc: 1, cvr: 0 },
  ];
  const rows = [];
  for (let k = fromKey; k <= toKey; k = addDays_(k, 1)) {
    const weekday = (parseDateKey_(k).getUTCDay() + 6) % 7;
    const weekendFactor = weekday >= 5 ? 0.6 : 1;
    setup.forEach(c => {
      const spend = c.base * weekendFactor * (0.8 + rnd() * 0.4);
      const clicks = Math.round(spend / c.cpc);
      rows.push({
        date: k,
        source: c.source,
        account_name: c.account_name,
        campaign: c.campaign,
        currency: 'USD',
        spend: Math.round(spend * 100) / 100,
        impressions: Math.round(clicks / (0.01 + rnd() * 0.02)),
        clicks: clicks,
        conversions: Math.round(clicks * c.cvr * (0.7 + rnd() * 0.6)),
      });
    });
  }
  return rows;
}

function generateSampleFunnel_(asOfKey, weeks) {
  const rnd = seededRandom_(7);
  const rows = [];
  const last = weekStart_(asOfKey);
  ['US', 'Europe', 'LATAM'].forEach(region => {
    for (let i = weeks - 1; i >= 0; i--) {
      const ws = addDays_(last, -7 * i);
      const leads = Math.round((region === 'US' ? 60 : region === 'Europe' ? 45 : 15) * (0.8 + rnd() * 0.4));
      const mql = Math.round(leads * (0.35 + rnd() * 0.1));
      const sql = Math.round(mql * (0.25 + rnd() * 0.1));
      rows.push({ week_start: ws, region: region, stage: 'Lead', count: leads });
      rows.push({ week_start: ws, region: region, stage: 'MQL', count: mql });
      rows.push({ week_start: ws, region: region, stage: 'SQL', count: sql });
    }
  });
  return rows;
}
