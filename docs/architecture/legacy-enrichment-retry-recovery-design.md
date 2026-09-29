# Reviewed legacy enrichment retry recovery

Date: 2026-09-29. Status: implemented; see the separate outcome document for
validation evidence. No release or live recovery.

## Problem and decision

New enrichment retries have expiring worker claims. Older `processing` rows can
have neither claim field. Their age cannot establish that an old process stopped.
Leaving them untouched is safe but prevents backfill indefinitely.

Add an administrator-only review in Library details. Read at most 50 supported
movie/TV retry records per library, with titles, provider and attempt counts. The
operator must stop old Classifarr instances and external writers and confirm they
will remain stopped. This is an attestation, not automated proof of shutdown.
Plex, Jellyfin and Emby use the same local-data workflow; music is excluded.

## Contract and boundaries

- Preview is read-only, no-store and fetched on demand through non-persistent SWR.
- A strong revision binds the actor, library and exact row/source versions.
  Confirmation locks and rereads those records; changed state requires new review.
  It does not silently include another batch. Reviews remain valid only while the
  bound state is unchanged; elapsed time never grants authority.
- Only `processing` rows with both claim fields absent are recoverable. Current,
  expired or partially populated claims are not overwritten by this path. Invalid
  or missing attempt budgets are also excluded rather than interpreted as approval.
- Recovery preserves metadata, attempts, priority, reason and quota timestamps.
  Remaining-budget records return to `pending`; exhausted records become `failed`.
  Normal claim, source-identity, library and provider admission checks still apply.
  Disabled libraries remain disabled; archived libraries cannot be recovered here.
- Row changes, derived item state and a content-free audit receipt commit together
  on one database client. Lock, statement and transaction deadlines bound work.
  No provider request or scheduler notification runs inside the transaction.
- UUID request IDs identify confirmations. A unique receipt index prevents double
  application; same-request retries return the existing actor/library-bound receipt.
  A missing receipt is not proof of failure after a lost response. The UI retains
  the request in memory and offers outcome lookup and same-request retry.
- This is not an ownership backfill: no fictional owner is assigned. New workers
  acquire real claims after the administrator has reconciled the legacy records.
- The existing scheduler is nudged after commit, best-effort. Its durable queue and
  regular schedule remain the recovery fallback. No new recurring process is added.

## Recommendations and tradeoffs

| Option | Benefit | Cost or risk | Decision |
| --- | --- | --- | --- |
| Age-based automatic takeover | No operator step | Cannot fence old binaries; concurrent writes possible | Reject |
| Leave unknown rows forever | No takeover risk | Backfill remains blocked | Replace with reviewed recovery |
| Exact-batch administrator review | Recoverable, auditable, bounded | Requires truthful stopped-writer confirmation | Implement |
| New workflow engine | Broader orchestration | Extra runtime and migration complexity | Not needed for this fix |

Recommended stack: existing Vue 3/SWR and native controls; small Node ESM contract,
repository and service modules; PostgreSQL transactions and audit receipts; Jest,
real-PostgreSQL integration tests and Vitest. No new runtime dependency.

## Official research

Sources discovered through online search and read on 2026-09-29:

- [PostgreSQL 18 explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html):
  row locks prevent conflicting writes until the transaction ends; use consistent
  lock ordering and bounded waits. Our inference: recheck the reviewed snapshot
  under locks, rather than trusting an earlier UI read.
- [node-postgres transactions](https://node-postgres.com/features/transactions):
  all transactional statements must use the same client. This includes the receipt
  and derived item state, not just the queue update.
- [RFC 9110 HTTP semantics](https://www.rfc-editor.org/rfc/rfc9110.html):
  strong `If-Match` comparisons support conditional mutations and avoid lost
  updates. This endpoint deliberately requires one exact review revision; a
  wildcard or list cannot substitute for review of the displayed batch.
- [W3C form notifications](https://www.w3.org/WAI/tutorials/forms/notifications/)
  and [status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages):
  give concise corrective feedback and programmatically identifiable outcomes.
  Use a labeled checkbox, native buttons, a table with headers, alerts for failures
  and a status region for the receipt. This is not a whole-product WCAG claim.

## Acceptance and next boundary

Test concurrent confirmations, source/claim changes, rollback, revoked access,
lost replies, batching, exhausted budgets, fresh data and legacy rows. Demonstrate
that normal claimed processing can finish a recovered movie/TV retry. Do not
perform the stopped-writer attestation or mutate live recovery data during testing.

Follow-up: consolidate provider-aware retry scheduling around durable due times.
Today the independent retry service uses a coalesced five-second wake-up and the
scheduler's six-hour fallback. Preserve those safeguards while adding restart-safe
due times, bounded backoff/jitter for transient failures, and wake-ups when relevant
configuration or quota availability changes. Keep unknown ownership, invalid
claims and exhausted budgets distinct from transient failures. The acceptance
target is timely automatic progress without duplicate provider calls or retry
storms, including a restart between recovery commit and wake-up.

This recommendation follows [AWS guidance on controlling retries](https://docs.aws.amazon.com/wellarchitected/latest/framework/rel_mitigate_interaction_failure_limit_retries.html),
discovered and read on 2026-09-29: distinguish retryable failures, cap retries, and
avoid compounding retries at multiple layers. No new retry scheduler is introduced
in this change.
