# Marketing Automation — Olga Reger

For the last two years I ran performance marketing as a one-person team. The only way to keep up was to hand the routine checks to automation: is spend on pace, what changed in the accounts, why the dashboard looks off this morning.

This repo collects the patterns that held up in real use across paid media, analytics, reporting and SEO. They run on Make.com, the Claude API, Google Apps Script and Windsor.ai.

Everything was built for an employer or clients, so I describe how each piece works instead of sharing exports or account data. The one exception is the dashboard template: written from scratch, it runs on sample data and comes with tests.

Each folder has a short write-up per automation, the Make.com blueprints behind it (`make/`) and the Claude skills I use to run it (`skills/`). Blueprints and skills are sanitized copies: keys, account IDs, sheet IDs, client names and business numbers are replaced with placeholders, so they import and read as working templates.

| Folder | Patterns |
|---|---|
| [`paid-media/`](paid-media/) | Cross-channel spend pacing · Campaign change log |
| [`analytics-tracking/`](analytics-tracking/) | LLM-assisted GTM tagging |
| [`reporting-dashboards/`](reporting-dashboards/) | Regional paid-media dashboard (**with a working Apps Script template**) · Weekly dashboard with watchdog |
| [`crm-abm/`](crm-abm/) | LinkedIn ABM → CRM |
| [`seo-aeo/`](seo-aeo/) | Technical SEO audit package · AI-answer visibility tracking |
| [`ops-patterns/`](ops-patterns/) | Operating discipline |

**Stack:** Make.com · Claude API · Google Apps Script · Windsor.ai · Google Ads / Meta / LinkedIn / X Ads · GTM / GA4 · HubSpot · Ahrefs · Google Sheets · Python
