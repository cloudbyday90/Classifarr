# Policy Runtime Pending-Question Cleanup Rollout Verification

**Status:** Implemented for Phase 5R.7.4 on 2026-08-04.

## Purpose

Verify that the pending-question cleanup can be introduced to an existing
installation without allowing old question shapes to influence answer,
learning, or policy-edit behavior. This document completes the safety case for
the read-only inventory and transactional apply components.

## Decision

Cleanup is an explicit, administrator-only maintenance operation. An upgrade
installs the append-only audit schema only; startup, normal `/pending` reads,
and normal classification reads never scan or modify pending questions.

The invocation sequence is deliberately narrow:

1. An administrator requests `GET /api/classification/pending-cleanup/inventory`.
   It runs a bounded, repeatable-read, read-only server snapshot and returns a
   no-side-effect plan.
2. An administrator selects up to 100 IDs and posts only those IDs to
   `POST /api/classification/pending-cleanup/apply`.
3. The server locks every selected current row, recalculates its plan, clears
   unsafe question and response material, and queues the existing automatic
   runtime retry when a fresh evaluation is required.
4. A later identical apply observes the cleanup-owned retry marker and its
   existing constrained audit receipt. It reports the original receipt without
   a second queue reset or audit insert. A missing or malformed receipt is not
   trusted and re-enters the server-derived cleanup path.

The implementation intentionally does not introduce a startup backfill,
automatic reader-side repair, or a new scheduler. This prevents an upgrade,
browser refresh, or ordinary pending-question read from producing unexpected
writes. It remains platform and library agnostic because all decisions are
recomputed from the locked classification and current server state.

## Security Research And Options

The design follows the requested June 2026 baseline using official guidance.
OWASP recommends deny-by-default authorization, validating permissions on each
request, and testing authorization decisions. Its REST guidance recommends
rejecting unexpected fields and treating request objects as untrusted.
PostgreSQL documents that row locks are released at transaction end and that a
transaction must be retried from the beginning after a repeatable-read
serialization failure. OWASP logging guidance also supports recording the
admin action and bounded object identifiers while excluding sensitive request
content.

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- [PostgreSQL 17 Explicit Locking](https://www.postgresql.org/docs/17/explicit-locking.html)
- [PostgreSQL 17 Transaction Isolation](https://www.postgresql.org/docs/17/transaction-iso.html)
- [PostgreSQL 17 SET TRANSACTION](https://www.postgresql.org/docs/17/sql-set-transaction.html)

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Scan and rewrite questions at startup or on normal reads | Requires no explicit maintenance call | Makes upgrades and reads write-capable, obscures audit ownership, and can create load spikes | Rejected |
| Trust browser action, prior dry-run, or legacy answer text | Small request surface | Allows stale or client-controlled decisions and can recreate retired free-form behavior | Rejected |
| Allow an administrator to apply selected IDs after a server dry run | Bounded, reviewable, server-recomputed, and auditable | Requires one explicit maintenance invocation | Selected |
| Requeue every duplicate request | Simple implementation | Resets retry scheduling and creates duplicate audit records | Rejected |
| Reuse a prior receipt only when the cleanup marker and matching audit agree | Idempotent retry without accepting caller state | Requires a small locked audit lookup | Selected |

## Final Recommendation Stack

1. Keep cleanup behind the existing administrator and read-write boundaries;
   accept only bounded classification IDs.
2. Preserve the read-only inventory as the sole preview operation and never
   invoke cleanup from startup or ordinary pending reads.
3. Lock and recompute each selected record in one transaction. On a failure,
   let the transaction rollback and retry the complete operation later.
4. Reuse an audit receipt only for the server-owned retry marker plus a valid,
   matching bounded audit row. Treat every other state as untrusted.
5. Clear unsafe questions and legacy responses before the existing scheduler
   performs a fresh runtime evaluation; do not reconstruct an answer, write
   learning, or submit a policy edit.
6. Verify schema parity against both upgraded and fresh installations before
   release, using the existing forward-only migration and schema-snapshot
   checks.

## Executable Verification

Focused server coverage verifies:

- the inventory is bounded, repeatable-read, read-only, and has no side
  effects;
- stale policy context and cross-library candidates queue a fresh evaluation;
- current native questions retain their question and receive only an unchanged
  bounded audit record;
- unsafe question and legacy response material are cleared, leaving no runtime
  answer, learning, or policy-edit contract;
- duplicate cleanup applies reuse the original receipt without another queue or
  audit write, while malformed marker/audit combinations fail closed;
- administrator and read-write authorization are both required;
- an interrupted audit write propagates through the transaction boundary so
  staged work rolls back; and
- normal `/pending` reads do not invoke either cleanup service.

Database rollout verification uses `npm run migration:check`,
`npm run db:dump-schema`, and `npm run db:check-schema`. The migration is
forward-only and idempotent; rollback in this component means atomic rollback
of an interrupted apply transaction, not deleting a previously released
schema migration.

## Implementation

- [Cleanup apply service](../../server/src/services/policyRuntimePendingQuestionCleanupApplyService.mjs)
- [Cleanup apply repository](../../server/src/services/policyRuntimePendingQuestionCleanupApplyRepository.mjs)
- [Apply service tests](../../server/src/__tests__/services/policyRuntimePendingQuestionCleanupApplyService.test.mjs)
- [Apply repository tests](../../server/src/__tests__/services/policyRuntimePendingQuestionCleanupApplyRepository.test.mjs)
- [Cleanup route tests](../../server/src/__tests__/routes/classificationRoutePendingCleanupApply.test.mjs)
- [Cleanup inventory route tests](../../server/src/__tests__/routes/classificationRoutePendingCleanupInventory.test.mjs)
