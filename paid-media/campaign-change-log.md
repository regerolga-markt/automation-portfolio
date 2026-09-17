# Campaign change log

Every change to campaigns and tracking gets logged: budgets, bids, creatives, negatives, GTM/GA4.

- **Three intake paths** land in one change-log sheet: a webhook, a Drive inbox of JSON files, and a data-store queue flushed daily.
- **Joined to weekly reporting**, so shifts in performance can be traced back to specific changes.

## Files

- Make.com blueprints for the three intake paths: [`webhook`](make/changelog-webhook-to-sheet.blueprint.json), [`Drive inbox`](make/changelog-drive-inbox-to-sheet.blueprint.json), [`data-store queue`](make/changelog-datastore-queue-to-sheet.blueprint.json)
- Claude skill that writes the entries: [`skills/campaign-changelog`](skills/campaign-changelog/SKILL.md)
- Related skill for ad copy: [`skills/google-ads-rsa`](skills/google-ads-rsa/SKILL.md)
