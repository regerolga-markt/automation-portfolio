# Weekly client dashboard with a watchdog

- **Staggered Monday ingests.** Three Make.com scenarios load Google Ads, GA4 and competitor data into a raw layer.
- **Watchdog.** A scenario runs after the ingests and alerts if the reporting layer is stale or incomplete, so a broken dashboard is caught before the client sees it.
- **Weekly headline.** An LLM task turns the week's numbers into an HTML dashboard with a written summary.
