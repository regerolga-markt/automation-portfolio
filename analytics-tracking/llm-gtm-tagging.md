# LLM-assisted GTM tagging

A webhook-triggered Make.com flow in which an LLM turned a tracking request into Google Tag Manager API calls: tags, triggers and variables (for example form-ID variables).

It was built while setting up conversion tracking from zero, so each new tracking need became a request rather than a manual container edit.

## Files

- [`claude-to-gtm-auto-tagger`](make/claude-to-gtm-auto-tagger.blueprint.json): webhook with a plain-English request → Claude API → GTM API creates triggers, variables and tags
- [`gtm-trigger-and-ga4-tag-builder`](make/gtm-trigger-and-ga4-tag-builder.blueprint.json): thank-you page trigger plus GA4 `generate_lead` tag
- [`gtm-create-url-query-variable`](make/gtm-create-url-query-variable.blueprint.json): URL query variable for a form ID
- Claude skill for end-to-end tracking QA: [`skills/tracking-qa`](skills/tracking-qa/SKILL.md)
