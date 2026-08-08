# Privacy-Bounded Retry, Recovery, Stale-Evidence, And Restart Acceptance

Status: complete on 2026-08-08.

## Scope

This design closes roadmap task 10R.3.2. It makes retry, queue recovery, RAG
diagnostics, stale-question handling, and worker restart recovery safe to
operate without storing upstream exception text, stack traces, provider
configuration, source payloads, or arbitrary metadata in operator-facing
recovery state.

The scope is deliberately limited to retry and recovery boundaries. It does
not make an AI response authoritative, alter routing eligibility, add a live
provider dependency, or introduce a normal-runtime compatibility-retirement
path.

## Decision

Persist and expose a small, stable reason vocabulary instead of exception
messages. Queue task state uses `task_processing_failed`,
`task_unknown_type`, `task_visibility_timeout_recovered`,
`task_startup_stale_recovered`, and
`task_graceful_shutdown_recovered`. Queue and RAG logs use similarly bounded
reason identifiers for failed recovery and diagnostic operations.

Raw errors remain in process memory only long enough to select a deterministic
outcome. They do not cross a retry result, task queue, webhook record, RAG
error record, RAG metric, or runtime log boundary. RAG stage records retain
only bounded aggregation dimensions such as stage, outcome, reason code,
recoverability, SQLSTATE, and duration.

The existing retry transaction and duplicate-task guard remain the idempotency
boundary. A retry failure leaves the original classification state unchanged
and creates no partial task. Worker restart recovery is durable database work:
expired processing work returns to `pending` with a recovery code, while newer
work remains in progress. A stale persisted question remains visible, but the
server-owned answer contract marks destination-changing actions unavailable.

## Persisted Upgrade

`20260808_150000_privacy_bound_recovery_diagnostics.sql` converts historical
queue diagnostics to the fixed task vocabulary and redacts historical RAG
stage records, generic RAG failure records, and second-pass metric metadata.
The migration preserves bounded operational dimensions needed for aggregation
and remediation while nulling message stacks, trace identifiers, correlation
identifiers, and classification identifiers in the affected RAG records.

The migration is data-only. A fresh installation has no historical records to
redact, while an existing installation receives the same forward-only upgrade
at startup through the standard migration runner.

## Research And Options

### Bound Structured Diagnostics

The OWASP Logging Cheat Sheet recommends removing, masking, hashing, or
encrypting secrets and sensitive data from logs, and protecting logs in
storage and transit. [OWASP Logging Cheat
Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

- Pro: fixed reason IDs are safe to aggregate, alert on, retain, and show to
  operators.
- Con: they provide less immediate troubleshooting detail than raw exceptions.

### Idempotent Retry Boundary

AWS recommends idempotent APIs so a retry has the same semantic effect as the
original request, and notes that durable recording of request intent and
mutation is needed to avoid duplicate side effects. [AWS Builders' Library:
Making retries safe with idempotent
APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/)

- Pro: preserving the existing transaction and duplicate-task check avoids
  duplicate queue work after a partial failure or retry.
- Con: some transient failures still require a later scheduled retry rather
  than an immediate in-process replay.

### Transaction-Level Recovery

PostgreSQL documents that serialization failures require retrying the complete
transaction, including its decision logic, rather than only the failed SQL
statement. [PostgreSQL Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html)

- Pro: the retry service keeps all classification state checks and queue writes
  inside one retry unit.
- Con: a complete transaction retry costs more than replaying one statement.

### Signal-Based Shutdown

Node documents that `exit` handlers cannot perform asynchronous work. Shutdown
work therefore belongs in signal-driven application lifecycle code, with the
database visibility window remaining the fallback after an ungraceful stop.
[Node.js Process](https://nodejs.org/api/process.html)

- Pro: graceful shutdown can await durable work, while visibility recovery
  covers abrupt process loss.
- Con: graceful shutdown is best effort; the restart-safe visibility path is
  still required.

## Recommended Stack

1. Use a server-owned fixed reason vocabulary for persisted and emitted
   recovery outcomes; do not expose upstream exception text or arbitrary
   metadata.
2. Keep retry side effects transactional and duplicate-safe. On a transaction
   failure, return a bounded failure result and let the durable scheduler own
   any later retry.
3. Recover abandoned work through a bounded visibility/startup state transition
   rather than an exit-hook assumption.
4. Re-evaluate stale question context at read and answer time; retain visibility
   but fail closed for resolution, routing, learning, and retirement actions.
5. Redact historical rows with a forward-only data migration so upgraded
   installations receive the same privacy boundary as new runtime writes.

## Validation

- Unit coverage verifies bounded queue retry and RAG diagnostic projection.
- Isolated PostgreSQL acceptance verifies retry rollback, stale-question action
  gating, startup restart recovery, provider recovery, and visibility recovery
  without a live provider or media server.
- The standard migration runner applies the data-only upgrade to the local
  containerized installation before the schema snapshot is regenerated.
