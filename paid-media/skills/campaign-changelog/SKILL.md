---
name: campaign-changelog
description: Log every change made to ad campaigns and tracking in any ad account into a changelog Google Sheet. Use immediately after executing any campaign change in a conversation (pausing or launching campaigns or ads, budget or bid changes, creative or copy swaps, targeting edits, negative keywords, GTM/GA4/tracking changes, Make scenario edits), whether done via API, via Windsor, or specced for manual execution. Also use when the user says "log this change", "add it to the changelog", "what did we change", asks for a changelog extract for the weekly dashboard, or reports a change they made manually in the ad platform UI.
---

# Campaign changelog

A queryable audit trail of every change to paid media and tracking in an ad account. One row
= one atomic change. The log feeds the "what changed" markers of `weekly-google-ads-dashboard`
and the decision trail for kill/scale calls.

Without it, the weekly dashboard shows a metric moved and nobody can say whether we moved it.

## Configuration

Set these once per account and keep them outside the skill (project notes or memory):

| Parameter | Meaning |
|---|---|
| `CHANGELOG_SHEET_ID` | Google Sheet that holds the log |
| `CHANGELOG_TAB` | Tab name the rows go into |
| `DEFAULT_ACCOUNT` | Ad account ID used when no other is given |
| `IN_SCOPE_CAMPAIGNS` | The campaigns this log covers, if the account is shared with other managers |
| `MAKE_QUEUE_SCENARIO_ID`, `MAKE_DATA_STORE_ID` | Primary write path (see below) |
| `MAKE_DRIVE_SCENARIO_ID`, `DRIVE_INBOX_FOLDER_ID` | Fallback write path |
| `MAKE_WEBHOOK_URL` | Secondary write path, if used |
| `MAKE_SHEETS_CONNECTION_ID` | Google Sheets connection used by the scenarios |

## Golden rules

1. **Log at the end of any turn where a change was executed.** If a campaign was paused, a budget changed, GTM edited, an ad launched, the turn is not finished until the change is logged. Batch multiple changes from one turn into one logging step (multiple rows).
2. **One row per atomic change.** "Paused 3 angles" in one campaign = 1 row listing the 3. Budget change + pause = 2 rows.
3. **Detail = old → new.** `Daily budget $50 → $65`, not "raised budget". Future-you needs the delta.
4. **Manual changes count.** If the user says they changed something in the ad platform UI, log it with Source = `Manual UI`.
5. **Don't ask permission to log.** Logging is part of executing the change. Do ask if a required field is genuinely unknowable (e.g. the reason for a manual change the user hasn't explained).
6. **Scope = the campaigns in `IN_SCOPE_CAMPAIGNS`.** In a shared account, campaigns run by other managers are not ours to log or comment on.

## Destination

- Sheet: `CHANGELOG_SHEET_ID`, tab `CHANGELOG_TAB`.
- Columns: `Date | Platform | Account | Campaign | Action | Detail | Reason | Expected effect | Source`
- Default Account: `DEFAULT_ACCOUNT`.

### Field values

| Field | Format |
|---|---|
| Date | ISO date the change went **live in the platform**, not the date of logging |
| Platform | Google Ads, GTM, GA4, Make, Other |
| Account | `DEFAULT_ACCOUNT` unless the change is in GTM/GA4, then the container / property ID |
| Campaign | Exact campaign name(s), comma-separated |
| Action | launch, pause, budget, bid, creative, copy, targeting, negative_kw, keyword, tracking, structure, other |
| Detail | old value → new value. Numbers and names, no narrative |
| Reason | Data or hypothesis behind it. "bounce rate X% over 2 weeks", not "seemed right" |
| Expected effect | A metric and a horizon. This is what makes kill/scale reviews possible |
| Source | Claude chat, Manual UI, Make automation |

**Never start any field with `+`, `=`, `-` or `@`.** The `google-sheets:addRow` module writes
with `valueInputOption: "USER_ENTERED"`, so Sheets parses a leading `+` as a formula and the
cell lands as `#ERROR!`. This happened with an Expected effect that opened with `+2-4 ...`.
Write `Plus 2-4 ...`, `Up 2-4 ...`, `CPA 120 -> 95`. This applies to every column, not just numbers.

Language: entries in English regardless of conversation language. It keeps the log greppable
and report-ready.

## Write path (automated)

Do NOT hand the user a TSV block to paste. Write the rows.

**Data Store queue → Sheet (primary).** An on-demand Make scenario (`MAKE_QUEUE_SCENARIO_ID`):
Data Store (`MAKE_DATA_STORE_ID`) → `google-sheets:addRow` (spreadsheet `CHANGELOG_SHEET_ID`,
tab `CHANGELOG_TAB`) → delete record. Write one record per row over MCP with
`data-store-records_create`, then run the scenario. No files, no polling, lands on the same turn.

**Drive inbox → Sheet (fallback).** A Make scenario (`MAKE_DRIVE_SCENARIO_ID`) polls hourly:
Drive folder → ParseJSON → `google-sheets:addRow` → trash the file. **Keep it deactivated
normally**, because activating it fires a run immediately. If you activate it to flush a batch,
deactivate it again when done. Note that `scenarios_run` right after `scenarios_activate`
returns "Scenario is already being executed" because activation itself triggered the run;
wait and read `executions_list` instead of retrying.

1. Write ONE file per row into Drive folder `DRIVE_INBOX_FOLDER_ID` with `Google Drive: create_file`, `contentMimeType: "text/plain"`, conversion left ON (the file becomes a Google Doc; this is required, see traps).
2. Content = a single flat JSON object, keys exactly: `date`, `platform`, `account`, `campaign`, `action`, `detail`, `reason`, `expected_effect`, `source`.
3. It lands in the sheet within the hour. To land it immediately, call `Make: scenarios_run` on the scenario.

**Webhook (secondary).** A webhook scenario at `MAKE_WEBHOOK_URL`, same 9 keys as the JSON
body. Instant, but unreachable from sandboxes with restricted outbound network. Use it only
from a client with open outbound access.

### Traps found the hard way (do not rediscover these)

- **Raw `.json` uploads break the Drive trigger.** Make's `google-drive:TriggerNewFile` downloads via the retired Drive v2 `downloadUrl` and fails with `Invalid URI ... ?alt=media&source=downloadUrl`. Upload as `text/plain` WITH conversion so it becomes a Google Doc, and set `formatDocuments: "text/plain"` on the trigger.
- **The Doc export carries a BOM**, so `ParseJSON` on the raw value fails with "Source is not valid JSON". Strip it: `{{substring(toString(1.data); indexOf(toString(1.data); "{"); length(toString(1.data)))}}`.
- **`lastIndexOf` does not exist in Make.** `indexOf`, `substring`, `length`, `replace` do.
- **`ParseJSON` needs a data structure**, or the scenario saves as `isinvalid` and downstream `{{2.field}}` mappings will not resolve. Create a data structure with the 9 fields.
- **`google-drive:ActionTrashFile` takes `id`, not `fileId`.** With the wrong key the run still reports success and writes the row, but the file is never trashed and every later poll re-appends it. That is how duplicate rows appear.
- **`scenarios_update` deactivates the scenario.** Re-run `scenarios_activate` after every blueprint edit.
- **Never trust `status: SUCCESS`.** Check `executions_get` → `operations`: it must equal the number of modules. Then confirm the row by reading the sheet.

### Fixing a single bad cell

Faster than deleting and re-adding a row. Create a throwaway on-demand Make scenario with one
`google-sheets:makeAPICall` module on the Sheets connection, run it, delete it:

```
method: PUT
url:    /spreadsheets/{CHANGELOG_SHEET_ID}/values/{CHANGELOG_TAB}!H10?valueInputOption=RAW
body:   {"values":[["corrected text"]]}
```

The base URL already includes `/v4`. `valueInputOption=RAW` is what stops the value being
re-parsed as a formula. Row number = header row 1 plus the row's position; read the sheet as
CSV first to count.

## Cleaning up a bad row

`google-sheets:deleteRow` needs the numeric gid, not the tab name, and the gid is not
necessarily 0. Chain two `google-sheets:makeAPICall` modules instead:
`GET /spreadsheets/{id}?fields=sheets.properties`, then `POST /spreadsheets/{id}:batchUpdate`
with `"sheetId":{{1.body.sheets[N].properties.sheetId}}` (N = the tab's index) and a
`deleteDimension` range. The base URL already includes `/v4`.

## Read path

`Google Drive: download_file_content` with CSV export, or `read_file_content`. Filter by date
range for the weekly extract.

The weekly dashboard draws changes as numbered vertical markers on its trend charts rather
than as a table. Consequences for how rows are written:

- **Pull the whole trend window (e.g. 9 weeks), not just the reporting week.** The markers span the whole window.
- **The `Date` field is load-bearing for the charts.** It decides which week a marker lands on. It must be the date the change went live in the platform, never the logging date. A wrong date silently moves the marker to the wrong week and makes a change look like the cause of something it could not have caused.
- The marker label is built from `Date` + a compressed `Action`/`Detail`, so keep `Detail` in the old → new form. Narrative in `Detail` produces an unreadable legend.

## Anti-patterns

- Logging plans or discussions. Only executed changes get rows. A spec that hasn't shipped is not a change.
- Duplicating a row when the same change is mentioned again later in the conversation.
- Padding Detail with narrative. Old → new. The Reason field carries the story.
- Logging campaigns outside the configured scope.
- Writing "row added to the sheet" when only a TSV block was produced. Say what actually happened.
