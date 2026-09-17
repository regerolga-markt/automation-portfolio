/**
 * Windsor.ai REST client.
 * Docs: https://windsor.ai/api-documentation/
 * Endpoint: https://connectors.windsor.ai/{connector}?api_key=…&fields=…&date_from=…&date_to=…
 */

const WINDSOR_BASE = 'https://connectors.windsor.ai/';
const API_KEY_PROP = 'WINDSOR_API_KEY';

function getApiKey_() {
  return PropertiesService.getScriptProperties().getProperty(API_KEY_PROP);
}

function fetchWindsor_(dateFrom, dateTo) {
  const key = getApiKey_();
  if (!key) throw new Error('Windsor API key is not set. Use Dashboard → Set Windsor API key.');

  const params = {
    api_key: key,
    fields: CONFIG.WINDSOR_FIELDS.join(','),
    date_from: dateFrom,
    date_to: dateTo,
  };
  const query = Object.keys(params)
    .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k]))
    .join('&');
  const url = WINDSOR_BASE + encodeURIComponent(CONFIG.WINDSOR_CONNECTOR) + '?' + query;

  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const code = res.getResponseCode();
    if (code === 200) {
      const body = JSON.parse(res.getContentText());
      return body.data || [];
    }
    // Never log the URL: it contains the API key.
    lastError = new Error('Windsor HTTP ' + code + ': ' + res.getContentText().slice(0, 200));
    if (code < 500 && code !== 429) break;
    Utilities.sleep(2000 * attempt);
  }
  throw lastError;
}
