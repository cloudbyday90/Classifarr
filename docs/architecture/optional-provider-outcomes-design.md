# Optional-provider durable outcomes — design

Date: 2026-09-30. Follow-up to [metadata refill retry control](metadata-refill-retry-control-design.md).

## Findings

Real PostgreSQL regression tests reproduced three unrecorded OMDb outcomes:
the process-local quota latch, active settings without a key, and rejected
provider media types. Each could finish local work without handing off optional
enrichment, leaving the refill controller to rediscover the missing metadata.
The new recovery test also proved that the retry path accepted a series result
for a movie even though initial enrichment rejected it.

## Decision and boundaries

Reuse the existing durable retry queue, request admission and bounded claim
transactions. Do not introduce another scheduler, per-item timer, singleton,
schema migration or provider client. All implementation remains ESM.

| Situation | Durable outcome | Recovery |
| --- | --- | --- |
| No active OMDb configuration | Configuration remains authoritative; no new retry | Saving active usable settings makes analyzed legacy items eligible |
| Active configuration without a usable key during the initial pass | One pending OMDb row, fixed missing-credential reason | Existing planner waits before claim; repaired settings permit the same row to run |
| Analyzed legacy item with no retry and no key | No repeated standard refill | Refill checks the selected active configuration's key |
| Daily quota unavailable | Pending OMDb recovery, not a web-search fallback merely because of quota | Existing local quota/reset and request admission govern recovery |
| Result has missing, conflicting or wrong movie/series type | No metadata/rating acceptance; durable web-search fallback | Existing provider availability and retry budget apply |
| Retry receives a type mismatch | OMDb skipped and fallback queued in one fenced transaction | No repeated OMDb type-mismatch attempts; fallback can wait for configuration |

The legacy `omdbLimitHit` field remains a warning-suppression latch, not execution
authority. Every item's provider call still passes through the existing database
quota/pacing admission. Restart, a daily reset or corrected settings cannot leave
it silently blocked by a stale process flag. Quota waits do not consume item
attempts when the planner withholds the claim.

Initial missing-key handling distinguishes absent/disabled configuration from
an active incomplete configuration. Disabled providers receive no new retry
from this path. An existing pending row remains retained when the provider is
disabled, but provider planning prevents HTTP and attempt consumption. A usable
key in refill is only an eligibility hint, not evidence that credentials work;
the existing rejection and admission checks remain authoritative.

The selected active row is ordered by ID, matching the configuration reader.
Local first-pass analysis, independent TMDb observation, music exclusion, source
conflict checks, queue settlement and ingestion handoff remain unchanged.
The provider type validator is shared by initial and retry enrichment. Mismatch
reasons are fixed text and never contain upstream bodies or credentials.

## Transaction and operational limits

- Task-owned writes still use the existing queue claim guard. Failure to persist
  a handoff prevents successful task acknowledgement; it is not a provider miss.
- Retry fallback creation, OMDb skip, source checks and item state share the
  existing fenced transaction. Rollback leaves neither a partial fallback nor
  accepted mismatched metadata.
- The fallback path retains existing attempt accounting, including its terminal
  skip convention. No retry budget, lease, timestamp or historical row is reset.
- Eligibility checks are snapshots, not exactly-once HTTP leases. A provider
  configuration can change after selection; request admission remains necessary.
- UTC daily reset is the application's existing local-budget model, not a newly
  established OMDb reset guarantee. Explicit upstream quota rejection remains
  governed by the existing retry deferral policy; no quota is bypassed.
- This does not sweep historical metadata to remove previously accepted wrong
  types, auto-enable providers, run AI, change routing or alter live resource caps.
- Retention and explicit reconciliation remain unchanged. Terminal records only
  suppress refill while retained. Optional advisory/holiday/anime search coverage
  is not redefined by this focused OMDb handoff change.

## Options, pros and cons

| Option | Benefit | Cost or risk | Recommendation |
| --- | --- | --- | --- |
| Keep process-local early returns | Few writes | Loses per-item progress; stale flags block recovery | Reject |
| Mark optional enrichment successful without evidence | Stops refill | False success and no recoverable work | Reject |
| Add a separate outcome table and worker | Rich independent lifecycle | Duplicates existing claims, availability gates and recovery | Not justified here |
| Reuse durable retry outcomes and shared type validation | Restart-safe, bounded, existing observability and recovery | Pending items may wait indefinitely for operator configuration; terminal decisions need explicit reconciliation | Adopt |

## Official research

Sources discovered through online search and retrieved on 30 September 2026:

- [AWS retry-with-backoff guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/retry-backoff.html)
  distinguishes transient errors from fail-fast cases and emphasizes idempotency
  and bounded retries. Applied by keeping one retry controller, waiting before
  claims when unavailable, and not repeatedly accepting or retrying a known type
  mismatch. No AWS service dependency is introduced.
- [OMDb API documentation](https://www.omdbapi.com/)
  distinguishes movie, series and episode result types. Application policy maps
  series to TV and refuses episode/missing/conflicting types here. The documented
  request type is not treated as proof that a returned object matches the item.
  Existing HTTPS, response-size and redirect safeguards remain unchanged.
- [W3C WCAG 2.2 status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  calls for status changes to be available to assistive technology without moving
  focus. Preserve truthful waiting/fallback/completed distinctions for existing
  status reporting. No new UI, live-region behavior or conformance claim is made.

## Recommendation stack

1. Persist the missing handoffs, validate type evidence on both paths and prove
   reset/configuration recovery plus transactional failures in PostgreSQL.
2. Run the existing isolated resource study with a bounded provider-fault adapter:
   quota exhaustion, transient errors, mismatched results and recovery. Count
   unique completed items, HTTP attempts and waiting items separately. Establish
   queue settlement and peak CPU/RSS before proposing resource-cap changes.
3. Present a short provider-wait reason and one next action in the existing
   diagnostics, with accessible status announcements if those views are changed.

See the separate [outcome document](optional-provider-outcomes-outcome.md) for
validation and delivery evidence.
