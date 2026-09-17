# Weekly client dashboard with a watchdog

- **Staggered Monday ingests.** Three Make.com scenarios load Google Ads, GA4 and competitor data into a raw layer.
- **Watchdog.** A scenario runs after the ingests and alerts if the reporting layer is stale or incomplete, so a broken dashboard is caught before the client sees it.
- **Weekly headline.** An LLM task turns the week's numbers into an HTML dashboard with a written summary.

## Files

- [`dashboard-weekly-ingest-seo-ads`](make/dashboard-weekly-ingest-seo-ads.blueprint.json): Ahrefs, Brand Radar and Google Ads into the raw layer
- [`dashboard-weekly-ingest-ga4`](make/dashboard-weekly-ingest-ga4.blueprint.json): GA4 via Windsor.ai
- [`dashboard-weekly-competitors`](make/dashboard-weekly-competitors.blueprint.json): competitor metrics and AI citations
- [`dashboard-watchdog-alert`](make/dashboard-watchdog-alert.blueprint.json): alert when the run log is not OK
- Claude skill that builds the weekly report: [`skills/weekly-google-ads-dashboard`](skills/weekly-google-ads-dashboard/SKILL.md)
