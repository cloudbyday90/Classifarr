# Policy Profile Refresh Worker Consumer

## Decision

Phase 6R.3.3e.5 consumes the committed profile-refresh outbox with a bounded,
server-owned worker. It does not alter evidence authorization, policy intent,
or the request transaction.

The worker claims a small ordered batch in a short database transaction, calls
the existing `LibraryProfileService.generateProfile(libraryId)` after that
transaction commits, then conditionally completes or retries each record. A
record can be in `pending`, `processing`, `completed`, or `failed` state.

Each claim carries a server-generated UUID lease token. Completion and failure
updates require both that token and the `processing` state, so a stalled worker
cannot overwrite a later worker that reclaimed an expired lease. The worker
allows three attempts, retrying after one minute and five minutes; an expired
third lease and a third execution failure end in a bounded `failed` state.

An empty library is a terminal successful refresh: the existing generator
returns `null` for that condition, and retrying cannot make it more complete.

## Research

AWS describes the transactional-outbox pattern as a way to commit the primary
database change and its event intent atomically. It also states that consumers
must tolerate duplicate delivery, which makes at-least-once consumption the
appropriate model here. [AWS Prescriptive Guidance: Transactional outbox
pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html)

PostgreSQL documents `FOR UPDATE SKIP LOCKED` as appropriate for multiple
consumers accessing a queue-like table, while warning that it is not a
general-purpose consistent read. The worker therefore uses it only for ordered
operational claims, never for policy or authorization decisions. [PostgreSQL
18 `SELECT` documentation](https://www.postgresql.org/docs/18/sql-select.html)

OWASP recommends explicit server-side workflow state, conditional state
transitions, database transactions or row locks for critical sections, and
idempotency protections for retryable work. [OWASP Business Logic Security
Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)

## Options Considered

### Synchronous Refresh in the Authorized-Outcome Transaction

Pros: profile data appears immediately after evidence is written.

Cons: a media-profile failure holds or invalidates the evidence transaction,
and a rollback could still leave an externally visible refresh. Rejected.

### Simple Read-and-Delete Poller

Pros: minimal schema and worker code.

Cons: a process crash after reading loses work, concurrent consumers race, and
there is no bounded failure record. Rejected.

### Durable Claim, Lease, and Bounded Retry Worker

Pros: committed work is durable, multiple process instances do not block one
another, a stale worker cannot complete a renewed claim, failures do not retry
forever, and profile generation stays outside the evidence transaction.

Cons: refresh is eventually consistent, and a crash between generation and
completion can invoke the generator more than once. Selected.

## Final Recommendation Stack

1. Keep source-event-deduplicated refresh intent in the same transaction as
   admitted compatibility or identity evidence.
2. Claim only compact, allowlisted outbox rows with a deterministic
   `FOR UPDATE SKIP LOCKED` batch and a short UUID lease.
3. Generate the library profile after claim commit, relying on the existing
   `library_profiles` upsert as the idempotent effect boundary.
4. Use token-guarded state transitions, three maximum attempts, fixed retry
   delays, and fixed failure identifiers rather than persisted error text.
5. Run one scheduler task per process with `noOverlap` and a database advisory
   lock so application instances coordinate without a deployment-specific
   dependency.

## Implementation

`20260726_130000_add_policy_profile_refresh_outbox_worker_state.sql` adds only
operational state, attempts, availability, claim lease, completion, bounded
failure code, and partial indexes for pending and expired claims.

`policyProfileRefreshOutboxWorkerRepository.mjs` owns the conditional SQL
transitions. It first terminates an expired final-attempt lease, then claims
eligible compatibility or identity rows. Completion and failure updates both
require the current claim token. No worker method accepts client input.

`policyProfileRefreshOutboxWorker.mjs` contains the bounded orchestration. It
opens a short transaction only for recovery and claiming, calls the existing
profile service serially outside that transaction, and records compact counts
for completion, empty-library completion, retry, terminal failure, and lost
claim outcomes.

The worker runs once per minute after application readiness with a ninety
second initial delay. `node-cron` prevents overlap in one process and the
existing PostgreSQL advisory-lock mechanism coordinates separate processes.

## Security Outcome

- Only the authorized evidence executor can append a refresh event.
- The worker repeats the source-system, reason, and operation/tier allowlist in
  its claim query; exact-item memory cannot meet those conditions.
- A rolled-back evidence transaction has no visible outbox row, so it cannot
  be claimed.
- UUID tokens and conditional updates prevent stale ownership from completing
  or rescheduling a record.
- Database state stores fixed failure identifiers, not exception messages,
  provider payloads, operator labels, or media metadata.
- A failed profile generator never prevents the already-committed authorized
  outcome from remaining durable.

## Verification

Focused tests cover deterministic `SKIP LOCKED` claims, expired final leases,
claim-token completion, terminal failure state, successful generation,
empty-library completion, bounded retry, no fourth attempt, lost claim
handling, scheduler coordination, and application-start wiring.

## Next Step

Phase 6R.3.3f is complete. The database-backed concurrency, replay, rollback,
and stale-lease audit is documented in [Policy Authorized Outcome Concurrency
And Recovery Audit](policy-authorized-outcome-concurrency-recovery-audit.md).
Proceed to **Phase 6R.4: Automation Readiness Engine**.
