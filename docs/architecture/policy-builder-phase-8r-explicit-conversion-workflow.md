# Policy Builder Phase 8R Explicit Conversion Workflow

Status: implemented as the third Phase 8R storage-migration component.

## Problem

Native policy intent conversion must not happen from ordinary policy reads,
unrelated saves, or implicit compatibility projection. Phase 8R needs an
explicit conversion action boundary before any later SQL writer can insert native
rows, write migration events, or disable legacy paths.

## Official Guidance Reviewed

- PostgreSQL transactions:
  <https://www.postgresql.org/docs/current/tutorial-transactions.html>
- PostgreSQL `ALTER TABLE`:
  <https://www.postgresql.org/docs/current/sql-altertable.html>
- NIST Secure Software Development Framework:
  <https://csrc.nist.gov/projects/ssdf>
- OWASP Application Security Verification Standard:
  <https://owasp.org/www-project-application-security-verification-standard/>

## Recommendations

1. Treat conversion as an explicit action, not a side effect of read or save.
2. Allow only approved actor sources:
   - manual operator,
   - post-upgrade apply mode,
   - test fixture,
   - maintainer migration tool.
3. Require the Phase 8R.2 candidate report to mark selected policies
   `ready_to_convert`.
4. Require server intent validation before planning native writes.
5. Require Phase 7R migration verifier output for behavior-sensitive policies.
6. Plan rollback snapshot creation before native rows.
7. Plan migration events and native records in the same future transactional
   boundary.
8. Use deterministic idempotency keys so retrying an explicit conversion action
   does not duplicate native rows.

## Pros And Cons

Pros:

- Prevents accidental conversion from normal product workflows.
- Gives conversion code a clear audit surface before storage writes exist.
- Preserves old active behavior until the future conversion transaction commits.
- Keeps rollback, migration event, and native record planning tied together.

Cons:

- Still does not write native rows; that belongs in the later SQL/conversion
  implementation.
- Behavior-sensitive policies require verifier input before they can be marked
  ready.

## Final Recommendation Stack

- Workflow service: `policyBuilderPhase8ExplicitConversionWorkflow.mjs`
- Allowed actor sources:
  - `manual_operator`
  - `post_upgrade_apply`
  - `test_fixture`
  - `maintainer_migration_tool`
- Blocked actor sources:
  - `ordinary_policy_read`
  - `unrelated_policy_save`
- Required per-policy conversion plans:
  - rollback snapshot,
  - migration event,
  - native intent records,
  - deterministic idempotency key,
  - legacy behavior retained until commit.
- Next component: Phase 8R.4 Native Runtime Read Path.

## Implemented Files

- `server/src/services/policyBuilderPhase8ExplicitConversionWorkflow.mjs`
- `server/src/__tests__/services/policyBuilderPhase8ExplicitConversionWorkflow.test.mjs`

## Outcome

Phase 8R.3 now provides a side-effect-free explicit conversion workflow plan.
Validation rejects ordinary read/save conversion, missing selections, ready steps
without ready candidates, ready steps without server validation/rollback/native
records/migration events, behavior-sensitive conversions without passing Phase
7R verifier output, missing idempotency keys, failed-conversion legacy mutation,
and any storage side effects.
