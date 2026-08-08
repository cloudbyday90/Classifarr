# Bounded Lifecycle Diagnostics And Release-Evidence Separation

## Status

Complete: 10R.2.3 proves that reconciliation diagnostics for an existing
installation expose a bounded operational projection, while compatibility
retirement evidence remains a separate release concern that cannot interrupt
native policy operation.

## Decision

Use the existing native reconciliation status service for operator-visible
lifecycle diagnostics. Its contract reports safe status identifiers, timestamps,
bounded counts, and at most twelve outcome/reason groups. It does not report
policy or library identifiers, names, preset signals, raw legacy configuration,
provider payloads, exception text, or credentials.

Use the compatibility-deletion reconciliation-state inventory and policy-storage
closure readout only as release-evidence checks. They are read-only and report
whether retirement is blocked. They cannot change policy storage, invoke a
retirement action, or alter the native policy-engine runtime read.

## Research And Recommendation

OWASP recommends excluding or masking secrets and sensitive values in logging,
as well as sanitizing event data. It also recommends generic external error
responses that do not reveal implementation details. The bounded diagnostic
projection follows this guidance by publishing controlled identifiers and counts
instead of the source input that produced a state. [OWASP Logging Cheat
Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
and [OWASP Error Handling Cheat
Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html)

PostgreSQL transaction isolation gives each transaction a consistent snapshot
and requires applications to handle serialization failures where applicable.
Acceptance therefore verifies committed reconciliation state and the production
runtime projection, rather than assuming a transient pre-write view of an
installation. [PostgreSQL transaction
isolation](https://www.postgresql.org/docs/current/transaction-iso.html)

### Options

| Option | Advantages | Drawbacks |
| --- | --- | --- |
| Expose raw legacy configuration in an administrative diagnostic | Maximum direct detail for troubleshooting | Leaks configuration and provider data into a long-lived operational surface |
| Treat a blocked retirement artifact as a runtime gate | Makes release status conspicuous | Incorrectly stops ordinary native policy automation for an installation-specific release concern |
| Use bounded status projections and independent read-only release evidence | Supports safe operations, preserves runtime availability, and retains a clear retirement gate | Requires separate operational and release evidence to be interpreted correctly |

### Recommendation Stack

1. Publish lifecycle diagnostics exclusively through the versioned bounded
   reconciliation status contract.
2. Keep compatibility-retirement checks count-only, read-only, and outside all
   normal runtime entry paths.
3. Validate the separation through real persisted state and the production
   policy-engine read, not only by unit-testing projection builders.
4. Treat a blocked active-installation retirement artifact as a release task;
   it must never revoke validated native policy authority.

## Acceptance Coverage

The isolated PostgreSQL suite creates one supported legacy policy, one
unsupported legacy policy containing a unique sensitive fixture value, and one
persisted deferred reconciliation state. It then proves that:

- The real scheduler converts the supported policy to validated native
  authority and records the unsupported source as `requires_maintenance`.
- Reconciliation status reports only the supported bounded shape, two safe
  reason groups, and bounded unresolved counters.
- The diagnostic and release-evidence outputs contain neither the fixture value
  nor policy/library identifier fields, legacy signals, presets, or provider
  payload fields.
- Compatibility deletion is blocked by the unresolved maintenance state through
  a count-only, no-side-effect inventory; a missing final closure artifact is
  also reported as blocked without side effects.
- The supported policy has the same native-authority runtime projection before
  and after both blocked release-evidence reads.

## Implementation

- Bounded diagnostics:
  `server/src/services/nativeIntentReconciliationStatusService.mjs` and
  `server/src/services/nativeIntentReconciliationStatusContract.mjs`.
- Read-only retirement evidence:
  `server/src/services/policyCompatibilityDeletionReconciliationStateInventory.mjs`
  and `server/src/services/policyStorageFinalClosureReadout.mjs`.
- Native runtime authority:
  `server/src/services/policyEngineQueries.mjs` and
  `server/src/services/policyEngineRuntimeAuthority.mjs`.
- Isolated acceptance suite:
  `server/src/__tests__/integration/native-intent-lifecycle-diagnostics-release-evidence.test.mjs`.

## Next Task

Implement **10R.3 Operational Safety And Observability Acceptance**. Start by
accepting privacy-bounded retry, recovery, stale-evidence, and no-route
outcomes through their real service boundaries without introducing a path from
runtime operations to compatibility retirement.
