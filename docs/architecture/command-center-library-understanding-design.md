# Command Center library understanding: design

Status: implemented in Unreleased, 2026-09-24. This document records the decision; the separate outcome document records verification.

## Problem and evidence boundary

The previous Command Center led with a library-purpose declaration count and process-local evaluation attempts. A missing declaration is not proof that a library is misunderstood or that a person must supply ten rules. An attempt count resets on restart and is not item coverage or classification accuracy. These cards displaced the live queue and action panels, even though Classifarr is intended to learn library contents organically.

The existing `library.upgrade_readiness.v1` snapshot already provides validated, all-library profile states, overdue recovery, worker health, and source-identity issues. It is administrator-only, rate-limited, no-store, count-only, and fetched on a visibility-aware five-minute cadence. The profile states are useful operational evidence, but *current* means revision-current, not semantically accurate.

## Alternatives

| Option | Advantage | Cost / risk |
| --- | --- | --- |
| Keep the two top-level cards and improve their wording | Minimal change | Still implies declarations and restarted counters are the main learning measure; remains dense. |
| Add a new endpoint querying descriptions, embeddings, policies, and outcomes at each refresh | Could show broader coverage | New expensive query, privacy and consistency surface, and no validated quality denominator yet. |
| Project the existing readiness aggregate into a compact view | One existing query, bounded data, explicit recovery and provenance | Profile freshness is only one dimension of understanding; quality must stay unmeasured. |

Recommendation: use the third option now. Keep policy/evaluation diagnostics in a closed, keyboard-operable disclosure; do not promote policy declarations into a learning mandate. Evolve the projection only after a separately validated description/retrieval coverage and held-out outcome contract exists.

## Contract and interaction

The server adds an additive `understanding` projection to the current upgrade-readiness response. It groups queued/processing/retry/waiting as *updating*, but reports automatic cooldown, unverified, paused, and no-inventory separately. Only overdue recovery and unresolved source identities produce a visible review message. A worker is called stalled only when recovery is overdue and its durable worker-health status indicates a problem. The projection marks classification quality `not_measured`; the client validates it against the parent aggregate and strips unexpected fields.

The new card leads with current and updating profile counts, then concrete issues with links to library status or media-ID review. The coverage disclosure explains that source-ID counts cover only recent complete full captures. Missing or invalid data is unavailable, not a healthy zero. This is read-only: no AI request, backfill, setting, or routing mutation.

The detail disclosure uses a native `<details>/<summary>` control, which the [HTML Standard](https://html.spec.whatwg.org/multipage/interactive-elements.html) defines as a disclosure widget; it follows the interaction goal in the [W3C disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/). The summary has a pause/resume control and a polite status message; losing authorization or invalid data clears even a paused snapshot. [W3C status-message guidance](https://www.w3.org/WAI/WCAG21/Understanding/status-messages) and [W3C pause/stop/hide guidance](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide) inform the restrained updates and user-controlled display. [GOV.UK notification-banner guidance](https://design-system.service.gov.uk/components/notification-banner/) supports sparing, actionable alerts; [GOV.UK question-page guidance](https://design-system.service.gov.uk/patterns/question-pages/) supports requesting only information genuinely needed from the operator. These are design inferences, not claims that the sources specify Classifarr's domain logic.

## Security and rollout

Reuse the existing administrator guard, query rejection, rate limit, and no-store response. Return no names, media titles, raw metadata, provider IDs, or embeddings in the aggregate. Reject inconsistent counts, and do not infer a positive quality result from missing evidence. Existing clients can ignore the additive field; new clients show an unavailable state when it is absent or invalid. No schema, migration, background-job, routing, or release change is required.

## Next component

Define a durable, privacy-bounded **description and retrieval coverage** projection per library, with an explicit eligible-item denominator, freshness revision, missing-reason categories, and no accuracy claim. Then connect it to held-out correction outcomes before considering automatic-routing confidence. That is the missing evidence behind a genuinely library-agnostic understanding score.
