# Recovery-change skill design

## Decision — 3 October 2026

Add the repository-scoped `classifarr-recovery-change` skill under `.agents/skills`.
It structures repeated retry, scheduler, provider and backfill work around safety
invariants and failure-point tests. It is an engineering aid, not a runtime AI
service, daemon, deployment script, or grant of recovery authority.

## Why this skill

| Option | Benefit | Cost |
| --- | --- | --- |
| Focused repository skill (selected) | Versioned, discoverable, tailored to recurring recovery bugs | Requires instruction maintenance |
| Add all guidance to AGENTS.md | Always available | Adds context to unrelated work |
| Broad autonomous repair skill | Flexible | Ambiguous authority and unsafe live-repair assumptions |

Recommendation stack: narrow trigger; evidence-first diagnosis; explicit recovery
contract; existing deterministic tools; real HTTP/PostgreSQL tests; concise,
auditable handoff. No new executable automation is needed because the repository
already has test, migration, schema, and compatibility runners.

## Sources and evaluation

The [official skill guide](https://learn.chatgpt.com/docs/build-skills), retrieved
3 October 2026, documents repository discovery in `.agents/skills`, progressive
loading and optional UI metadata. The [customization guide](https://learn.chatgpt.com/docs/customization/overview)
supports reusable task-specific workflows instead of growing always-on guidance.

Validate the skill's metadata and review scenarios for correct selection and
boundaries: provider outage, unknown legacy ownership, disabled AI service,
unrelated visual edit, user-requested diagnosis only, and a requested commit with
no release. Document actual results separately; do not claim measured agent
reliability from a static review.
