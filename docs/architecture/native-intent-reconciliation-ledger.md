# Native Intent Reconciliation Ledger

## Status

Implemented as Phase 8R.3.2.2. The ledger adds durable, bounded evidence for
automatic native-intent conversion. Phase 8R.3.2.3 now adds separate current
retry and quarantine state; the later circuit breaker and read-only status
interface remain out of scope here.

## Problem

The scheduler can safely start a reconciliation opportunity, but its compact
runtime result alone cannot distinguish a committed conversion from a deferred
candidate after a restart. Treating an empty scan, a lost scheduler lock, or a
temporarily blocked candidate as completed would make later compatibility
cleanup unsafe.

The ledger must add that support evidence without becoming another copy of
legacy policy data. It must also remain safe to back up, restore, and prune.

## Official-Source Research

- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
  explains that concurrent writes are re-evaluated at the transaction boundary.
  A ledger entry must therefore be written only after the conversion transaction
  has committed, never as an early claim that it will commit.
- [PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)
  supports named `CHECK`, foreign-key, and uniqueness constraints for row-level
  invariants. The schema constrains state IDs, counts, fingerprints, timestamps,
  and one outcome per policy per run.
- [PostgreSQL partial indexes](https://www.postgresql.org/docs/current/indexes-partial.html)
  reinforces that indexes should support the concrete operational predicate.
  The ledger uses compact ordered indexes for per-policy lookup and bounded
  retention rather than a broad payload index.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends recording bounded event context while excluding secrets,
  credentials, sensitive business data, and unneeded payloads. The ledger
  stores only references, stable IDs, timestamps, counts, and a SHA-256 digest.

## Options Considered

### Reuse Migration Events Alone

Pros:

- No new tables.
- Existing conversion audit remains authoritative for successful writes.

Cons:

- Cannot represent a non-writing current-state blocker or an exhausted batch.
- Cannot distinguish a scheduler attempt from a per-policy conversion event.
- Would overload migration-event retention with retry-support concerns.

### Persist Full Candidate Or Legacy Payloads

Pros:

- Rich support detail without another lookup.

Cons:

- Duplicates sensitive legacy policy data and violates storage-cutover goals.
- Creates stale authority after the policy changes.
- Expands backup, restore, and retention risk considerably.

### Recommended: Bounded Two-Table Ledger

Pros:

- Records an explicit run header plus one safe outcome per evaluated policy.
- Separates a committed apply from a deferred or blocked evaluation.
- Supports current-fingerprint checks, bounded retention, backup, and restore.
- Leaves native policy storage and migration events authoritative.

Cons:

- Adds a small post-commit transaction and a daily retention task.
- Requires the later retry component to interpret deferred outcomes.

## Implemented Design

### Data Contract

`policy_native_intent_reconciliation_runs` stores one run UUID, reconciler
version, state, stable source/reason IDs, start/finish timestamps, and compact
outcome counts. `policy_native_intent_reconciliation_outcomes` stores the run
reference, policy reference, candidate status, outcome state, stable reason,
optional retry-not-before timestamp, and a SHA-256 candidate fingerprint.

The schema rejects invalid state IDs, fingerprints, timestamps, mismatched
header counts, duplicate run keys, duplicate policy outcomes within a run, and
a retry time before evaluation. It has no JSON, prompt, provider-response,
trace, `customSignals`, or legacy-policy-payload column.

### Commit Boundary

The existing apply gate owns authority locks and conversion writes. Only after
it returns from that transaction does the reconciliation service open a
separate atomic transaction to write the ledger header and all outcomes.

If that second transaction fails, the conversion remains correctly reported as
committed and the response exposes only `ledger_write_failed`. The later
scheduled evaluation can reconstruct current evidence; the service never
rewrites a committed conversion as failed.

### Outcome Semantics

- `applied` and `already_native` represent committed native authority results.
- `deferred_retry` represents a ready candidate left unprocessed by the bounded
  execution budget or an incomplete apply result.
- `blocked_current_state` represents a non-writing candidate that is not safe
  to convert now.
- `requires_maintenance` represents a policy whose current legacy shape or
  repeated technical failure has no safe automatic resolution.
- `system_failure` represents a rolled-back conversion attempt.

An empty candidate evaluation receives run state `evaluated` and reason
`no_candidates`; it is not a durable completion marker. Scheduler lock
contention never invokes the service and therefore creates no ledger row.
`retry_not_before` remains historical outcome evidence in this component. The
current retry and quarantine decision now lives in the separate
[Native Intent Reconciliation Eligibility](native-intent-reconciliation-eligibility.md)
control-plane contract, bound to the current candidate fingerprint.

### Retention And Restore

Per-policy outcomes are pruned in transactionally locked batches after 30
days. Outcome-less run headers are retained for 90 days and then pruned in
bounded batches. This preserves a minimal support trail while preventing
unbounded event growth.

Backup includes both tables. Restore clears them before native intent rows,
restores run identity by UUID, maps old run and policy IDs to restored IDs, and
never treats imported in-progress work as active. A later reconciliation always
re-evaluates current policy state and fingerprint.

## Security And Failure Handling

| Risk | Control |
| --- | --- |
| Ledger claims work before conversion commits | Write the ledger only after the apply gate returns from its conversion transaction. |
| Ledger write itself fails | Keep the committed conversion result; report a sanitized ledger failure and rebuild evidence later. |
| Clock skew or malformed timing violates a database constraint | Clamp finish time to no earlier than start time before persistence. |
| Payload, secrets, or prompts enter support evidence | Use a fixed contract, parameterized SQL, safe IDs, references, counts, and SHA-256 fingerprints only. |
| Two replicas create duplicate evidence | Scheduler lock prevents a second reconciliation invocation; unique run and per-run-policy constraints backstop persistence. |
| Retention races another cleanup task | A dedicated transaction advisory lock and bounded deletion batches serialize cleanup. |
| Restore fabricates a completed conversion | Restore only imports historic evidence; normal reconciliation rechecks live eligibility and authority. |

## Verification

- Unit tests cover deterministic payload-independent fingerprints, applied,
  already-native, blocked, deferred, and timing-normalization outcomes.
- Ledger persistence tests verify a single transaction writes a header and only
  allowed outcome fields.
- Reconciliation tests verify a ledger failure or malformed ledger response
  cannot relabel a committed conversion as failed.
- Backup/restore, scheduler-retention, migration, and schema-snapshot tests
  cover lifecycle wiring.
- `database/schema/current.sql` is regenerated from a fresh
  `classifarr:test` container after all migrations apply.

## Result

Classifarr can explain whether an automatic reconciliation evaluation applied,
deferred, blocked, requires maintenance, or rolled back a candidate without
retaining raw legacy policy data. Retry, quarantine, and lifecycle guards are
implemented separately, leaving the ledger as bounded support evidence rather
than policy or scheduling authority.
