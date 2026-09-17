---
name: aeo-brand-radar
description: AI visibility (AEO) measurement for any brand with Ahrefs Brand Radar. Set up and verify a report, write and audit tracked prompts, choose data sources and competitors, pull share of voice, mentions and cited domains, and turn them into an outreach and content list. Use whenever the work touches a brand's presence in AI answers: "AEO", "answer engine optimization", "LLM visibility", "are we visible in AI answers", "Brand Radar", "tracked prompts", "share of voice in ChatGPT", Perplexity / Gemini / AI Overviews visibility, "why is the report empty" or a flat report, "cited domains", "cited pages", "who should we pitch to get cited", planning content or outreach aimed at getting cited by models, or estimating what prompt tracking costs per month.
---

# AI visibility (AEO) with Ahrefs Brand Radar

This skill covers measurement and the work that follows from it. Pair it with the brand's
positioning notes (what may be claimed, who the ICP and anti-ICP are) and its SEO page plan
(what gets published).

Brand Radar measures whether models mention and cite the brand when answering real buyer
questions. **Setup is where it goes wrong:** a misconfigured report and genuinely zero
visibility look identical, and the two call for completely different responses.

## Setup record

Keep one filled-in copy of this table per brand in the project notes and verify it on every run.

| Item | Value |
|---|---|
| Target | `{domain}`, market(s) |
| Ahrefs project | `{project_id}` |
| Brand Radar report | `{report name}`, `{report_id}` |
| Tracked prompts | count, type `custom`, market, date of last revision |
| Sources | which surfaces daily, which weekly, which off |
| Tracked competitors | list, date of last revision |
| Out of scope by decision | legacy domains, product lines or prompt themes deliberately excluded |

The Ahrefs connector is **read-only**. Prompts, competitors and sources are set in the UI.
Produce paste-ready blocks; never claim to have configured anything.

## Always start with the retrospective baseline

```
site-explorer-ai-responses-count(
  target, mode=subdomains, country={market},
  select="chatgpt,perplexity,gemini,google_ai_overviews,grok,google_ai_mode")
```

Works with no setup at all and returns citations plus distinct cited pages per surface.
Record the date beside the numbers; this is what later improvement is proved against. It
comes first for two reasons: it gives a dated starting point before any configuration
exists, so improvement is later provable rather than asserted; and run against competitors it
produces the comparison that makes the case internally. Zero is a normal, reportable result.
Present it as a measured baseline, not a failure.

Run it for the brand and each main competitor, then look past the totals:

- **Per-surface gaps.** Compare the brand with the leader on each surface separately. Google surfaces (AI Overviews, AI Mode) and chat surfaces often differ sharply, and a surface at parity is an open opportunity.
- **Breadth of the citable surface.** Compare distinct cited pages, not just citations. If the brand has a few dozen cited pages against hundreds for the leaders, breadth of task-level pages is the binding constraint, ahead of outreach.

## Configuring Brand Radar, and verifying it actually collects

Order matters. Each step is verifiable through the read-only connector, so verify rather
than assume.

1. **Report exists.** `management-brand-radar-reports`: confirm the report id is present and the market is right.
2. **Prompts are in, and are `custom`.** `management-brand-radar-prompts(report_id)` should return the expected number of rows. `[]` means the report collects nothing at all, however active the UI looks.
3. **Sources are set** per the source table below. A source that is off collects nothing retrospectively; turning it on later starts its series from that day.
4. **Competitors are filled**, with the field rule below respected. Before the brand has citations of its own, competitors are the only thing that makes the report non-empty.
5. **Wait for a collection cycle.** Ahrefs polls models on a schedule, not when a prompt is saved. Roughly 24 hours at daily frequency.
6. **Then read.** `brand-radar-ai-responses` returning rows is the proof that the pipeline works end to end.

**Field rule in the report settings.** The left field is the brand string matched in answer
text; the right field is the URL pattern matched for citations. Entering a competitor on the
left as a bare domain (`example.com`) is a common mistake: models write the brand name in
prose, not the domain, so mentions undercount while citations look normal. After the first
full cycle, compare mentions against citations per competitor; near-zero mentions with
non-zero citations confirms it. The fix is the brand name on the left and the domain on the
right. For the brand itself, tie the name to `*.{domain}/*`. If the brand name is also an
ordinary word, this is what suppresses false positives.

## Writing tracked prompts

Prompts are **the questions the ICP actually asks a model**, not keywords and not brand
queries. Brand queries are useless early: nobody asks ChatGPT about a brand it has never
heard of. The goal is presence in the answers where a shortlist gets built.

Check every prompt against the brand's anti-ICP list before checking its plausibility. A
prompt that an anti-ICP user would ask pulls the wrong answers into the report and makes
adjacent-category tools look like competitors, benchmarking the brand in a race it has decided
not to run.

Five blocks work well:

| Block | Pattern | Share |
|---|---|---|
| Category shortlist | `best [category] for [audience]` · `what tool does [job] for you` | ~25% |
| Competitor alternatives | `[Competitor] alternatives` · `[Competitor] alternatives for [need]` | ~25% |
| ICP jobs to be done | `how to [specific job]`, one per job the product actually does | ~30% |
| Platform surfaces | `best tool for [platform-specific task]` | ~10% |
| Workflow / approach | `how do [audience] do [job] without [costly alternative]` · `is a [category] worth it instead of [incumbent tool]` | ~10% |

Rules:

- Use the ICP's words for the problem, not the product's words for the feature: "stop chasing unpaid invoices", not "automated receivables workflow".
- One job per prompt. A prompt that bundles three jobs returns answers attributable to none.
- Remove prompts for product lines or themes that are out of positioning, and record the decision so they don't creep back.
- No prompts built around names the ICP doesn't know (e.g. underlying model names). They date instantly.
- Tag prompts by the SEO page cluster they belong to, so the report cross-reads with the publishing plan. Brand Radar tags and Rank Tracker tags are separate systems and need not match in format.
- Deliver as plain blocks, one prompt per line, ready to paste into the UI.

## Choosing data sources

| Source | Default setting | Why |
|---|---|---|
| `chatgpt` | daily | largest share of usage; where the shortlist gets built |
| `google_ai_overviews` | daily | the only surface that directly affects organic CTR |
| `perplexity` | daily | picks up newly published pages fastest, the earliest signal that a new page landed |
| `gemini` | weekly | worth tracking for trend; costs quota |
| `claude` | weekly | **works only with custom prompts** |
| `google_ai_mode` | weekly | weekly is enough for trend |
| `copilot`, `grok` | off unless relevant | often noise in a niche; turn on if the audience uses them |

Adjust frequency to where the baseline shows the biggest gap. If prompt quota is tight, keep
ChatGPT and AI Overviews daily and drop the rest to weekly rather than dropping sources
entirely; a trend needs continuity more than frequency.

## Choosing competitors

- Track who the ICP actually shortlists, not who a positioning deck fears. Make sure the real incumbent is in the set; a set without it is aimed at the wrong benchmark.
- Exclude tools from adjacent categories that belong to the anti-ICP. They benchmark the brand in a race it does not run.
- Include the tools models actually name in answers to your prompts, even small ones. They are what dilutes the brand's share in practice.
- **Competitors cost nothing.** Checks are prompts × surfaces × locations only, so widen the competitor set freely. But every addition lowers share of voice mechanically. Say so before the number moves.

## Reading the report

Once a cycle has run:

- `brand-radar-sov-overview` / `-history`: share of voice against the competitor set.
- `brand-radar-mentions-overview` / `-history`: how often the brand is named in answers.
- `brand-radar-impressions-overview` / `-history`: volume and reach behind those mentions.
- `brand-radar-cited-domains`: **the outreach target list.** The domains models cite when answering your prompts.
- `brand-radar-cited-pages`: page-level version of the same; this is what an outreach email actually points at.
- `brand-radar-citations-overview` / `-history`: citation counts over time, the metric that moves first.
- `brand-radar-ai-responses`: the actual questions and answers, for reading how the brand is described when it does appear.

Prefer the `*-entities` variants where they exist; the inputs are more descriptive.

**Gotcha:** these endpoints reject `prompts=custom` without a `report_id`, and can fail
outright before a report has collected anything. If a call errors on a freshly created
report, that is the cause. Say so rather than retrying blindly.

## Caveats that travel with any share figure

1. Brand Radar only surfaces answers naming your brand or a **configured competitor**. The denominator is a narrow field, not the category, and it changes whenever the competitor set changes. Any comparison across a competitor-set change is invalid.
2. **A brand name that is also a common word** makes name-only matching noisy, with false-positive mentions. Tie matching to the domain before reporting share externally.

Prefer citations and distinct cited pages over share of voice when reporting progress: they
move first and they are less setup-dependent. Share of voice computed against a small
competitor set can sit below 1% for everyone and communicates nothing.

## Diagnosing an empty or flat report

Check in this order. Only the last means low visibility.

1. **Are there prompts?** `management-brand-radar-prompts(report_id)` returning `[]` means the report collects nothing at all. A report can exist, show "Active tracking", and be completely empty.
2. **Has a cycle run, and is it still running?** Ahrefs polls on a schedule; expect ~24h after prompts are added at daily frequency. `AI responses`, `Cited pages` and `Topics` are all downstream of that cycle. If collection stopped mid-month, suspect the custom-prompt check allowance rather than the report.
3. **Are competitors set, and are they the right ones?** With no citations of your own and a competitor set the prompts don't elicit, the report stays empty even after a successful crawl.
4. **Is the date filter narrower than the data?** A default "last 7 days" predates prompts added today.
5. **Is the prompt-type filter on `ahrefs` rather than `custom`?** Custom prompts are invisible under the wrong filter.

Say which one it is. "No data yet because the first collection runs overnight", "no data
because collection stopped" and "no data because models never mention us" are three
different messages to a stakeholder.

**Cost model.** One check = 1 prompt × 1 LLM × 1 location. Base plan allowances are small and
can be consumed in a single cycle by a full daily configuration; overage bills per check once
pay-as-you-go is on. Monthly checks ≈ prompts × locations × (daily sources × ~30 + weekly
sources × ~4). Competitors are free. Before proposing a prompt expansion, calculate and quote
the monthly cost delta at the current plan's per-check price.

## When you revise the prompt or competitor set

Rebuilding either set to match new positioning is normal. Carry these consequences into every
report:

- **The trend line breaks at the revision date.** The month of the change is a mixed month. The first complete month on the new set is the next calendar month, and the first honest month-over-month comparison lands the month after that. Name those months explicitly.
- **Share of voice moves mechanically** when the competitor count changes, with nothing having got better or worse. State this before the number moves, not after.
- Recalculate and record the new monthly run rate.
- Log what was removed and why, so off-positioning prompts don't return.

## Turning the data into work

The output of a Brand Radar read is a decision, not a dashboard tour.

- **Cited domains are the outreach list.** Being added to a page already cited is faster than outranking it. Rank the list by how often each domain appears in answers to your prompts.
- **Check the citation pattern of the category before choosing a playbook.** If video and community platforms (YouTube, Reddit) are cited more than any vendor domain, presence is earned through demonstration and peer discussion, not listicle placement.
- **Separate addressable from non-addressable domains.** Competitor-owned domains are not outreach targets. The reachable independents (review sites, software directories, tech media, tool-roundup publishers) are usually a short, specific list.
- **Prompts where only competitors appear are content gaps.** Each is a candidate page framed as a direct answer, handed to the SEO page plan with its cluster.
- **How models describe competitors is positioning input.** Models paraphrase whatever third-party pages say, so what needs changing is often those pages, not the brand's own site.
- When the cited surface is narrow, publishing task-level pages outranks outreach in leverage.

## What blocks AEO regardless of content

Citability has technical preconditions. If structured data is invalid on the pages you want
cited, no amount of writing helps: models cannot extract answers cleanly. Check schema status
before recommending more content, and hand schema defects to the technical SEO workstream
(see `seo-tech-audit`) rather than absorbing them here.

## Timeline to set expectations

| Milestone | When |
|---|---|
| First collected responses | ~24h after prompts are added |
| Usable cited-domain list | 3–7 days |
| First meaningful share-of-voice trend | 2–4 weeks |
| First citations for newly published content | 1–3 months |

There is no retrospective Brand Radar data for custom prompts, and any revision resets the
series. Name the first complete month rather than implying history exists.

## Don't

- Don't claim anything was configured. The connector is read-only; deliver paste-ready blocks and verify afterwards.
- Don't report an empty report as low visibility before walking the five diagnostic checks.
- Don't compare any metric across a prompt-set or competitor-set revision without the caveat.
- Don't lead a report with share of voice while it sits below 1%. Lead with citations and distinct cited pages.
- Don't report name-only mentions for a brand whose name is a common word. Match on the domain.
- Don't add prompts that target the anti-ICP or out-of-scope product lines.
- Don't treat competitor-owned cited domains as outreach targets, and don't put YouTube/Reddit on a link-outreach list; they are demonstration and community surfaces.
- Don't propose more prompts without quoting the monthly cost delta.
- Don't retry a failing Brand Radar call blindly: `prompts=custom` without `report_id`, or a report that has not collected yet, fails by design.
- Don't invent numbers when a cycle has not run. Say which cycle is missing and when it lands.
