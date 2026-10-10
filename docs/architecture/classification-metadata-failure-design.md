# Classification metadata failure recovery

## Evidence and scope

On 10 October 2026, read-only Unraid queries found one exhausted classification
task created by stale-decision maintenance. All five recorded attempts stopped
at metadata fetch. There was no routing classification link. The referenced
history remained pending. The original error logs were no longer retained.
A bounded read-only request from that installation returned HTTP 404 for its
stored typed TMDb identity. This proves current unavailability, not the exact
historical exception or that another similarly named movie is equivalent.

The metadata wrapper currently replaces structured provider failures with a
plain message. The queue then stores only `task_processing_failed`.

## Contract

- Preserve a sanitized typed metadata failure, not the original error/cause,
  credential-bearing URL, response body, title or request configuration.
  Persist its bounded category/status/transport/retry-after fields in the task
  failure log alongside the task reference; a generic reason alone loses context.
- Only a 404 from the details request identifies a missing catalog record.
  Certification or later enrichment failures must not assert missing identity.
- Missing details stop automatic retries on the owned queue claim. Count the
  actual failed attempt; do not fabricate budget exhaustion. Transient/unknown
  failures keep the existing bounded retry schedule and fencing.
- Never search by title and substitute an identity after an explicit-ID 404.
- Upgrade backfill only refines the reason on already-failed, unclaimed
  classification tasks at `metadata_fetch`, with no routing link and a generic
  failure code. It records the known stage, **not** an inferred historical 404.
  Update matching generic intake receipts too. Preserve status, identity,
  attempt budget, payload, timestamps, history and all remote state.
- Fresh installs have no matching rows. The migration is idempotent and has no
  network calls. PostgreSQL's transactional update rechecks predicates when
  contending with another writer. Pending, processing, cancelled, routed and
  already-specific failures are excluded.
- Command Center explains known missing records versus legacy unknown causes.
  An operator must verify/correct the originating identity before retrying.

This backfill repairs diagnostics; it cannot invent a replacement catalog ID.
No production retry, dismissal, data change or release is part of verification.

## Tradeoffs and recommendation

1. Keep typed identity and fail closed when that record is absent: prevents
   incorrect classification; requires review when a catalog removes a record.
2. Backfill only what stored evidence proves: safe across libraries/providers;
   cannot reconstruct purged exceptions or call an old failure a confirmed 404.
3. Defer identity replacement until a fresh, explicit mapping can be reviewed.
   Automatic title fallback is simpler but can select the wrong edition/work.

Next: make reviewed identity repair available from failed-task detail, including
fresh catalog evidence and replay protection. Separately fix stale-decision
maintenance's non-atomic reset/enqueue handoff and missing history lineage.

## Official sources, checked 10 October 2026

- [TMDb errors](https://developer.themoviedb.org/docs/errors): distinguish missing
  resources from authentication, throttling and upstream failures.
- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html):
  conditional updates re-evaluate changed rows under Read Committed.
- [W3C error identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification)
  and [error suggestions](https://www.w3.org/WAI/WCAG21/Understanding/error-suggestion.html):
  name the affected item, explain the problem in text and offer a known safe
  correction. These criteria address input errors; their communication principles
  inform this background-task guidance, not a claim of WCAG conformance.
