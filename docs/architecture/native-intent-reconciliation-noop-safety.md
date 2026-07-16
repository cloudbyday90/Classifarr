# Native Intent Reconciliation No-Work Safety

Status: implemented on 2026-07-16.

## Problem

Native intent reconciliation scans only legacy policies without active native
authority. When that inventory is empty, the post-upgrade dry run intentionally
has no conversion workflow. The execution service previously treated that
absence as if it were a conversion workflow and attempted to read its steps.
The resulting `TypeError` incorrectly persisted a failed reconciliation run and
could trigger failure alert evaluation even though no policy needed work.

## Research

OWASP recommends that error handling avoid information disclosure while keeping
server-side events useful for monitoring. Its logging guidance also warns
against alarm noise and calls for consistent outcome and reason fields.

- [OWASP Error Handling Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

## Options

1. Treat an empty inventory as a conversion failure: preserves the old control
   path but creates false failures, retry churn, and alerts.
2. Make only the step reader null-safe: prevents the exception but still sends
   no-work inventory through unnecessary state, dry-run, and apply stages.
3. Detect empty inventory at the execution boundary and return the existing
   evaluated no-work contract, while keeping the step reader null-safe.

## Decision

Use option 3.

`NativeIntentReconciliationExecutionService` now returns before lifecycle
partitioning, reconciliation-state persistence, dry-run creation, or apply-gate
execution when the unconverted policy inventory is empty. The result contains no
candidates, no conversion steps, no writes, and an `evaluated` status. The
existing ledger contract maps that zero-candidate evaluated result to
`no_candidates`.

`toSafeConversionSteps` also uses optional chaining so a nullable workflow
cannot become an unclassified execution error if a future non-empty path emits
one.

## Security And Operational Outcome

- No raw exception, policy payload, or implementation detail is added to the
  operator-facing result or persisted reconciliation evidence.
- A no-work pass cannot create a native intent, snapshot, migration event,
  reconciliation state, or alert-worthy failure.
- Actual non-empty workflow failures remain subject to bounded stage/reason
  attribution, circuit-breaker classification, and failed-run ledger evidence.

## Verification

Focused execution-service coverage proves an empty unconverted inventory returns
the evaluated no-op contract and does not invoke lifecycle partitioning,
reconciliation state, dry-run creation, or conversion application.
