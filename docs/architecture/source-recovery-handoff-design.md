# Source recovery handoff design

## Decision

Exercise the existing recovery → inventory enrichment → profile-refresh chain as
one isolated PostgreSQL integration canary. Do not introduce another orchestrator
or relax identity checks to make the chain pass.

The preceding change (`485d40db`) made recovery selection fair across pages while
retaining eight fresh attempts per sync and a daily cooldown. This follow-up
checks what happens **after** a repair: durable backfill, interruption recovery,
and profile publication for both movies and TV.

## Boundaries and acceptance criteria

| Boundary | Required evidence |
| --- | --- |
| Provider unavailable | Retained unresolved observations, no invented inventory or enrichment |
| Provider returns | Fresh matching source evidence permits repair; changed evidence remains unresolved |
| Repair committed before refill | A newly constructed refill service discovers the durable inventory gap |
| Task queued before processing | A newly constructed queue claims the existing task without another enqueue |
| Enrichment committed before acknowledgement | Redelivery completes without another provider observation or duplicate history |
| Profile refresh fails | Durable retry retains the pending revision; a later worker publishes and acknowledges it |
| Profile published before acknowledgement | Existing outbox row retries; status does not claim currency until the revision is acknowledged |
| Equal movie/TV numeric IDs | Separate libraries, metadata observations and typed source-library history remain distinct |
| Repeated sync | Reused proof preserves observations and does not create unnecessary enrichment or profile work |
| Unsupported content | Music does not enter metadata enrichment or generate classification tasks |

Use real recovery persistence, queue admission/claim/completion, metadata
persistence, source-library history, inventory revision tracking, profile
planning and outbox consumption. Stub external provider responses, optional
OMDb/web-search enrichment and the unrelated skip-report/link formatter; inject
a deterministic no-analysis source analyzer. Never start the background scheduler
or AI worker loop. Assert that
the classification dependency is unused and that only observational history is
written. Synthetic content and fixture credentials stay in the disposable test
database; production volumes and media servers are not involved.

Service reconstruction and fixture-only expiry of database retry/visibility
deadlines test durable resumption without waiting hours. They do not constitute
an operating-system or PostgreSQL restart test; that separate restart check
already exists in `mediaSyncRecoveryFairness.test.mjs`.

## Alternatives and recommendation stack

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Reuse the durable queue and profile outbox | One set of ownership, cooldown and retry rules; realistic regression evidence | Canary requires Docker/PostgreSQL | First: implement this canary |
| Add a second repair orchestrator | One apparent entry point | Duplicate scheduling and competing ownership; additional failure states | Do not add without a demonstrated gap |
| Enrich and refresh synchronously during repair | Immediate result | Couples sync latency to downstream work and makes retries expensive | Keep the asynchronous handoff |

Second, fix only failures demonstrated by the canary. Third, use the existing
quality coverage audit and independent-review workflow for a measured movie/TV
baseline after a separately authorized release. Do not add another recovery
mechanism or status panel merely because the correctness canary passes. Freshness
must not be presented as placement accuracy.

## Official research — checked September 2026

URLs were discovered through web search and opened before use.

- [AWS transactional outbox guidance](https://docs.aws.amazon.com/en_en/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html)
  describes the dual-write failure and the need for idempotent consumers when
  delivery repeats. Apply that principle to the existing profile outbox and test
  committed work followed by interrupted acknowledgement; no AWS dependency is
  being introduced.
- [PostgreSQL 18 explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html)
  documents row-lock lifetime and deadlock risks. Retain short guarded database
  transactions and keep provider requests outside their locks; test durable
  claims and compare the published/acknowledged inventory revisions.
- [W3C status-message guidance](https://www.w3.org/WAI/WCAG21/Understanding/status-messages)
  calls for programmatically available status without moving focus and warns
  against overly chatty announcements. This backend change adds no UI; a future
  compact progress display should preserve existing pause controls, visible
  labels and accessible status semantics instead of announcing every retry.

## Scope limits

This canary is synthetic correctness evidence, not measured production recovery
rate, content accuracy, AI evaluation, or a guarantee about arbitrary provider
responses. It does not change routing, retry budgets, music support, database
schema, application versions or release state. Findings and actual validation
results belong in [the separate outcome document](source-recovery-handoff-outcome.md).
