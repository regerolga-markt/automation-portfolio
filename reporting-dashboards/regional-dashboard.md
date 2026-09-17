# Regional paid-media dashboard (Apps Script)

Moved off Make.com when the operations budget became the constraint.

- **Daily time-driven trigger** pulls from the Windsor.ai REST API into one tab per region (US / Europe / LATAM).
- **Each tab has:**
  - a daily view;
  - a channel summary with WoW/MoM;
  - a spend → leads → MQL/SQL funnel, with stages from a CRM report.
- **Custom menu** recomputes derived metrics and removes excluded rows.
