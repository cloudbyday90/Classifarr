# Reconciliation Idempotence And Native Runtime Read Acceptance

## Status

Complete: 10R.2.2 proves a converted installation can be reconciled again
without creating a second active authority, extending conversion history, or
requiring maintenance. It also proves the production policy-engine read returns
the persisted native contract and excludes compatibility presets from runtime
evaluation.

## Decision

Use the existing isolated PostgreSQL integration harness to create a supported
legacy policy and a profile-backed policy, invoke the real scheduler twice, and
read both policies through `getActivePolicies()`. The test compares the durable
intent rows and event types from immediately after initial conversion to those
after the repeat run.

The runtime assertion deliberately uses the policy-engine query rather than a
unit-level contract builder. That query attaches native authority, selects the
native runtime read path, and removes compatibility presets before a converted
policy can enter legacy scoring.

The fixture remains installation-agnostic:

- It creates new library, policy, preset, and profile records per run.
- It requires no provider credential, media-server connection, browser action,
  maintainer command, or existing installation data.
- It records and asserts only identifiers, statuses, intent properties, and
  event types; it does not log raw policy or profile payloads.

## Research And Recommendation

PostgreSQL documents `INSERT ... ON CONFLICT` as an atomic insert-or-update
operation, and its isolation guidance requires applications to handle
transaction retry where serialization conflicts can occur. The platform already
uses database constraints and transaction boundaries to preserve a single
authoritative native intent. This acceptance task should therefore assert the
durable result of sequential scheduler runs rather than replicate persistence
logic or make a pre-write application-side eligibility claim. [PostgreSQL
INSERT](https://www.postgresql.org/docs/current/sql-insert.html) and
[PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html)

OWASP recommends excluding secrets, sensitive personal data, and other values
that should not be written directly to logs. The lifecycle acceptance fixture
uses bounded event types and state identifiers, which verifies behavior without
turning test output or diagnostics into a source of raw configuration data.
[OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

### Options

| Option | Advantages | Drawbacks |
| --- | --- | --- |
| Mock a second reconciliation response | Fast and isolates a service contract | Cannot prove candidate exclusion, migration history, or runtime authority selection against persisted state |
| Test only the native contract adapter | Precise contract coverage | Does not prove the policy-engine query suppresses compatibility presets at runtime |
| Re-run the real scheduler and query the production policy engine | Verifies database eligibility, scheduler locking, durable history, and the native runtime projection together | Requires the isolated PostgreSQL integration runtime and is slower than unit coverage |

### Recommendation Stack

1. Make the real scheduler re-run the primary idempotence acceptance boundary.
2. Compare active authority rows and migration-event types before and after the
   repeat run; do not infer idempotence from a service return value alone.
3. Read through `getActivePolicies()` and require a validated native runtime
   source with an empty runtime preset list and the persisted native purpose.
4. Keep concurrency and retry behavior covered by existing transactional
   constraints and focused persistence tests; add a concurrent stress test only
   if production telemetry identifies a serialization or locking failure.

## Acceptance Coverage

The integration fixture verifies the following for both a supported legacy
policy and a current-profile-backed policy:

- The first scheduler run produces exactly one active, valid native intent.
- The second scheduler run leaves the same intent row and conversion-event
  sequence unchanged.
- Neither policy receives a `requires_maintenance` state, approval request, or
  other operator-owned admission path.
- The production policy-engine read selects `native_intent`, validates the
  native contract, and supplies no legacy presets to the runtime scorer.
- The native contract's purpose is the persisted converted evidence, not a
  compatibility projection.

## Implementation

- Reconciliation scheduler boundary: `server/src/services/scheduler.mjs` and
  `server/src/services/nativeIntentReconciliationService.mjs`.
- Native runtime authority selection:
  `server/src/services/policyEngineQueries.mjs` and
  `server/src/services/policyEngineRuntimeAuthority.mjs`.
- Isolated acceptance suite:
  `server/src/__tests__/integration/native-intent-installation-lifecycle-acceptance.test.mjs`.

## Next Task

10R.2.3 is complete. Its bounded diagnostic and release-evidence acceptance
record is
`docs/architecture/bounded-lifecycle-diagnostics-release-evidence-separation.md`.

Implement **10R.3 Operational Safety And Observability Acceptance** next. It
must accept privacy-bounded retry, recovery, stale-evidence, and no-route
outcomes without introducing a normal runtime path to compatibility retirement.
