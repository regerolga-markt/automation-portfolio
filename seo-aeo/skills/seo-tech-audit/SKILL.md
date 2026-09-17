---
name: seo-tech-audit
description: Turn an Ahrefs Site Audit crawl of any site into a triaged, owner-ready fix package, an .xlsx workbook with one tab per issue plus an umbrella ticket in the team's task tracker. Use whenever the user asks for a technical SEO audit, "run a site audit", "what's wrong with the site", asks about Health Score, broken pages / 404s, redirect chains, canonical problems, schema or structured-data errors, meta description and title issues, thin content, missing alt text, "build a ticket for the developers", "export the audit", or what to hand a developer to fix. Also use it whenever Site Audit numbers are being read back to a stakeholder, because raw Ahrefs counts are misleading and this skill explains how to correct them first.
---

# Technical SEO audit: triaged fix package

Turns an Ahrefs Site Audit crawl into something a developer or content person can act on
without a single follow-up question. Three stages: **triage** the crawl, **export** URL
lists into a workbook, **file** one umbrella ticket in the team's tracker.

The value is almost entirely in the triage. Raw Ahrefs output typically overstates the
workload by roughly 2x and buries the two or three findings that actually matter. Shipping
it unfiltered burns the team's trust in every audit you hand them afterwards.

## Before you start

- Ask which site / project. Get the `project_id` from `site-audit-projects`. Never assume.
  Note the crawl `target_mode` (`domain` vs `subdomains`); it changes how you read every number.
- The Ahrefs MCP connector is **read-only**. There are no write endpoints for Site Audit.
  Never say you will change a setting or re-run a crawl. Produce paste-ready output and say
  plainly that the change happens in the Ahrefs UI.
- Ask **where the ticket goes**: the tracker may be Notion, Google Sheets or Jira. Do not
  guess and do not default to any one of them. If the user does not answer, produce the
  ticket as markdown and say it is waiting for a destination.

## Stage 1: Triage the crawl

```
site-audit-projects(project_id)   → health score, crawl date, page counts
site-audit-issues(project_id)     → ~100 issue rows
```

Report the crawl date and time with **every** number you quote. A crawl is a snapshot; a
number without its timestamp starts an argument three days later.

Then apply these filters, in order. Each exists because skipping it produced a wrong answer
in practice.

### 1. Drop `crawled: 0`

Roughly 60 of the ~100 issue types have zero affected URLs. They are scaffolding, not
findings. A folder of empty CSVs is how an audit gets ignored.

### 2. De-duplicate the indexable / non-indexable pairs

Most content issues appear **twice** in the issues list, once with `is_indexable: true` and
once with `false`. "Meta description too long" shows up as, say, 27 and 61. Only the
indexable figure is actionable; noindex pages do not need rewritten metadata.

**Always count and export the indexable variant only, and say so in the output.** Otherwise
every number you report is roughly double the real workload, and someone spends a day
rewriting metadata for pages that are not in the index.

### 3. Check scope before calling anything a blocker

In `subdomains` mode the crawl covers every `*.example.com` host: staging mirrors, docs,
internal tools, app subdomains, customer-specific hosts, marketing microsites. Pull the URLs
for an issue and **look at the hostnames before escalating**.

"Robots.txt is not accessible, 19 URLs" reads like a site-wide emergency and can in fact be 19
non-production subdomains with no robots.txt while production is fine. Getting this backwards
means the first thing the stakeholder reads is wrong.

Do not treat `http://` variants of production URLs as separate problems either: same page,
counted twice. Same for trailing-slash and parameter duplicates.

Build the non-production host list per site at the start of the audit and reuse it in the
workbook's Scope column.

### 4. Sort by consequence, not by Ahrefs severity

Ahrefs severity is generic. Rank by what it costs *this* business:

1. Anything serving a **duplicate of production** (a staging mirror splits every ranking signal)
2. Anything breaking a **paid-traffic destination** (money is being spent against a 404)
3. **Invalid structured data** (blocks AEO citability; schema is a precondition for any
   AI-answer visibility workstream)
4. **Broken pages, redirect chains and loops, contradictory canonicals**
5. Metadata, thin content, alt text

Redirect chains deserve a named row of their own after a migration: they are usually one
mapping table's worth of work and they silently cap recovery.

### 5. Separate quick wins from structural investments

Two buckets, stated explicitly in the ticket and the README tab:

- **Quick wins**: bounded, one owner, shippable this sprint. A redirect rule, a canonical
  tag fix, a batch of 301s, a robots/noindex directive, a schema field. Lead the report with
  these; they are what buys the audit credibility.
- **Structural investments**: template changes, a content-gap backlog, re-platforming a
  section, systematic metadata rewriting across hundreds of URLs. These need planning and a
  named budget, not a sprint ticket.

Never let a structural item sit unlabelled next to a quick win in the same list. That is how
the whole list stalls.

## Stage 2: Export URL lists

```
site-audit-page-explorer(project_id, issue_id, select, limit, order_by)
```

`issue_id` comes from `site-audit-issues`. Select the columns that make the row actionable,
not just `url`:

| Issue type | Useful `select` |
|---|---|
| Broken pages | `url,http_code,internal_links` |
| Redirect chains / loops | `url,http_code,redirect_url,internal_links` |
| Canonical problems | `url,canonical,canonical_code` |
| Meta description | `url,meta_description_length,meta_description` |
| Title | `url,titles_length,title` |
| Thin content | `url,content_nr_word` |
| Alt text / link issues | `url,traffic` with `order_by=traffic:desc` |

**The endpoint caps at ~100 rows per call.** For anything larger, either paginate with
`offset`, or sort `traffic:desc`, take the top 100, and state in the tab note that the list
is partial and why the remainder is low priority. **Never present a truncated list as
complete.**

### Group by root cause

A flat list of 39 URLs is a chore. The same 39 grouped into four causes is a half-day task:

- 9 legal pages 404 with a trailing slash → one redirect rule
- 8 localized pages do not exist → a content gap, not a bug
- 10 URLs in a removed section → one batch of 301s
- 1 URL typo

Add a **Group / root cause** column and fill it. This is the single highest-leverage thing
in the export, and it is what turns a count into a quick win.

### Build the workbook

One `.xlsx`, **one tab per issue type**, numbered to match the ticket rows (`01`, `02`, ...).
Use `openpyxl`; read the `xlsx` skill first if one is available.

Every tab gets:
- an italic note in row 1: source, crawl timestamp, severity, row count, whether the list is
  complete, quick win vs structural, suggested owner
- a header row (dark fill, white bold) and frozen panes
- a **Scope** column classifying each URL as production / http variant / non-prod subdomain
- a **Group / root cause** column
- empty **Action** and **Status** columns. The sheet is the working surface; the ticket is
  only the summary.

Add a `00 README` tab: crawl date, pages crawled, Health Score, error/warning/notice counts,
the corrected (de-duplicated, scope-filtered) counts next to the raw ones, how to read the
file, the quick-win / structural split, the acceptance criteria, and a note on crawl scope.

Write output in **English** unless the user says otherwise; the file usually goes to a
cross-functional team.

Deliver as `.xlsx`. If the user uploads it to Google Sheets and returns per-tab `gid` links,
use those in the ticket. A file uploaded with `rtpof=true` is still an Excel file in Drive
and has **no per-tab `gid`**. It must be converted via *File → Save as Google Sheets*
first. For a second batch, import via *File → Import → Insert new sheet(s)* into the same
spreadsheet.

**Never invent a `gid`.** If you only have the workbook link, write the tab name and ask.

## Stage 3: File the umbrella ticket

Ask the user where it goes (Notion / Sheets / Jira) and confirm before writing anything into
a live tracker. The rule that holds regardless of tool: **the executing team works from the
table, not from the prose above it.** A correct description with an incomplete table has
produced real rework. If someone cannot execute a row without reading the surrounding text,
the row is wrong.

### Table columns

```
# | Issue | How to fix | Owner | SEO impact | AEO impact | Effort (quick win / structural) | Urgency | URL list | Dev ticket | Status
```

- **Issue**: one short line. `39 broken pages (404 / 403 / 409)`. Not a paragraph.
- **How to fix**: where the specifics go. Concrete enough to start on; name the actual fix,
  never "investigate".
- **SEO impact / AEO impact**: severity plus half a sentence of why. These genuinely differ:
  broken schema is Medium for SEO and Critical for AEO.
- **Effort**: quick win or structural. Carry the Stage 1 split through to the table.
- **URL list**: link to the workbook tab.
- **Owner**: leave blank rather than guessing, and add a note that owners are deliberately
  unassigned and no row starts without one.

### Split marketing from implementation

Marketing boards and website implementation are different queues. Mark the split in the table
(`n/a (marketing)` in the dev-ticket column for content rows) and say so explicitly in the
description. Without this, implementation rows sit on a marketing board untouched.

### If the tracker is Notion

Fetch the data source first to confirm select-option names; select properties reject unknown
values. Also note that Notion stores each table cell on **its own line**, so an
`update_content` `old_str` written as one concatenated line will not match. The API still
returns success, so a silent no-op looks like a completed edit. Include the newlines, use two
or three adjacent cells for uniqueness, and **re-fetch the page afterwards to confirm the
change landed**. Report what you verified, not what the tool returned.

## Acceptance criteria to put in the ticket

- Re-crawl after fixes; name the target Health Score relative to the measured baseline
  (e.g. "baseline [measured score] → target [higher score]"), not an abstract number.
- Per-row verification for the top items, phrased as **observable states**, not tasks:
  "no production copy served from any non-production subdomain", "every canonical resolves in
  one hop", "no redirect chain longer than one hop", "the key templates pass Google Rich
  Results Test".

## Reporting to a stakeholder

Lead with what changed in the world, not with the tool. Health Score and page counts are
context; the finding is "a full copy of the site is being served from a staging subdomain" or
"the paid landing page for the Spanish campaign returns 404".

Always show the corrected counts, and show the raw Ahrefs count next to them with one line on
why they differ. Never quote a raw Ahrefs total as the workload.

If a previous statement turns out wrong once the URLs are pulled (the robots.txt case is the
standing example), correct it in the **first line** of the next message rather than quietly
dropping it.

## Don't

- Don't show raw Ahrefs counts to a stakeholder. Always de-duplicate indexable/non-indexable
  and filter by scope first, and show the raw number with the reason for the difference.
- Don't count issues with `crawled: 0`. They are scaffolding, not findings.
- Don't escalate a problem without looking at the hostnames of the affected URLs.
- Don't treat `http://` variants and trailing-slash duplicates of production pages as separate problems.
- Don't present a truncated list (~100-row cap) as complete. Mark it in the tab note.
- Don't mix quick wins and structural investments in one unlabelled list.
- Don't hand over a flat URL list without a "Group / root cause" column.
- Don't sort by Ahrefs severity. Sort by cost to the business.
- Don't invent `gid`s, ticket numbers or owners. Leave the owner blank.
- Don't write to a tracker before confirming with the user which tracker and where exactly.
- Don't promise to change a setting in Ahrefs. The connector is read-only.
- Don't trust a successful Notion API response on a multi-op update without re-fetching.
- Don't quote a number without the crawl date and time.
