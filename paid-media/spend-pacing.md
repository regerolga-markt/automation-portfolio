# Cross-channel spend pacing

A daily month-to-date pacing sheet across Google Ads, Meta, LinkedIn and X.

- **v1** used native Make.com connectors per platform.
- **v2** was rebuilt on the Windsor.ai REST API to cut module count and operations cost.
- **Guards:** account-name filtering keeps data from unrelated ad accounts out of the regional split, and currency is normalised to EUR.
- **Weekly job** writes current-month spend into the planning tab.
- **Daily digest** of the same data goes out by email, split by region.
