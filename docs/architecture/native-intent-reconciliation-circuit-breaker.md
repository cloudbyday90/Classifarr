# Native Intent Reconciliation Circuit Breaker

## Status

Implemented for Phase 8R.3.2.5. This is a server-owned safety control for
automatic native-intent reconciliation. It is not a policy-builder setting,
does not change policy meaning, and does not introduce a manual conversion
workflow.

## Problem

Automatic conversion is bounded and transaction-protected, but repeated
systemic faults could still cause every scheduler interval to retry a known-bad
operation. Database instability, missing schema elements, and native-authority
integrity incidents need a durable, global guard.

The guard must not confuse those faults with a normal per-policy outcome. A
policy requiring review, having an unsupported signal, lacking routing, or
being held after rollback must not stop safe conversion for other policies.

## Official-Source Research

Research reviewed in June 2026:

- [AWS Prescriptive Guidance: Circuit breaker pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/circuit-breaker.html)
  recommends persisting circuit state, failing fast after repeated failures,
  supporting administrator force-open/close actions, and observing recovery.
- [Microsoft Learn: Circuit Breaker pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker)
  describes a bounded failure window with closed, open, and half-open states,
  including a limited health check before normal work resumes.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends structured and attributable administrative events while excluding
  secrets, connection strings, tokens, raw errors, and other sensitive data.

## Options Considered

### Per-Policy Retry State Only

Pros:

- Already persists candidate fingerprints and bounded backoff.
- Correct for a policy-specific conversion failure.

Cons:

- A database or schema fault is not tied to one candidate.
- Does not provide a durable emergency stop or controlled recovery path.

### In-Memory Scheduler Flag

Pros:

- Very small implementation.
- Avoids a migration.

Cons:

- Process restart loses the safeguard.
- Replicas can disagree.
- Cannot support attributable break-glass actions or a safe recovery probe.

### Recommended: Singleton Control With Bounded Audit Events

Pros:

- One durable row applies consistently across replicas.
- Only repeated, same-category systemic failures open the circuit.
- Emergency stop, reset, and automatic recovery are attributable without
  storing raw exception material or policy data.
- A read-only half-open probe proves recovery before the next scheduled write.

Cons:

- Adds two small operational tables and protected administrator endpoints.
- An unavailable control row fails closed, so schema health is part of
  deployment verification.

## Implemented Design

### Server-Owned Automation Setting

`policy_native_intent_reconciliation_controls` is a singleton. Its
`automation_enabled` setting defaults to `true` and is the only emergency
disable control. It is deliberately absent from policy authoring.

Protected administrator routes are:

- `GET /api/policies/native-intent-reconciliation/control`
- `POST /api/policies/native-intent-reconciliation/control/emergency-stop`
- `POST /api/policies/native-intent-reconciliation/control/resume`
- `POST /api/policies/native-intent-reconciliation/control/reset`

Write routes derive the administrator ID from authenticated server context and
require a bounded `reason_code`. A client-supplied actor ID is ignored.
Emergency stop blocks reconciliation before candidate discovery; it does not
affect native runtime reads, rollback, ordinary policy saves, routing, or
classification.

### Circuit States And Failure Scope

The control uses `closed`, `open`, and `half_open` states. It opens only after
three failures of the same category within fifteen minutes:

- `transient_database`: allows automatic recovery through a read-only probe.
- `schema_incompatible`: requires an administrator reset after repair.
- `native_authority_integrity_failed`: requires an administrator reset after
  authority remediation.

The following never count toward the global circuit: contract validation,
unsupported legacy signal shapes, individual policy authority blockers,
rollback holds, review requirements, routing readiness, profile freshness,
execution-budget deferral, and ledger failures after a committed conversion.

### Recovery

For a transient circuit, the next scheduled pass enters `half_open` and runs
only a read-only probe: `SELECT 1`, the existing restore-gate check, and a
native-authority integrity read. It performs no candidate discovery,
conversion, rollback-snapshot, or migration-event write. A healthy probe closes
the circuit but defers that pass; the next interval is the first allowed
conversion run.

Schema and authority-integrity categories require an administrator reset. The
reset does not resume writes immediately; it permits only the same read-only
probe.

### Audit And Data Minimization

`policy_native_intent_reconciliation_control_events` records only disable,
resume, open, reset, and recovered transitions. Each record has a stable event
type, reason ID, optional bounded failure category, actor type, actor ID where
applicable, and timestamp.

Neither the control row nor its events can store legacy JSON, prompts, provider
output, stack traces, SQL error text, connection details, sessions, or
credentials. The reconciler returns the same bounded control state to support
tooling without exposing the underlying exception.

## Edge Cases

| Risk | Control |
| --- | --- |
| One malformed policy fails repeatedly | It remains policy-local; the global circuit count does not change. |
| A transaction fails after snapshot work begins | Existing apply transactions roll back; only the bounded returned failure category can increment the control. |
| Database is completely unavailable | Reconciliation already fails without writes. No unsafe fallback or raw error persistence occurs. |
| Two replicas probe recovery | Scheduler advisory locking and the singleton row lock permit only one non-stale probe. |
| A process stops during a probe | A one-minute stale-probe lease lets a later pass reclaim it. |
| Emergency stop is resumed while a circuit remains open | Resume restores only `automation_enabled`; the circuit recovery requirement still applies. |
| Schema or authority repair is incomplete | Reset only permits a read-only probe; a failure keeps the circuit open. |
| Control row is missing or malformed | Control normalization fails closed before candidate discovery. |

## Verification

- Contract tests cover bounded classification, same-category thresholding,
  administrator-reset requirements, and fail-closed normalization.
- Service tests cover transient recovery, schema reset gating, policy-local
  failure exclusion, emergency-stop attribution, and pre-discovery deferral.
- Route tests verify admin-only status, server-derived actor identity, and
  invalid or non-admin request rejection.
- Reconciliation-service tests verify emergency stop prevents apply-gate
  execution and public run evidence stays compact.

## Result

Eligible legacy policies remain hands-off and automatic. Only repeated
systemic failures pause the scheduler, and recovery is controlled by a
read-only check or attributable administrator reset. The next component is
Phase 8R.3.2.6: read-only status, alerting, and legacy-deletion integration.
