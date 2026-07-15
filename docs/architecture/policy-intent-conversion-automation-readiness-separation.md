# Policy Intent Conversion And Automation Readiness Separation

## Status

Implemented for migration candidate reporting and the transactional
post-upgrade apply writer.

## Problem

Native policy intent and automated routing have different safety requirements.
A library can have a valid destination definition before it has an Arr mapping
or a fresh observed-library profile. Blocking native storage conversion on those
operational prerequisites retains an unnecessary legacy dependency; marking an
unmapped destination as configured creates a false automation claim.

## Research And Recommendation

[PostgreSQL `SET TRANSACTION`](https://www.postgresql.org/docs/18/sql-set-transaction.html)
supports read-only inspection separately from later transactional writes, and
[PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html)
describes the row-level locking needed for a controlled apply step. The
[OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
supports bounded, purpose-specific audit data rather than raw policy payloads.

The recommended model has two explicit decisions:

1. **Conversion eligibility** asks whether the policy's native intent contract,
   legacy shape, and active-intent authority are safe to store.
2. **Automation readiness** asks whether routing and observed-library evidence
   are safe to use without manual review.

## Pros And Cons

Pros:

- Valid policy semantics can move to the durable native model without waiting
  for unrelated connection setup.
- An unmapped library is represented honestly with target status `missing`.
- Existing runtime readiness continues to prevent unsafe routing.
- Operator reports distinguish a migration action from a follow-up setup task.

Cons:

- Operator and future UI surfaces must show two states rather than one generic
  readiness label.
- A conversion can succeed while routing remains unavailable, so conversion
  tooling must never imply that automation was enabled.

## Implementation Outcome

- `policyIntentMigrationCandidateReport.mjs` now emits version 2 reports with
  `automationReadiness.statusId`, `canAutomate`, bounded blocker IDs, and
  bounded reasons alongside `statusId` and `canConvert`.
- Missing routing and stale profile state no longer make a valid policy
  ineligible for conversion.
- `policyPostUpgradeApplyGate.mjs` writes `target_status = 'missing'` when no
  route is configured. It never writes `configured` by default.
- The post-upgrade dry run can plan a native conversion for an unmapped
  destination while reporting that automation remains blocked.

## Security Outcome

- Candidate reporting remains read-only and suppresses raw legacy JSON by
  default.
- The apply path remains transactional and uses the existing policy-authority
  lock boundary.
- No automatic post-upgrade task was registered, so this change cannot convert
  policy storage without an explicit apply action.
- Runtime routing remains fail-closed until its existing readiness engine finds
  a configured target and usable profile evidence.

## Validation

- Focused candidate-report, post-upgrade dry-run, and apply-gate tests cover
  conversion with a missing route and verify the persisted `missing` status.
