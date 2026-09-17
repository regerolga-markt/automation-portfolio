---
name: weekly-google-ads-dashboard
description: Weekly (Monday) Google Ads analysis for a subscription business, delivered as a single-file HTML dashboard on Chart.js. Covers spend, ROAS, CPA, week-over-week movement with conversion maturity and significance checks, funnel-stage trends with change markers from the campaign changelog, top ads and keywords, and recommendations. Use when the user asks for the Monday analysis, a weekly Google Ads report, "update the dashboard", weekly ROAS or CPA, or campaign dynamics for the week. Data source is the Windsor MCP connector. Outputs .html.
---

# Weekly Google Ads analysis (HTML dashboard)

A recurring weekly report on paid search for management. One account, one paid-subscription
funnel, weekly trend, WoW deltas. Output is a **single-file HTML dashboard on Chart.js**.

The dashboard answers: how much was spent, what the ROAS is, how metrics moved week over week,
what that produced in subscriptions and trials, where money works best, what we changed in the
account this week, and what to do next.

## Configuration (fill in per account before the first run)

| Parameter | Meaning |
|---|---|
| `GOOGLE_ADS_ACCOUNT_ID` | Account to pull |
| `SCOPE_CAMPAIGNS` | Campaigns this report covers. In a shared account, other managers' campaigns get at most one short "account context" block, with no recommendations |
| `CORE_CAMPAIGNS` | The subset reported separately as "core" (e.g. the main non-brand search campaigns) |
| `GA4_PROPERTY_ID` | Optional, engagement events only |
| `OPENAI_ADS_ACCOUNT_ID` | Optional, if the account also runs ChatGPT Ads |
| `BASE_CREATED` | Conversion action(s) meaning "subscription created" |
| `BASE_MONEY` | Conversion action(s) meaning "money received" (usually offline imports that carry value) |
| `EXCLUDED_ACTIONS` | True duplicates, renewals, engagement-only actions |
| `EP_WEIGHTS` | Expected Payer weights for subs / trials / engagement events |
| `CPA_GREEN_MAX`, `ROAS_GREEN_MIN` | Colour benchmarks for top-ads and keyword tables. Derive from the mature-week history, don't guess |
| `ANTI_ICP_CLUSTERS` | Keyword clusters that contradict positioning, flagged in the keyword block |
| `TRACKING_BREAK_DATES` | Dates of known tracking bugs or primary/secondary switches that make comparisons invalid |
| `SNAPSHOT_SHEET_ID` | Google Sheet storing weekly snapshots |
| `UI_LANGUAGE` | Dashboard language constant |

GA4 is used for engagement events only, never for paid CPA: GA4 last-non-direct attribution
undercounts paid by a wide margin. The source of truth for paid is Google Ads.

## Data: Windsor MCP

Always call `get_fields` before `get_data`. Don't guess field names.

**Slice 1: by campaign**
```
connector: google_ads
accounts:  ["{GOOGLE_ADS_ACCOUNT_ID}"]
fields:    ["week","campaign","spend","clicks","impressions","conversions","conversion_value"]
date_preset: "last_9w"
```

**Slice 2: by conversion action**
```
connector: google_ads
accounts:  ["{GOOGLE_ADS_ACCOUNT_ID}"]
fields:    ["week","conversion_action_name","all_conversions","conversion_value"]
date_preset: "last_9w"
```

**Slice 3: OpenAI Ads (ChatGPT Ads), if the account runs them**
```
connector: openai_ads
accounts:  ["{OPENAI_ADS_ACCOUNT_ID}"]
fields:    ["date","campaign","ad_group","campaign_status","spend","impressions","clicks"]
date_preset: "last_9w"
```

**GA4 (optional, engagement only):** connector `googleanalytics4`, account `{GA4_PROPERTY_ID}`.

Field notes:
- **The OpenAI Ads connector returns traffic only**: `spend`, `impressions`, `clicks`, `cpc`, `cpm`, `ctr`. There are no conversion fields at all. CPA, ROAS and Expected Payers cannot be calculated for this channel. Show it as a separate "traffic and click cost" block, never mix it into the Google Ads ROAS narrative, and never add its spend to the overall ROAS denominator.
- **`week` in `openai_ads` is a Sun–Sat week NUMBER** (`"31"`, `"32"`), not the ISO-week Monday that `google_ads` returns. Don't join them directly: pull `date` and aggregate to ISO weeks yourself, otherwise you shift by a day and attribute spend to the wrong week.
- `conversions` in slice 1 = primary actions only (`include_in_conversions_metric = true`). In slice 2 use `all_conversions`, otherwise secondary actions come back as zero.
- `week` is the Monday of the ISO week, format `yyyy-MM-dd`. The current week is always incomplete: either exclude it from WoW or label it "week not closed".
- `conversions` values are fractional (offline import with fractional attribution). That is normal, not an export error.

If Windsor does not respond, **ask, don't estimate**. No invented numbers.

## Conversion action inventory

This is the minefield map. Rebuild it on every run; the set of actions changes. Classify each
action in the account into one of these roles:

| Role | Typical example | Treatment |
|---|---|---|
| Broad paid-subscription step | "Paid subscription" funnel step, carries value | `BASE_CREATED` |
| Subset of the above | "Direct payment", value 0 | Never add to the broad step |
| Offline import that carries value and lags | "Trial payment (offline)", "Subscription (offline)" | **Not a duplicate.** `BASE_MONEY` |
| Offline import that is near-instant with value 0 | "Signup (offline)", "Trial start (offline)" | True duplicate, excluded |
| Top-of-funnel events | Free account signup, free trial start | Funnel stages |
| Engagement event | In-product chat or similar | Separate series, **not a bidding goal** |
| Renewals | Subscription renewal charge | Excluded from acquisition |
| Churn events | Trial cancelled, trial expired | For trial-to-payer only |
| Side actions | Onboarding done, lead form | Context only |

To tell a true duplicate from a separate base, pull `conversion_lag_bucket` and value per
action: a near-instant, zero-value offline twin is a duplicate; an offline action with most
events in a multi-day lag bucket that carries value is recording money actually received, and
can carry more value than the real-time base.

## Hard conversion rules (breaking one invalidates the report)

- **NEVER sum the broad subscription step and its subset** (e.g. "Paid subscription" + "Direct payment"). A correct full base is either the broad step alone, or the non-overlapping components. One base for the whole dashboard.
- **Web / offline pairs are not all duplicates.** Near-instant, zero-value offline twins are duplicates and are excluded. Offline actions that carry value and lag record money actually received and must not be called duplicates or thrown away.
- **The report runs on TWO bases, each labelled.** (1) **"subscription created"** = `BASE_CREATED`, readable almost immediately. (2) **"money received"** = `BASE_MONEY`, readable only once its measured lag has passed (can be a week or more after the week closes). The bases are **never summed**. Record a money-ROAS benchmark from mature weeks and reuse it.
- **Print a maturity percentage, not the phrase "undercounted".** Measure, for the Monday after a week closes, what share of each base has arrived for W-1 and W-2. For a lagging money base, W-1 can be near 0%. Anything below ~90% is drawn dashed/grey and labelled "do not read".
- **Event maturity is not final-number maturity.** Even when the created-base event has almost fully arrived, a closed week can keep being rewritten upward in later snapshots, likely because data-driven attribution reallocates fractional conversions between campaigns retroactively, which `conversion_lag_bucket` does not see. In practice the drift has been several times larger than the lag bucket suggests. **Never present event maturity as the maximum remaining upside.** Write "the event has arrived at N%, but attribution can still rewrite the week" and quantify the drift from the snapshot sheet.
- **Drift doesn't automatically cancel the conclusion. Check it, don't assume.** Compare multi-week blocks before and after maturing: if the gap between blocks is much larger than the drift, the direction stands. The honest answer to "isn't this just lag, it'll catch up?" is "it catches up by about X%, the direction stays", not a flat yes or no.
- **Trial-to-payer is NOT `created-base ÷ trial start`.** If both events fire on the click day, that is a ratio of simultaneous events, not a funnel, and it produces false collapses. Correct: **money-base trial payments ÷ trial starts**, on mature weeks only. Record the normal range from mature history.
- **Check significance before writing "drop".** With low weekly volumes (tens of subscriptions or fewer), Poisson σ ≈ √n is a large share of the total, so a single week is unreadable. Before writing "worst week in N weeks", check the min/max of the series, and don't measure a decline from the series maximum. Decompose ROAS movement into volume and average order value: order value can drive a large part of the movement.
- **Renewals stay out of the attribution narrative.** They are not acquisition; including them in conversion value inflates ROAS many times over.
- **Engagement conversions** go on a separate series marked "not a bidding goal", outside ROAS. Including an engagement event in bidding can make blended cost per conversion look excellent while the real CAC of a paid subscription rises: an efficiency illusion.
- **Known tracking breaks** (`TRACKING_BREAK_DATES`): never compare across them without a footnote.
- **Primary/secondary switches:** if a base action was moved from primary to secondary, check that you are pulling that action and not "All conversions".
- **Offline imports arrive with lag.** Never present a fresh conversion drop as a result before checking whether it is lag.

## Metrics

Below is the full inventory of what can be calculated. The short (default) format includes
only the funnel and top-list metrics from the Dashboard section; the rest is calculated on
request or to re-check a conclusion. KPI cards and the Simpson check are **not drawn** in the
default format.

**Tier 1, always:**
- Spend, Impressions, Clicks, Avg CPC, CTR.
- Paid conversions on the correct base, Conv. value, **ROAS = conv.value / cost** (breakeven line = 1.0).
- **Paid-subscription CPA** = cost / paid subs.
- **Expected Payers (EP)** = `subs × w_sub + trials × w_trial + engagement × w_eng` using `EP_WEIGHTS`; **cost-per-EP** for ranking campaigns (it often inverts the ROAS picture: best ROAS ≠ best cost/EP).
- **Trial-to-payer rate** + trend (flag immature cohorts of the current month).
- **WoW deltas** on all key metrics (absolute Δ + Δ%, ↑/↓ arrows).

**Tier 2, if data exists (otherwise "⚠ data needed"):**
- Lifetime-revenue ROAS from the business's BI (cumulative, by month), supplied by the user.
- Core signup→paid conversion trend.
- **Simpson check:** blended CPA vs core CPA. If the core's share of spend grows, the blended average misleads; show both.

**Engagement (GA4, optional):** weekly trend of the engagement events.

Out of scope: NPS, retention, expansion; campaigns outside `SCOPE_CAMPAIGNS`.

## Dashboard: canonical composition (Chart.js, single-file HTML)

**Default format is short.** Exactly **9 blocks and 2 charts**, listed below. Add nothing on
your own initiative. Build the long version (KPI cards, stacked spend by campaign, ROAS trend,
Simpson check, campaign table, full methodology) **only on direct request**; the long version
proved overloaded in practice.

Filename for a normal run: **`GAds_Weekly_[YYYY-Www].html`** with no suffix (short is default);
add `_long` only for the long version. Once a run is approved, keep it as the reference for
layout and order.

1. **Header**: period, core definition, note on the top-lists window.
2. **"In one line"**: one paragraph with the week's conclusion. Written last, after the calculations.
3. **"Where it improved, where it got worse"**: table of metric · mature-week average · current week · Δ% · badge "improved / worse / do not read". Metrics in funnel order: CPC → click→signup → cost per signup → signup→trial → signup→subscription → CPA → trial→payment. Immature stages get "do not read", not red.
4. **CPA trend** (line): core CPA, scope CPA, cost per trial. **With vertical change markers** from `campaign-changelog`: numbered lines plus a legend "N · date · what was done" under the chart. Implementation: a custom Chart.js plugin drawing a line and a numbered circle; `layout.padding.top ≈ 22`, otherwise the circles get clipped.
5. **Funnel-stage conversion trend** (line, %): improving stages in green, declining in red; the tail of an immature stage dashed with a hollow marker. Same change markers. Under the chart, absolute stage volumes for the week.
6. **Top ads**: over 4 weeks, not one (a single week has too few subscriptions to compare). Columns: headlines (lead line) · spend · CPC · subs · CPA · ROAS. Sorted by CPA. Best row green background, worst red. Colour benchmarks: CPA < `CPA_GREEN_MAX` and ROAS ≥ `ROAS_GREEN_MIN` is green.
7. **Top-5 keywords**: same period and benchmarks, plus a separate **"zero subscriptions in 4 weeks"** block with the total wasted spend and a note on which clusters contradict positioning (`ANTI_ICP_CLUSTERS`).
8. **What to do**: numbered list, each item with an amount or a threshold.
9. **Caveats, briefly**: 5–6 lines, not a wall. Subscription base, definition of the trial→payment stage and its maturity, colour benchmarks, what is excluded, known connector gaps.

**OpenAI Ads**: a separate block when the channel has spend. Headline wording: **"conversions exist, but they
are registrations; not usable for paid CPA or ROAS"** (check the actual conversion type in the
platform UI). Never "no conversions": Windsor doesn't return conversion fields, so they have to
be read from the UI by hand. The channel is not included in KPIs or ROAS/CPA charts.

**Fields for the top lists:** ads: `ad_id`, `ad_group`,
`ad_responsive_search_ad_headlines_combined_text` (null for some ads; identify those by
`ad_id`); keywords: `keyword_text`, `keyword_match_type`. Metrics: `spend`, `clicks`,
`impressions`, plus the per-action `all_conversions_*` and `all_conversions_value_*` fields
for your base actions (confirm exact names with `get_fields`). A filter such as
`[["spend","gt",20]]` cuts the long tail. `ad_group` arrives as a full resource name; shorten
it for display.

## Build mechanics

- **Single-file HTML**, Chart.js via CDN (cdnjs) **plus a local fallback**: after the CDN tag insert `<script>if(typeof Chart==="undefined"){document.write('<script src="data:text/javascript;base64,..."><\/script>');}</script>` with an inlined `chart.umd.js` (`npm i chart.js@4.4.1`, file `node_modules/chart.js/dist/chart.umd.js`, base64). Without it the dashboard renders neither in a sandbox (CDN blocked, so the render can't be checked) nor for a recipient whose network blocks cdnjs. **No** localStorage/sessionStorage; data inline in a JS object.
- **CSS trap:** a rule like `.box b{display:block}` breaks every `<b>` inside paragraph text; bold numbers jump onto their own lines. Always use `.box>b:first-child`.
- **Check the render before delivering.** Playwright (`npm i playwright-core`, point `executablePath` at the local Chromium), screenshot + count table rows and `pageerror`s. `ERR_TUNNEL_CONNECTION_FAILED` on the CDN is expected; the fallback takes over.
- Deliver the file to the user as an attachment.
- **Interface language** comes from a `UI_LANGUAGE` constant so the dashboard can be switched for a different audience quickly.
- Clean theme, brand accent colour; large numbers, readable charts.

## Monday process

1. Period: current ISO week + 8 weeks back for trend; WoW = last **closed** week vs the one before.
2. Pull both slices via Windsor (plus OpenAI Ads if applicable). GA4 / BI optional.
3. **Hygiene checks before calculating:** the right conversion action is pulled, not "All conv."; the broad step and its subset are not summed; value-carrying offline actions are kept as the second base, not thrown away; renewals excluded; engagement removed from ROAS; totals reconciled against the sum of rows; no comparison across a tracking break without a footnote.
3a. **Measure maturity, don't assume it.** Pull `conversion_lag_bucket` × `conversion_action_name` (× `campaign` if needed) on a mature window, i.e. clicks older than 40 days (for example `date_from` minus 10–11 weeks, `date_to` minus 6 weeks). Calculate the same-day share and the 7-day tail **separately for each base**. The curves differ several-fold, and account-wide differs from core. The resulting percentages go straight into the report.
3b. **Check significance.** Poisson test on three-week blocks of subscriptions per spend; never interpret a single week. If p > 0.05, write "within noise", not "drop".
4. Calculate Tier 1 (+ Tier 2 if available).
5. Build the dashboard per the canon.
6. Sanity check: ROAS = conv.value / cost; WoW arrows correct; breakeven line drawn; campaign ranking by cost/EP where shown.
7. **Write a snapshot to the snapshot sheet before delivering the dashboard.** Sheet `SNAPSHOT_SHEET_ID`. Columns: `snapshot_date, week, week_start, scope, spend, clicks, signups, trials, created_subs, created_value, roas, cpa, money_value, money_roas, note`. Write **all 9 weeks of the window × two levels (`core`, `scope`)**, not just the current week. The point of the sheet is to see how the same week gets rewritten from snapshot to snapshot. Mechanics: `Google Drive: download_file_content` with `exportMimeType: "text/csv"`, append rows, and put them back under the same file ID; don't overwrite the content with `create_file`.
8. Deliver the `.html` + **3 lines on "what changed this week"** for sending to management.
9. Flag explicitly if ROAS fell below 1.0 or paid-subscription CPA rose more than 20% WoW (both thresholds configurable).
10. **If a previous snapshot exists, show the drift.** One line: how much W-2 and W-3 were rewritten since last Monday. This answers "isn't it just lag?" before anyone asks.

## Don't

- Don't sum the broad subscription step and its subset.
- Don't add web and offline versions of the same action, but don't throw away value-carrying offline actions either: they are the "money received" base, not duplicates.
- Don't calculate trial-to-payer as `created-base ÷ trial start`; those are two simultaneous events, not a funnel.
- Don't put renewals into conversion value.
- Don't present a drop in the latest weeks as a result without checking offline-import lag. And don't write "the last 1–2 weeks are undercounted": calculate the maturity percentage and print it. But don't present event maturity as final-number accuracy either; weeks keep being rewritten (see conversion rules).
- Don't write "worst week in N weeks" without checking the series min/max, and don't measure a decline from the series maximum.
- Don't call a shift a drop without a Poisson test at low weekly volumes.
- Don't write "OpenAI Ads has no conversions"; the connector doesn't return them, which is a different thing.
- Don't take spend from GA4; don't use GA4 last-non-direct for paid CPA.
- Don't comment on campaigns outside the configured scope beyond one account-context block.
- Don't compare metrics across a known tracking break without a footnote.
- Don't put engagement conversions into ROAS or bidding goals.
- Don't ask for a CSV export when the Windsor connector works.
- Don't invent numbers when the source is unavailable: ask.
