# Operating discipline

- **Registry first.** Every automation gets a row (platform, schedule, data flow, status) before it is built.
- **Targeted writes only.** Addressed `values:batchUpdate` by a stable key, never clear-and-rewrite, so parallel runs do not overwrite each other.
- **Cost model before schedule.** Run frequency comes from the operations formula, not from habit.
- **Right tool for the load.** Move from Make.com to Apps Script when operations become the constraint.
- **Secret scan** on everything that leaves the private repository ([`tools/scan_secrets.py`](../tools/scan_secrets.py)).
