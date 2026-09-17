---
name: tracking-qa
description: QA and repair of the analytics and conversion layer end to end. Diagnose tracking discrepancies and double-counted conversions across GTM (client and server), GA4, Google Ads and other ad platforms; statically validate an exported GTM container JSON before import or publish; and build or audit UTM tags and campaign names against a fixed convention. Use whenever the user says "check tracking", "conversions don't match", "conversions are counted wrong", "ROAS looks wrong", "why is this double-counted", "events are double-counted", "check the GTM container", "validate the GTM export", "did my edits apply", "before I publish", "any broken references", "build a UTM", "tag a link", "name a campaign", or after any programmatic edit to a `GTM-*.json`. Three modes: diagnose, container QA, UTM.
---

# Tracking QA

Three modes. Pick by what was asked; they compose.

- **Diagnose**: a discrepancy/anomaly is reported. Find root cause before proposing a fix.
- **Container QA**: an exported GTM container JSON must be machine-verified before import/publish.
- **UTM**: build or audit campaign names and tagged links against the convention.

Core principle across all three: **never propose a fix, and never say "done", before machine-verifying the state.** Most "tracking bugs" are one of a handful of known failure patterns. Walk the tree, confirm with data, then fix. Don't guess, don't trust the memory of having made an edit.

---

# Mode 1: Diagnose the analytics/conversion layer

## Stack assumptions to establish first

Before diagnosing anything, get these answers for the account in question; the whole tree depends on them:

- Does GTM run in **one container or two in parallel** (client-side `gtm.js` + server-side sGTM on a subdomain)? Two containers is valid but fragile; events split across them is the single biggest source of discrepancy.
- Which container collects **GA4**? Which sends **ad-platform conversions**?
- What is the **source of truth for revenue/contacts** (billing, payment processor, CRM, warehouse)? Ad-platform numbers are never the source of truth.
- Is there an **offline/batch import path** (warehouse → Ads offline conversions) in addition to real-time tags?
- Do **auth/checkout/forms live on a different origin** than the tracked site? Cross-origin kills client-side capture.
- Are third-party autocapture tools (product analytics, A/B tooling, CMP) also on the page?

## Known failure patterns (check these first)

1. **Twin-GTM duplication or silent loss.** Same event from both containers → the ad platform mis-deduplicates (drops valid conversions) or double-counts and then auto-corrects (visible as volatility). Event from only one container → if that pipeline breaks, it vanishes silently with no error.
2. **Conversion ID / label mismatch between containers.** A change applied in one container and not the other → events arrive with a stale conversion ID and the ad platform discards them, while billing still shows the transactions.
3. **Server-side events not attributed to GA4 sessions.** sGTM events lacking `session_id` / `client_id` / source → GA4 shows raw event counts with no source/medium or landing-page segmentation.
4. **Cookie / consent / subdomain mismatch on sGTM.** If the sGTM subdomain is not on the same root domain, first-party cookies aren't forwarded; or consent mode is misconfigured → events arrive without click ID / user context, unattributable, and Smart Bidding degrades.
5. **Duplicate or leftover primary conversion.** An old conversion action still marked *primary* alongside its replacement double-counts. Check the ad platform's conversion list for stale primaries. This is the classic "ROAS artifact".
6. **Offline import vs real-time tag conflict.** The same conversion sent both via sGTM→Ads API (real-time) and via warehouse/offline import (batch) → the platform sees it twice from two sources and handles it inconsistently. See the worked case below.
7. **Client-side `submit` ≠ confirmed server submission.** A DOM `submit` fires on attempt, not on success. A large `form_start` vs real-submission gap (thousands of starts vs hundreds of submits) means the tracked event is the wrong one. Track the success state, not the click.
8. **Cross-origin auth / checkout form.** A container on the main domain **cannot** see events on a different origin (separate auth, IdP, or hosted-checkout domain). Worse, an OAuth/social-login branch never exposes the identifier in the browser at all: **no client-side tool anywhere can capture it**. Only a **server-side call after successful login/purchase** covers 100%. Putting a container on the auth origin fixes the email/password branch only. Say this explicitly rather than promising a full fix.
9. **Unstable DOM selectors.** CSS-in-JS hashed classes change on every build; never use them as tracking hooks. Require a stable `data-*` attribute from engineering, or use the form vendor's own `postMessage` / callback event.
10. **Mixed-meaning events.** One event name covering both a lead signal and an in-product action (e.g. gated-asset download vs. logged-in app download), and only one of them is a conversion. Split by path/param before reporting.
11. **Third-party-hosted completions.** If completion happens on an external platform (webinar tool, hosted checkout, partner page), the on-site `form_submit` is a start, not a completion. Never report it as a conversion.

## Diagnosis tree (walk in order)

1. **Define the discrepancy precisely.** Which two numbers disagree, over which date range, in which tools? Get the actual figures, not "looks wrong".
2. **Locate the event.** Which container fires it: client, server, both, or offline import? This one answer resolves patterns 1–3 and 6.
3. **Enumerate every conversion action on the ad-platform side** and check for stale primaries, overlapping definitions, and subset relationships (pattern 5, and the double-count case below).
4. **Build/refresh the conversion mapping table**: one row per funnel stage, columns: dataLayer event → GTM tag → GA4 event → ad-platform conversion action → primary/secondary → source (tag vs offline).
5. **Check timing of the break against changes.** What changed in either container, in the tag config, or in the offline import job during the window where the numbers diverged?
6. **Check attribution context** (pattern 4): sGTM on the same root domain? cookies forwarded? consent mode aligned across containers?
7. **For form/lead gaps:** is the tracked event a client `submit` or a confirmed submission? Is the form cross-origin? Are selectors stable?
8. Only now propose a fix, tied to the confirmed cause. State cost/effort (container config vs backend dev) and whether it is a full or partial fix.

## The double-count case (canonical worked example)

Treat this as the reference pattern, because it is common in subscription accounts that run
both real-time tags and a warehouse offline import, and it silently inflates every CPA/ROAS
calculation.

A typical account ends up with conversion actions like these coexisting:

| Pair | Real-time tag | Offline/batch twin |
|---|---|---|
| Trial | `Trial payment` (tag) | `Trial payment (warehouse offline import)` |
| Subscription | `Direct payment` (tag) | `Subscription (warehouse offline import)` |

And, separately, a **subset relationship**: `Direct payment` is a *subset* of a broader
`Paid subscription` funnel-step action. The same payments are counted inside the broader action.

**Rules (non-negotiable):**

- **Never sum a real-time action and its offline twin** when they describe the same payment arriving by two routes. Summing them roughly doubles the conversion count and halves the reported CPA.
- **Confirm it really is a twin before excluding it.** Compare conversion lag and value: an offline action that fires near-instantly with value 0 is a true duplicate; one that carries value and arrives days later may be recording money actually received, which is a separate base, not noise. See `weekly-google-ads-dashboard` for the two-base approach.
- **Never sum an action with an action that contains it.** `Direct payment` + `Paid subscription` double-counts the overlap.
- **Pick one source of truth explicitly, per metric, before computing anything.** Decide real-time *or* offline (offline is usually more complete and closer to billing; real-time is fresher and is what bidding optimises on), then use only that side for the whole report.
- **Write the choice into the report's methodology section**, naming the exact conversion actions counted and the ones deliberately excluded. A number without that note is not deliverable.
- **Check which actions are marked primary.** If both members of a pair are primary, the account's own "Conversions" column is already double-counted. Flag it as an account fix, not just a reporting choice.
- When any new conversion action appears in the account, re-run step 3 of the tree before reusing an old report template.

Generalise the rule: **whenever two conversion actions can describe the same underlying business event (a duplicate route, a rename, a broader funnel step), they are never blindly summed. The source of truth is chosen explicitly and recorded.**

## Spec mode (designing tracking)

- Define each event by **funnel stage** and map it across GTM → GA4 → each ad platform with one consistent name per stage.
- Decide **per event which container owns it**; never fire the same conversion from two places unless deduplication keys (order/transaction ID) are explicit and verified.
- For server-side: pass `client_id`/`session_id`/source so GA4 can attribute; keep sGTM on the same root domain; align consent mode across containers.
- For auth/OAuth registrations: spec a **server-side call after successful login**, the only path covering both the email and the social branch.
- For custom forms: require a stable `data-*` hook or the vendor's `postMessage` callback; never depend on hashed classes.
- Document the spec as a dev-ready ticket: problem → why client-side cannot solve it → exact fix → owner question. Write it in English for engineering.

## Output (diagnose / spec)

- **Diagnose:** the precise discrepancy → most likely pattern(s) → the data/questions needed to confirm → the fix, marked full vs partial, with cost. Include the conversion-mapping table whenever names or double-counting are in doubt.
- **Spec:** event/stage map, container ownership, attribution requirements, dev ticket.

---

# Mode 2: Static validation of a GTM container export

Purpose: **never say "done" on a container edit without machine-verifying it.** The failure mode is silent: a string replacement that didn't match, a trigger renamed on one side but not the other, a conversion left firing on two signals. None of these throw an error; they produce wrong data after publish.

Run it on every container version before handing it back, and **show the report**: the deliverable is a machine sweep, not "I checked."

## When to run

- Before returning any edited `GTM-*.json`.
- After any programmatic edit (rewiring triggers, adding tags/variables, editing listener HTML).
- When the user asks whether edits applied, or before they import/publish.

## How to run

Parse the export with a script (write a throwaway parser if none is at hand, and never eyeball a container). Drive it with an EXPECTS list that asserts the intended edits actually landed; this is the part that catches the silent replace-miss.

```bash
python3 validate.py CONTAINER.json --expects EXPECTS.json
```

One EXPECTS entry per edit you *intended* to make:

```json
[
  {"tag":"241","fire":["350"]},
  {"tag":"242","paused":true},
  {"tag":"194","param":["form_id","{{dlv_form_id}}"]}
]
```

Exit 0 = PASS, 1 = hard issues (CI-friendly). Always author an EXPECTS file mirroring the change-list you just applied; structural checks catch breakage, EXPECTS catches "I forgot / it didn't apply."

## What it checks

**Hard issues (must fix before publish):**

1. **Reference integrity**: every `firingTriggerId` / `blockingTriggerId` points to a real trigger (GTM reserved IDs ≥ 2147479000 are ignored); every `{{variable}}` reference resolves to a defined or built-in variable. Dangling refs and unresolved `{{...}}` are hard fails.
2. **Duplicate IDs**: `tagId` / `triggerId` / `variableId` collisions.
3. **Duplicate variable NAMES**: two variables sharing a name make `{{name}}` ambiguous (the `form_id` vs `dlv_form_id` class of bug).
4. **Double-count wiring**: any conversion tag (`awct` / `gaawe`, not paused) firing on BOTH a PAGEVIEW trigger and a CUSTOM_EVENT trigger → the same action counted twice (the pageview + postMessage trap). Same check for one conversion action wired to two distinct tags.
5. **Failed expectations**: an intended edit that is not present in the file.

**Warnings (review; often legitimate):**

- A custom-event trigger listening for an event that no tag in this container pushes. Fine if the site, the CMP, or an external script pushes it; broken otherwise. **This is the listener↔trigger mismatch check: every event name pushed by a listener must have a consumer, and every consumed event must have a producer somewhere.**
- A listener pushing an event that no trigger consumes (orphan listener, usually a legacy event left after a rename).
- A trigger used by no tag (orphan trigger).

## Workflow

1. Apply edits programmatically, rebuilding from the original export. Preserve IDs, names, conversion labels.
2. Author `EXPECTS.json` = the exact change-list.
3. Run the validator with `--expects`.
4. **PASS** → hand back with the report. **FAIL** → fix, re-run; never hand back on FAIL.
5. Warnings: confirm each one is expected (name it in the response) or fix it.

## Checklist before publish

- [ ] No dangling trigger references, no unresolved `{{variables}}`.
- [ ] No duplicate tag/trigger/variable IDs; no duplicate variable names.
- [ ] No conversion tag firing on both a pageview and a custom event.
- [ ] No conversion action duplicated across two tags, or across a tag and an offline import (cross-check Mode 1).
- [ ] Every EXPECTS entry satisfied.
- [ ] Every listener↔trigger mismatch explained (external producer) or fixed.
- [ ] Every orphan trigger/listener explained or removed.
- [ ] Consent-mode and container-ownership decisions unchanged, or the change is stated.
- [ ] Import plan stated: fresh workspace, **Merge → Overwrite conflicting** (same IDs update in place). **Rename** would fork duplicates and leave the old contaminated tags firing.
- [ ] A GTM Preview checklist is attached (below). PASS here is not permission to publish blind.

## The honest limit: static ≠ runtime

This validates the container's **internal consistency**, not browser behaviour. **Static analysis does NOT replace GTM Preview.** It cannot tell you:

- whether a third-party form embed actually emits its ready/submit/submitted callbacks,
- whether a conversion beacon survives a redirect,
- whether lookup-table keys match the real runtime values,
- whether consent gating actually fires,
- whether the tag reaches the platform endpoint at all.

Those need **GTM Preview + a real test submit + a cross-check against the source of truth (CRM / GA4 / ad platform / billing)**. Always pair a PASS with that Preview checklist.

---

# Mode 3: UTM & campaign naming

Produce two artifacts, consistently and reproducibly:

1. **A campaign name**: the internal label in the ad platform.
2. **A fully tagged tracking URL**: base URL + UTM query string.

The point is that the same input always produces the same tags, so reporting never fragments on inconsistent casing or stray synonyms. **When in doubt, reuse the existing value rather than inventing a new one.**

## Controlled vocabulary: rules, not a fixed brand list

Every account keeps its own value tables; these are the rules the tables must follow. Read the account's existing live tags first and extend them; do not impose a new vocabulary on an account that already has one.

### utm_source: *the named origin of the click*

The specific platform or handle: `google`, `meta`, `linkedin`, `bing`, a named newsletter/publisher (`examplenewsletter`), an influencer handle. **Source is the named origin, not the channel type**: `examplenewsletter`, never `newsletter`. Lowercase, no spaces. Preserve any account-specific exact suffix verbatim where one exists (e.g. a booking-agency suffix on influencer handles).

### utm_medium: *the channel-type bucket*

A small closed list. Typical: `cpc` (all paid click-billed media, search **and** paid social), `email`, `newsletter`, `smm` (organic/influencer social), `display`, `affiliate`, `referral`.

**Rule:** one medium value covers all paid click-billed media; do not introduce a parallel `paidsocial`/`ppc`/`paid_social` synonym. The channel is distinguished by `utm_source`, not by medium. If the account already uses a different split, keep the account's split, but keep it *one* split.

### utm_campaign: *structured segment formula*

Campaign names are built from a fixed, ordered set of slots, lowercase, joined by `_`, so reporting can split on position. A well-formed convention:

`[network]_[region]_[objective]_[descriptor]_[segment]`

| Slot | Meaning | Typical values |
|---|---|---|
| `network` | ad network / ad type | `search`, `pmax`, `display`, `video`, `social` |
| `region` | market | `us`, `eu`, `es`, `latam`, or the account's market codes |
| `objective` | goal | `lgen`, `awr`, `brand`, `retarget` |
| `descriptor` | theme/product, the one free token | snake_case, short, reused verbatim across flights |
| `segment` | final qualifier (audience / sub-brand / flight) | account-defined |

Rules:

- **Order is fixed.** Never reorder or drop a slot. Use an explicit placeholder (`na`) when a slot does not apply.
- `descriptor` is the only free-text slot. Keep it short and **reuse it exactly**: don't invent a near-synonym next week.
- All lowercase, snake_case, ASCII.
- Whether a period/quarter token is appended, and what the last slot encodes, are **per-account decisions that must be locked before mass-tagging**: surface the question on first use instead of guessing.

### utm_content: *variant / audience / creative cell*

The creative or audience differentiator: `engineers`, `vp_eng`, `rsa_v1`, `static_a`. Be disciplined here: this is what makes creative-cell performance readable at all.

### utm_term: *keyword, paid search only*

Use the platform's dynamic keyword insertion (`{keyword}` in Google Ads) or omit. Never hand-set on social.

## Hard formatting rules

Apply to every value, always:

- **Lowercase only.**
- **snake_case**: no spaces, no `%20`; the word separator is `_`.
- No uppercase, no camelCase, no trailing punctuation.
- **ASCII only**: no accented characters even in ES/DE markets (`espanol`, not `español`).
- Never invent a synonym for a value that already exists in the account's vocabulary. Reuse beats novelty.
- Preserve required exact strings verbatim (dynamic-insertion tokens, agency suffixes).

## Multi-market handling

All markets share one taxonomy. Market is encoded in the **`region` slot**, never by translating field values:

- One campaign per region reads cleanly (`search_es_lgen_..._na` vs `search_us_lgen_..._na`).
- Don't localize medium/source values; `cpc` stays `cpc` in every market.
- For a genuinely multi-region flight, prefer splitting into separate campaigns over a combined token; regional reporting stays clean.

## Google Ads suffix gotcha (verified in practice)

The **Final URL suffix at the ad level completely overrides** suffixes set at campaign or account level. Parameters are **not merged**. Consequences:

- `utm_source`, `utm_medium` and everything else must be repeated **in full in every ad-level suffix string**. Never rely on inheritance.
- In Google Ads Editor, re-import matches on **Campaign + Ad Group + exact headline text**, so an unchanged-headline re-import updates suffixes in place without creating duplicate ads. The export/import file is **UTF-16 LE, tab-delimited**: a plain UTF-8 decode fails.

## Process

1. Identify the campaign slots, plus channel/source, base URL, and audience/variant for `utm_content`.
2. If the base URL is missing, **ask**: never guess the landing path.
3. Map each field against the account's vocabulary. If a needed value doesn't exist, propose one in-pattern and flag it `⚠ new value, confirm to add to taxonomy`.
4. Build the campaign name and the tagged URL.
5. Normalize: lowercase, snake_case, ASCII, strip spaces.
6. Output in the template; list `⚠ confirm` items beneath.

## Output format

```
Channel: [...]   Base URL: [...]

Campaign name
[network]_[region]_[objective]_[descriptor]_[segment]

Tracking URL
[base]?utm_source=...&utm_medium=...&utm_campaign=...&utm_content=...

Fields
  source:   [value]
  medium:   [value]
  campaign: [value]
  content:  [value]
  term:     [value or —]

⚠ To confirm/lock: [de facto or new values used]
```

For several links at once (a creative-cell matrix), output a plain table (one row per link, columns = the UTM fields + final URL) so it pastes into a sheet.

## Audit mode

When an existing UTM string is pasted for checking:

- Flag every off-convention value: case, synonyms, spaces, non-ASCII, missing field, wrong slot order.
- Show the corrected string.
- Don't silently "fix" the campaign theme if it may be an intentional new flight. Ask.

---

# Don't

**Diagnosis**

- Don't propose a fix before isolating the cause.
- Don't sum two conversion actions that can describe the same event (real-time + offline twin, or an action and the broader action containing it). Choose one source of truth and say so in the methodology.
- Don't report a number without naming which conversion actions it counts.
- Don't claim a client-side fix for a cross-origin or OAuth-branch problem. It cannot work; say so.
- Don't treat a client-side `submit` as a confirmed conversion.
- Don't report events completed on a third-party platform, or mixed-meaning download events, as clean conversions.
- Don't assume empty connector/ad data means a pipeline failure. Confirm it isn't just paused campaigns.

**Container QA**

- Don't hand back a container on FAIL, or without showing the report.
- Don't say "the edit is applied" from memory. Assert it with EXPECTS.
- Don't eyeball a container instead of parsing it.
- Don't present a static PASS as runtime proof; always pair it with a GTM Preview checklist.
- Don't import with **Rename**: it forks duplicates and leaves the old tags firing. Use Merge → Overwrite conflicting.
- Don't use hashed CSS-in-JS classes as selectors.

**UTM**

- Don't translate field values per market.
- Don't introduce a synonym for an existing source/medium value.
- Don't guess the landing path. Ask for the base URL.
- Don't add UTM params to internal links. It resets attribution.
- Don't capitalize, use spaces, or use non-ASCII, ever.
