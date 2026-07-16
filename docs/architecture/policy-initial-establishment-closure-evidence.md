# Initial Native Intent Establishment Closure Evidence

## Status

Implemented on 2026-07-16 for Policy Builder roadmap task 8R.3.2.10.4.

## Problem

Initial native-intent establishment is intentionally separate from legacy
policy conversion. A destination with no legacy configuration must first be
triaged as empty, then receive an administrator-declared authority transaction,
and finally expose a bounded readiness and recovery state. Treating the
ordinary conversion workflow as evidence for that path would leave a closure
audit unable to detect a missing first-authority safeguard.

The closure audit must prove all three parts together without running the
transition, reconciliation, routing, classification, learning, or external
provider work.

## Research

[NIST SP 800-218, Secure Software Development Framework](https://csrc.nist.gov/pubs/800-218/final)
recommends retaining evidence that security requirements and verification
activities were completed. The closure catalog maps the establishment boundary
to concrete documentation, implementation, migration, schema, and tests.

[OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
requires server-side authorization and sequential state transitions for
consequential actions. Triage, establishment, and recovery are therefore
separate contracts; no read-only report or conversion result can authorize the
first authority write.

[OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
recommends auditability without exposing sensitive values. The closure catalog
stores repository paths and component identifiers only. It does not collect an
idempotency key, request fingerprint, actor, declared-rule payload, routing
configuration, media observation, metadata, RAG result, or AI output.

## Options

### 1. Treat Legacy Conversion As Sufficient Evidence

Pros:

- No additional closure-map entry.
- Smaller audit catalog.

Cons:

- Conversion assumes legacy configuration exists, while initial establishment
  requires its absence.
- It cannot prove the distinct first-authority migration, idempotency, rollback,
  or recovery boundaries.
- A closure result could be complete while the initial-establishment path is
  missing or untested.

Decision: rejected.

### 2. Require Only The Explicit Establishment Route

Pros:

- Directly covers the state-changing action.

Cons:

- Omits the triage guard that prevents automatic inference from an empty
  destination.
- Omits the bounded readiness/recovery contract needed to understand the
  recorded authority without editing policy data.

Decision: rejected.

### 3. Require The Complete Initial-Establishment Boundary

Pros:

- Requires read-only triage, the transactionally revalidated administrator
  transition, and read-only readiness/recovery together.
- Includes the durable migration and fresh-install schema as storage evidence.
- Makes a missing route, service, contract, document, or focused test block
  Phase 8R closure evidence.
- Does not change runtime policy behavior or start automation.

Cons:

- Adds one deliberate component to the closure catalog and its focused
  validation scope.
- Future changes to any of the three safeguards must update closure evidence.

Decision: adopted.

## Final Recommendation Stack

1. Track `initial_native_intent_establishment` separately from
   `explicit_conversion_workflow`.
2. Require the triage candidate report and reconciliation-state contract, the
   explicit establishment contract/persistence/service/route, and the bounded
   readiness contract/persistence/service/route.
3. Require migration `20260716_050000_add_policy_initial_intent_establishments.sql`
   and `database/schema/current.sql` so fresh-install storage is included.
4. Require focused candidate, reconciliation, establishment, readiness, route,
   integration, and migration tests.
5. Require both the Phase 8R work-sequence entry and implementation-status
   heading before closure evidence can be complete.
6. Keep evidence collection read-only. It scans checkout artifacts only and
   does not execute the establishment action or any external operation.

## Outcome

`policyStorageClosureEvidenceRun.mjs` now maps the full initial native-intent
establishment boundary. `policyStorageCompletionCheckpoint.mjs` independently
requires the same component before it can report complete. The existing
collector and requirement audit inherit the map, so missing documentation,
contracts, tests, roadmap markers, or release-note coverage now block Phase 8R
closure evidence rather than being covered by legacy conversion alone. The
fixed closure-validation command also runs the triage, transaction,
readiness/recovery, route, integration, migration, and Markdown evidence for
this boundary before a regenerated validation artifact can pass.
