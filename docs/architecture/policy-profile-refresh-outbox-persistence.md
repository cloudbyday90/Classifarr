# Policy Profile Refresh Outbox Persistence

## Decision

Phase 6R.3.3e.4 made a learning-origin profile refresh durable without invoking
a profile generator in the request transaction. The outbox now supports a
second server-owned `native_readiness` request that the scheduler produces for
an active native policy whose persisted profile is missing or stale. Both forms
use the same compact `policy_profile_refresh_outbox` table and worker.

The row is keyed by the already-authorized `(source_id, source_event_id)` and
contains only the correlation IDs needed by a later worker:

- source and source-event IDs;
- classification and destination-library IDs;
- admitted learning operation and tier;
- canonical candidate key and `profile_refresh_required` reason; and
- a fixed, server-owned source-system ID.

The native-readiness record deliberately contains no classification, learning
operation, candidate, operator label, raw answer, AI output, provider payload,
Discord data, route diagnostic, or authentication context. Its source event is
derived only from the library ID and the persisted profile state/version. An
exact-item-memory decision never produces either record type.

## Research

AWS documents the transactional-outbox pattern for the database-update plus
event-notification dual-write problem: write the outbox row with the primary
data in one transaction, and let a separate consumer observe committed rows.
It also requires an idempotent consumer because delivery can repeat. [AWS
Prescriptive Guidance: Transactional outbox
pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html)

OWASP recommends that multi-step workflows keep explicit server-side state,
re-derive security-relevant values on the server, use database transactions or
locks for atomic operations, and use durable idempotency handling for actions
that can be retried. [OWASP Business Logic Security Cheat
Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)

PostgreSQL documents `SKIP LOCKED` as suitable for queue-like tables with
multiple consumers, while warning that it is not a general-consistency read.
That makes it appropriate for the bounded worker planned in 6R.3.3e.5, not
for authorization or policy state. [PostgreSQL 18 `SELECT`
documentation](https://www.postgresql.org/docs/18/sql-select.html)

## Options Considered

### Invoke the Profile Generator in the Evidence Transaction

Pros: no queue storage or deferred processing.

Cons: creates a database-to-service dual write, increases transaction time,
cannot safely retry after a post-commit failure, and could generate a profile
for rolled-back evidence. Rejected.

### Insert an Uncorrelated Refresh Request After Evidence Commits

Pros: simple repository API.

Cons: leaves a crash window between the evidence mutation and refresh intent,
and duplicate source events can produce duplicate refresh work. Rejected.

### Append a Compact, Source-Event-Deduplicated Outbox Record in the Same Transaction

Pros: evidence and refresh intent commit or roll back together; the existing
source-event receipt blocks normal replays; the table has a second unique
constraint for local integrity; and the future consumer can be independently
retried.

Cons: the profile is eventually refreshed rather than immediately refreshed,
and the future consumer needs explicit claim and retry behavior. Selected.

## Implementation

`policyProfileRefreshCommand.mjs` now carries the already-audited canonical
refresh reason into the compact command. `policyProfileRefreshOutboxRecord.mjs`
validates the command again as a narrow storage record. Its repository uses a
parameterized `INSERT ... ON CONFLICT DO NOTHING` followed by a bounded lookup
only when a same-event row already exists.

`PolicyRefreshBackedEvidencePersistence` composes the selected evidence writer
and outbox append with the caller-owned transaction client. The generic
authorized-outcome executor invokes this composer only for compatibility or
identity operations. If the final outcome, evidence mutation, or outbox append
fails, the owning transaction fails; no profile generator is called here.

The outbox is operational runtime state, not portable policy configuration.
Replace restore clears it before restoring configuration, preventing a backup
from executing stale refresh work in another installation.

## Security Outcome

- The client cannot request or alter a refresh record directly.
- The record is derived from the server-rebuilt, lock-validated authorized
  command and an allowlisted evidence operation/tier pair.
- Source-event uniqueness prevents a second outbox row for the same authorized
  event, while the executor's receipt rejects changed-event payloads before an
  evidence writer can run.
- No external service, profile generator, media server, or AI provider runs in
  the database transaction.
- The future worker receives no secret, raw content, or free-text payload.

## Verification

Focused tests prove compact-record validation, parameterized insertion and
deduplication, evidence-before-outbox ordering, no outbox append after evidence
failure, replayed identity-admission handling, executor composition, and
replace-restore cleanup.

## Next Step

The generalized scheduler-owned producer is documented in [Native Policy
Profile Refresh Automation](policy-native-profile-refresh-automation.md). The
worker lifecycle remains documented in [Policy Profile Refresh Worker
Consumer](policy-profile-refresh-worker-consumer.md).
