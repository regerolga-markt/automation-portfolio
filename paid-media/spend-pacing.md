# Cross-channel spend pacing

A daily month-to-date pacing sheet across Google Ads, Meta, LinkedIn and X.

- **v1** used native Make.com connectors per platform.
- **v2** was rebuilt on the Windsor.ai REST API to cut module count and operations cost.
- **Guards:** account-name filtering keeps data from unrelated ad accounts out of the regional split, and currency is normalised to EUR.
- **Weekly job** writes current-month spend into the planning tab.
- **Daily digest** of the same data goes out by email, split by region.

## Files

Make.com blueprints (import via *Create a new scenario → ⋯ → Import Blueprint*):

- [`pacing-mtd-native-connectors`](make/pacing-mtd-native-connectors.blueprint.json): v1, native Google Ads / Meta / LinkedIn modules
- [`pacing-mtd-windsor`](make/pacing-mtd-windsor.blueprint.json): v2 on the Windsor.ai API, region split by campaign name, USD → EUR
- [`pacing-monthly-current-month-windsor`](make/pacing-monthly-current-month-windsor.blueprint.json): weekly write of current-month spend into the planning tab
- [`pacing-monthly-sheet-writer`](make/pacing-monthly-sheet-writer.blueprint.json): one call that lays out the monthly planning table (example numbers)
- [`daily-paid-digest-email`](make/daily-paid-digest-email.blueprint.json): daily spend / conversions / CPA by region and channel, sent as an HTML email
- [`x-ads-email-export-ingest`](make/x-ads-email-export-ingest.blueprint.json): X Ads has no usable connector here, so the emailed .xlsx export is parsed from Gmail
