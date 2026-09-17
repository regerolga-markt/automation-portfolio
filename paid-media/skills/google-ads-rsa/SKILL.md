---
name: google-ads-rsa
description: Build, refresh, audit and localize Google Ads Responsive Search Ads (RSA), including headlines, descriptions, path fields and pinning maps, inside Google's hard limits (30/90/15). Use whenever the user asks to build an RSA, write headlines or descriptions for Google Ads, write or refresh a Google ad, refresh an underperforming RSA, audit an existing ad for length, pinning, duplicates and angle coverage, or localize ad copy into another market as a native rewrite rather than a translation. Covers the asset-performance read via the Windsor connector before rewriting.
---

# Google Ads RSA

Produce a ready-to-paste RSA asset set that respects Google's hard limits, the brand's copy
rules and its voice. The same skill audits an existing RSA and localizes copy into another market.

Output per RSA:
- **15 headlines** (≤30 chars)
- **4 descriptions** (≤90 chars)
- **2 path fields** (≤15 chars)
- A **pinning map**

Default: one full RSA. For an ad group, default to **3 RSAs**, one per angle (see Angle
framework). Output is copy-pasteable with a live character count beside every line.

## Hard limits (Google rejects anything over these; never ship an over-length asset)

| Asset | Count | Char ceiling | Notes |
|---|---|---|---|
| Headline | up to 15 | 30 | Fill all 15. |
| Description | up to 4 | 90 | Fill all 4. |
| Path 1 / Path 2 | 2 | 15 each | Display path only; no spaces, hyphenate. |

Count includes spaces. If a draft busts 30/90/15, trim before showing it. If a keyword is
longer than 30 chars, move it into a description (90-char field) rather than truncating it,
which is also Google's own guidance.

## Copy rules (convention: reuse, don't reinvent)

- Use all 15 headlines; fill all 4 descriptions.
- **Never repeat the same word in Headline 1 and Headline 2.**
- Include the primary keyword in at least one headline (ideally 2+ unpinned).
- Every description carries a CTA.
- Build **3 RSAs per ad group**, one per angle: **feature / outcome / social proof**.
- Assets must be genuinely different ideas, not 15 rewordings of one.

## Angle framework

Each RSA leads on one angle. The asset pool still mixes, but the lead is distinct so you can
read angle-level performance.

- **Angle A, Feature:** what it is and what's inside. Name the concrete capability ("[Action] by [Method]", "Auto [Task] in One Click").
- **Angle B, Outcome:** what the user gets or ships ("[Result] in Minutes, Not Hours", "[Deliverable] Ready Same Day").
- **Angle C, Social proof / credibility:** scale, ratings, named users ("Trusted by [N] [Users]", "[Rating] on [Review site]").

⚠ Proof-point numbers (user counts, ratings, awards, logos) drift. Verify current figures
against the live landing page or the brief before shipping. Never carry a stale number
forward from an old ad.

## Pinning policy

**Default:** the **brand** headline is pinned to **Headline position 2**. Generic/keyword
headlines stay **unpinned**.

Implement it the way Google recommends, not the naive way:
- Pin **2–3 distinct brand-variant headlines to Headline position 2** (e.g. "[Brand]",
  "[Brand] Official Site", "[Brand] [Category]"), not a single asset. Pinning a lone asset to
  a position kills rotation and drops Ad Strength; pinning 2–3 variants keeps the brand in
  slot 2 while letting Google test among them.
- Leave Headline 1, Headline 3 and all descriptions **unpinned** so the algorithm optimizes freely.
- Ad Strength is a **diagnostic, not a performance metric**. A slightly lower rating caused by
  the H2 brand pin is an accepted tradeoff. Don't add filler headlines just to claw Ad Strength
  back to "Excellent"; diversity of real angles matters more than the badge.

## Voice

Write senior-to-senior for the actual buyer of the product. Concrete, active verbs: build,
ship, edit, cut, publish, apply, scale. Specific over vague: name the tool, the action, the
outcome (a named task and its result beats "advanced AI features"). Plain English, no hype,
no exclamation marks, no emoji. Sharp colleague, not a brochure.

If the brand has its own voice guide or positioning document, load it first; it overrides
these defaults where they conflict.

**Banned words** (never use): transform, unleash, revolutionize, journey, empower,
cutting-edge, world-class, best, leading, game-changing, supercharge, seamless, robust,
unlock, elevate, dive in, next-gen, and "AI-powered" used as decoration rather than as a
specific capability.

## Data source: Windsor MCP

**Live campaign, ad and asset data comes from the Windsor MCP connector.**

- Connector: `google_ads`. Account: `{GOOGLE_ADS_ACCOUNT_ID}` (ask the user if it is not known).
- Use it for asset-level and ad-level reads: impressions, clicks, conversions, cost per headline/description and per ad.
- Don't quote numbers from old exports or earlier tool outputs as current.
- If Windsor isn't connected or returns nothing, say so plainly and proceed from the landing page and brief. Never fabricate performance figures.

## Performance-informed mode

When refreshing an RSA, or when asked for the "best" angles/headlines, **don't write blind.
Pull the data first.**

1. Query asset-level performance via Windsor (`google_ads`, the account in question).
2. Identify which **angles** and **headline themes** sit in the top combinations and which are chronic underperformers.
3. Bias new copy toward proven angles; retire assets that consistently underperform; keep the pool diverse.
4. **Caveat (Google's own):** asset-level ratio metrics (CTR, CPC, CPA) are **directional only**. An asset's numbers are shaped by the combinations it served in. Evaluate at **ad-group / campaign level**, not by ranking individual assets in isolation. State this whenever you report "what works."
5. Replace, don't empty: swap the weak assets and keep 15/4 filled.

## Localization (native rewrite, not translation)

Only when a market other than the source language is requested. This is **transcreation**:
keep intent and positioning, rebuild the wording.

- **Native rewrite, never literal.** Match how buyers in that market actually phrase things; idiom, rhythm and emphasis change. A word-for-word translation is a failure even if "accurate."
- **Preserve the positioning anchors and the product's real claims** in every language. Never let localization quietly re-position the product.
- **Preserve CTA intent, not CTA words.** The local CTA is the natural imperative a native would click, not a calque.
- **Banned-word discipline carries over.** Each language has its own hype clichés (in Spanish, the equivalents of "power up", "take it to the next level", "revolutionize"; in German, "revolutionary"; and so on). They're banned too.
- **Limits bite harder in expansion languages.** Spanish, French, Portuguese and German run ~20–30% longer than English; the same idea often busts 30/90. Restructure or shorten the idea. Never ship over limit, never abbreviate into unreadable stubs.
- **Keyword fit, not keyword translation.** Match the search terms local buyers actually type; they're frequently not the literal translation.
- **Tone parity.** Same senior, concrete, no-hype register in both languages: not over-formal, not over-familiar.
- Regional Spanish: use neutral LATAM unless a country is named; avoid Spain-only usage (vosotros) for LATAM and vice versa.
- Output source line → localized line → char count (and limit), plus a one-line note on anything rephrased rather than translated, and why.

## Process

1. Get: campaign/theme, primary keyword, market/language, landing page, product specifics, ad group and which angle(s).
2. Fetch the landing page if available for real proof points; don't invent product details.
3. If refreshing or asked for best performers → Performance-informed mode (Windsor) first.
4. Draft 15 headlines across the angle's lead plus a supporting mix; count; trim to 30.
5. Draft 4 descriptions, each with a CTA; count; trim to 90. Apply the H1/H2 no-repeated-word rule.
6. Draft 2 paths; trim to 15.
7. Set the pinning map: 2–3 brand variants → H2; the rest unpinned.
8. Output the block with counts; list any ⚠ verify items.

## Output format

```
Campaign: [theme]   Market: [US/EU/...]   Ad group: [...]   Angle: [Feature/Outcome/Social proof]
LP: [url]   Primary keyword: [keyword]

HEADLINES (≤30)
 1. [text]                     (NN)  [pin: none]
 2. [text]                     (NN)  [pin: H2 · brand]
 ...
15. [text]                     (NN)  [pin: none]

DESCRIPTIONS (≤90)
 1. [text + CTA]               (NN)
 ...
 4. [text + CTA]               (NN)

PATHS (≤15)
 Path 1: [text]   (NN)
 Path 2: [text]   (NN)

PINNING: H2 = {brand variant headlines #..}; all else unpinned
⚠ Verify: [proof-point numbers, localized lengths, etc.]
```

## Audit mode (existing RSA)

Check, in this order, and report every hit:
- over-length lines (30 / 90 / 15);
- fewer than 15 headlines or 4 descriptions;
- near-duplicates and 15 rewordings of one idea;
- the same word repeated in H1 and H2;
- descriptions without a CTA;
- primary keyword missing from every headline;
- **single-asset pins** and over-pinning (recommend 2–3 brand variants in H2, everything else free);
- banned words and hype decoration;
- stale or unverifiable proof points;
- angle coverage vs feature / outcome / social proof (name the missing angle);
- localized copy that reads as a translation or breaks the target-language limits.

If Windsor performance data is available, close with which assets to retire and what to
replace them with.

## Tracking / UTM note

RSA copy and tracking are separate, but at the **ad level** the Final URL suffix
**overrides** higher-level suffixes with no merging. So `utm_source`/`utm_medium` must be
repeated in every ad-level suffix string. Hand UTM construction to the UTM mode of the
`tracking-qa` skill; don't half-build tags here.

## Don't

- Don't exceed 30 / 90 / 15.
- Don't invent product features, prices, ratings, awards, customer counts or logos the landing page doesn't claim.
- Don't pin a lone asset to H2, and don't pin descriptions.
- Don't ship 15 reworded versions of one headline.
- Don't chase "Excellent" Ad Strength with filler.
- Don't use banned words; don't translate literally.
- Don't rank individual assets by CTR/CPC as if absolute; they're directional.
- Don't quote performance figures without pulling them from the connector first.
