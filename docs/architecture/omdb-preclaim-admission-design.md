# OMDb pre-claim admission design

Decision and research: September 29, 2026. No release or deployment.

## Cause and decision

`enrichmentRetryProcessing` previously claimed an OMDb item, then checked local
quota. An unavailable provider therefore caused a processing claim, a fenced
pending-state write and a dependency cooldown without any useful provider work.
The existing scheduler already revisits enrichment every minute; those writes
are not necessary to keep unclaimed work discoverable after restart.

Introduce a small ESM OMDb batch planner. Read at most 50 eligible candidates,
using the worker's shared predicates. Before each ID-targeted claim, read the
current local quota evaluator through the worker's database dependency. If quota
is unavailable or the read fails, stop that batch without claiming or changing
pending items. The cached dashboard observation is never consulted.

## Invariants and recovery

- Empty/ineligible pages do not read quota or create a continuation timer.
- Candidate selection preserves source conflicts, active movie/TV libraries,
  completed metadata, retry limits, credential gates, due times and cooldowns.
- A plan never reserves quota or grants write authority. `SKIP LOCKED` claims,
  source/lease-fenced result persistence and atomic per-request reservations
  remain unchanged. A quota/configuration race after planning can still require
  one normal fenced deferral; a read cannot promise race-free admission.
- An IMDb miss can require a second title request. It must reserve separately,
  even when the first request used the last credit.
- Blocked batches rely on the existing minute scheduler and normal enqueue
  wake-ups. No new polling loop, persisted cooldown, cursor or local reset is
  added. Fresh instances re-read the queue and configuration without warm state.
- Only a fully visited page can request a one-second continuation, through the
  existing coalescing timer. Cancellation epochs prevent stale plans from
  scheduling continuations or offering more candidates.
- Existing maintenance still runs: recovering expired claims and reconciling
  completed/exhausted work must not depend on available OMDb quota. This change
  bounds the candidate plan, not all maintenance SQL; completion/exhaustion and
  legacy monthly normalization retain their existing unbounded updates.
- Waiting is reported as skipped work, not item failure. Logs contain fixed
  status codes, not credentials, media payloads or database error bodies.

## Official research

URLs were discovered with online search and opened during this work.

- [OMDb API](https://www.omdbapi.com/) describes IMDb and title lookups;
  [key registration](https://www.omdbapi.com/apikey.aspx) describes a free daily
  allowance. Neither establishes a universal upstream UTC reset guarantee.
  Retain configured local accounting; do not infer extra credits from a preview.
- [PostgreSQL consistency checks](https://www.postgresql.org/docs/18/applevel-consistency.html)
  explain that read snapshots and previously held locks are not enduring proof
  of current validity. Keep admission/reservation and write fencing authoritative.
- [PostgreSQL UPDATE](https://www.postgresql.org/docs/18/sql-update.html) discusses
  bounded work and `SKIP LOCKED` to reduce queue-consumer contention. Retain the
  existing atomic claim rather than replacing it with an unfenced SELECT/UPDATE.
- [Amazon Builders' Library: timeouts, retries and backoff](https://d1.awsstatic.com/builderslibrary/pdfs/timeouts-retries-and-backoff-with-jitter.pdf)
  warns that layered retries amplify load. Reuse the existing scheduler, not a
  second retry loop. Existing jittered request-failure scheduling is unchanged.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  supports concise, programmatically exposed status. No UI changes are needed:
  the existing pausable SWR readiness view continues to distinguish waiting from
  failure and hides stale observations. This change does not claim WCAG conformance.

## Alternatives and recommendation stack

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Bounded read-only plan before claim | Avoids known-unavailable claim/write churn; restart-safe | Extra eligibility read; races still need execution checks | Adopt |
| Merge quota reservation into queue claim | Can tightly couple two admissions | Complicates non-queue callers, two-lookup retries and crash accounting | Not needed for this fix |
| Persist a new global paused state | Reduces some repeated reads | Another invalidation/recovery mechanism; can strand repaired settings | Reject |
| Consume dashboard cache as authority | Cheap read | Stale partial observations cannot authorize claims or spend | Reject |

Stack: small Node ESM planner, existing PostgreSQL candidate predicates and
atomic reservation, existing scheduler/coalescing wake-up, unchanged Express and
Vue/SWR observers. No dependency, schema or API contract change.

## Verification plan

Unit-test bounded planning, fail-closed reads, cancellation and continuation.
Use isolated PostgreSQL fixtures to prove byte-for-byte preservation during
waits, configuration and day-reset recovery, last-credit races, a separately
charged second lookup, source/credential races, and ordinary fallback/backfill
progress. Re-run ownership, scheduling, quota and web-search regression suites.
