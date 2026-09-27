# Provider identity recovery: diagnosis and follow-up

## Observed issue

The supplied movie TMDb observation warning reported HTTP 404 for identity
491851. Read-only checks on 2026-09-27 confirmed that the movie details request
still returned 404. A separate lookup using the item's existing external ID
returned no movie or TV result. No replacement identity is established. Deletion,
merging, an incorrect source match, or a provider indexing problem remain possible
causes, not verified explanations.

The current queue records an observation attempt and allows another attempt after
six hours. General enrichment can be complete while this specific observation is
unavailable. `QueueInventoryTmdbEnrichmentService` logs the typed failure;
`inventoryTmdbObservation` controls retry/cache age; persistence keeps source
identity guards. The current path does not durably retain the failure category
and resolution state as a provider-identity recovery case. Retrying an unchanged
absent identity alone is not a repair.

No item identities, routing rules, retry budgets, or live data were changed during
this diagnosis. Private titles, payloads and credentials are deliberately omitted.

## Official guidance

Research checked 2026-09-27:

- [TMDb errors](https://developer.themoviedb.org/docs/errors) distinguishes missing
  resources from server failures. A 404 is not evidence for a replacement ID.
- [TMDb finding data](https://developer.themoviedb.org/docs/finding-data) provides
  external-ID lookup separately from text search. A title search can suggest
  candidates but cannot by itself justify an automatic identity change.
- [AWS retry/backoff](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/retry-backoff.html)
  recommends idempotent operations and distinguishes transient failures from
  failures for which repeated retries will not help.

## Recommended next component

Extend the existing recovery records and scheduler with a **durable, typed
recovery-case policy**, not a second competing orchestrator. First inventory the
existing source-recovery records and retention rules before selecting a migration.

Each case should bind the source item, media type, provider identity, source
revision and failure category. Retain bounded first/last-seen times, attempt count,
last evidence, next eligible check, and resolution status. Deduplicate by that
identity/revision; never store entire provider responses or tokens. Show a short
item-level explanation and the next action. Preserve configured log retention;
recovery state and logs have separate lifetimes.

Transient timeouts/5xx/429 should use bounded backoff with jitter and applicable
retry hints. Missing identities should trigger budgeted source/external-ID
revalidation, slower periodic rechecks, and earlier reconsideration when source
evidence changes. Credentials/configuration failures should wait for relevant
configuration changes. Resource-budget failures should identify the exceeded
stage/limit and wait for a supported change, not shrink the experiment silently.

Only an unambiguous, type-consistent, independently verified identity can qualify
for guarded correction. A source-revision compare-and-set must prevent stale
repair. Persist the repair and downstream backfill intent atomically; make replay
idempotent and resumable after restart. Keep conflicting or missing evidence
unresolved and visible, with safe periodic rechecks. Evaluate the repaired
metadata before making it authoritative for learning; this does not authorize
routing or music ingestion.

## Alternatives and recommendation stack

| Option | Benefit | Cost / risk |
| --- | --- | --- |
| Retry every warning | Simple, helps temporary outages | Repeats permanent failures; weak diagnosis |
| Guess replacement from title | Low operator involvement | Can corrupt identity and downstream learning; reject |
| Typed durable cases on existing scheduler | Resumable, deduplicated, evidence-bound recovery | Requires a state contract, retention and fault-injection tests |
| New workflow platform | Rich orchestration tooling | Additional service and migration burden; not justified by these incidents yet |

Recommendation: existing PostgreSQL records/transactions + modular ESM recovery
policy + existing scheduler/admission controls + source-revision guards + bounded
repair/backfill receipts. The [first implementation](inventory-provider-recovery-design.md)
adds durable observation cases, leased attempts and atomic same-identity backfill.
External-ID replacement discovery remains follow-up, not implemented by that
increment. Its acceptance must cover provider return, absent matches, disagreement,
duplicate delivery, interruption after repair, stale evidence, and retry limits.
