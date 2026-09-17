# Regional paid-media dashboard (Apps Script)

Moved off Make.com when the operations budget became the constraint.

- **Daily time-driven trigger** pulls from the Windsor.ai REST API into one tab per region (US / Europe / LATAM).
- **Each tab has:**
  - a daily view;
  - a channel summary with WoW/MoM;
  - a spend → leads → MQL/SQL funnel, with stages from a CRM report.
- **Custom menu** recomputes derived metrics and removes excluded rows.

**Code:** a clean, tested template of this pattern, written from scratch, is in [`regional-dashboard-template/`](regional-dashboard-template/).

## Earlier Make.com versions

- [`ads-dashboard-google-meta-daily-email`](make/ads-dashboard-google-meta-daily-email.blueprint.json)
- [`ads-dashboard-summary-en-latam-weekly-email`](make/ads-dashboard-summary-en-latam-weekly-email.blueprint.json)
- [`all-platforms-campaign-snapshot`](make/all-platforms-campaign-snapshot.blueprint.json)
