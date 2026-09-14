# Description failure isolation design

Date: 2026-09-13. Scope: local inventory-description backfill.

## Root cause and recommendation

The worker always starts with the first missing description. A rejected batch
therefore remains at the front and prevents later healthy descriptions from being
processed. Existing validated cache checkpoints solve duplicate work, but cannot
remember which missing descriptions need an individual retry.

Add a bounded PostgreSQL retry journal keyed by the existing model representation
and description hash. Do not store titles, descriptions, library membership,
provider endpoints, credentials or rejected vectors. A failed batch identifies
suspects, not proven bad items. Retry its members individually on a later pass.
Only individual rejected requests increment an item's failure-attempt count.

## Processing contract

1. Read current inventory and the current installed embedding representation.
2. Skip existing valid cache checkpoints; clear their obsolete retry records.
3. Interleave fresh batches and due individual retries within eight embedding
   requests per pass. Reserve two request opportunities for retries when both
   categories have work; use spare opportunities for whichever category remains.
4. Only embedding-stage request rejection, cardinality and vector validation
   failures qualify for isolation. Outages, authentication, model drift, malformed
   JSON, storage errors and cancellation do not identify a bad description.
5. Defer suspect batches without writing any of their vectors. Validate individual
   retries and recheck model identity/admission before journaling a failure or
   committing a cache entry. Model drift behind a malformed response is global,
   not an individual-input diagnosis.
6. Two consecutive isolatable failures stop the pass through the existing global
   cooldown as a conservative provider-wide failure precaution. The journal still
   advances the work list so the same front batch cannot monopolize later passes.
7. Individually rejected descriptions receive exponential, jittered delays up to
   one hour. Retry them automatically; never permanently discard their source
   records or require acknowledgement to continue healthy work.
8. Persist attempt counts and due times across restarts. Changed text/model identity
   uses a new key. Expire retry state after 30 days without another failure, prune
   in bounded chunks, and cap journal admission at 20,000 rows under the worker's
   existing cross-process advisory lock.

A deferred description remains missing evidence, never a completed embedding or a
positive training label. No live-routing changes or new UI controls. Movie/TV
inventory eligibility is unchanged; scheduling itself has no library/genre rules.
The current representative-profile publisher still requires all eligible vectors;
this slice unblocks healthy cache backfill, not partial profile publication. See
the separate [outcome and next component](description-isolation-outcome.md).

## Alternatives and final stack

| Option | Benefit | Cost | Decision |
| --- | --- | --- | --- |
| Keep retrying the whole first batch | Minimal state | Healthy work starves | Reject |
| Recursively split batches immediately | Fast isolation | Extra inference bursts during outages | Reject |
| Remember suspects only in memory | Simple | Restarts lose isolation and retry timing | Reject |
| Durable journal plus bounded individual retries | Fair progress, restart-safe recovery | Small migration and more requests for suspect batches | Adopt |

Final stack: strict adapter validation, PostgreSQL cache checkpoints and retry
journal, deterministic fair planning, existing scheduler/global backoff, and
redacted deduplicated diagnostics. Keep the existing ES Module architecture and
SWR UI. A future concise status projection should use the existing disclosure,
not a new control panel.

## Official research, September 2026

These sources were discovered through search and opened using tools. The design
applies their principles; it does not introduce Azure or AWS infrastructure.

- [Microsoft background-job guidance](https://learn.microsoft.com/en-us/azure/architecture/best-practices/background-jobs) explains how repeatedly failing messages block
  later work. Isolate suspects and retain successful checkpoints.
- [AWS partial-batch guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/lambda-event-filtering-partial-batch-responses-for-sqs/introduction.html) describes
  repeated whole-batch processing caused by poison items. Ollama lacks per-item
  failure attribution, so do not pretend a rejected batch identifies one culprit.
- [Microsoft retry-storm guidance](https://learn.microsoft.com/en-us/azure/architecture/antipatterns/retry-storm/) supports bounded attempts, delay and circuit breaking.
  Isolation shares the existing request budget rather than adding an inner loop.
- [Ollama embedding contract](https://docs.ollama.com/api/embed) specifies model and
  vector-array responses. Keep `truncate: false` and strict representation checks.
- [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) supports useful validation events without sensitive payloads.
  Journal fingerprints remain private and are not emitted in logs.
- [W3C status-message guidance](https://www.w3.org/WAI/WCAG22/Techniques/failures/F103.html) requires programmatically identifiable dynamic status. No UI is added in
  this slice; retain existing accessible, quiet refresh behavior. This is not a
  WCAG certification claim.

## Verification and rollback

Test mixed healthy/failing movie and TV descriptions, suspect batches, individual
success/failure, fairness, outage/global cooldown, all-bad responses, capacity,
retention, cancellation, model drift, real SQL checkpoints and process recreation.
Exercise the idempotent migration on fresh and existing schemas. Generate/check
the canonical schema snapshot using the repository scripts, not a live-data dump.
Rollback may leave the additive retry table in place; old code ignores it. No
existing inventory, policy, configuration or cache row is rewritten by migration.
