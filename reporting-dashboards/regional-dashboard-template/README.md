# Regional Paid-Media Dashboard — Google Apps Script template

A Google Sheets dashboard that pulls ad spend from all paid channels through the [Windsor.ai REST API](https://windsor.ai/api-documentation/), splits it by region, and joins it with CRM funnel stages.

It was written from scratch as a clean template of a pattern I ran in production. It contains no client code or data, and ships with deterministic sample data so it works without any ad account.

## What you get
One tab per region (US / Europe / LATAM / Unassigned), each with three blocks:

| Block | Contents |
|---|---|
| Channel summary | Spend, conversions and CPA for the last 7 days with WoW; month-to-date spend and conversions with MoM (same number of days; clamped for shorter months) |
| Weekly funnel | Spend → Lead → MQL → SQL for 8 weeks, cost per stage and stage-to-stage conversion. Stages come from a CRM export pasted into `RAW_FUNNEL` |
| Daily view | 28 zero-filled days: spend, impressions, clicks, CTR, CPC, conversions, CPA |

Plus `RAW_ADS` (last pull), `RAW_FUNNEL` (CRM input) and `RUN_LOG` (every run with duration and status).

## Design choices
- **Pure logic separated from I/O.** All calculations live in `Core.gs` with no Apps Script service calls, so they are unit-tested in Node (`tests/run.js`, 12 tests including an end-to-end render against mocked Sheets).
- **Region by naming convention.** Regex rules on campaign tokens (`brand_us_search` → US). Word boundaries prevent false matches such as `business` → US. Unmatched campaigns go to an explicit `Unassigned` tab instead of disappearing.
- **Account exclusions.** Sandbox or sister-brand accounts that share the Windsor workspace are dropped before any totals.
- **Honest ratios.** WoW/MoM with a zero base return an empty cell, not +∞%. An unknown currency throws instead of silently summing mixed currencies.
- **Operational safety.** The API key lives in Script Properties, never in the sheet or the code, and is never written to logs. A script lock prevents overlapping runs, 429/5xx responses are retried with backoff, and every run is logged.
- **Idempotent render.** Each refresh rebuilds the tabs, and conditional-format rules are reset so they don't stack.

## Setup (5 minutes)
1. Create a Google Sheet → **Extensions → Apps Script**.
2. Create the files from `src/` (`Config.gs`, `Core.gs`, `Windsor.gs`, `SampleData.gs`, `Dashboard.gs`) and replace `appsscript.json` (enable *Show manifest* in project settings).
3. Reload the sheet → menu **Dashboard → Load sample data**.
4. For live data: **Dashboard → Set Windsor API key**, adjust `REGION_RULES`, `EXCLUDED_ACCOUNT_PATTERNS` and FX rates in `Config.gs`, then **Dashboard → Install daily trigger**.

Or push with [clasp](https://github.com/google/clasp): `clasp create --type sheets && clasp push`.

## Run the tests
```bash
node tests/run.js
```

## Limitations
- FX rates are static config values. Spend without a `currency` column is treated as `DEFAULT_SOURCE_CURRENCY`.
- The CRM funnel is a pasted export, not an API integration.
- Region mapping depends on a consistent campaign naming convention.
