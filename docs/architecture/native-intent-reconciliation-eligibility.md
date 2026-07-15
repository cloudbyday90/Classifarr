# Native Intent Reconciliation Eligibility

## Status

Implemented as Phase 8R.3.2.3. This component adds fingerprint-bound retry,
quarantine, and selection semantics to automatic native-intent reconciliation.
It does not implement the later global circuit breaker, emergency stop, or
administrator status surface.

## Problem

The reconciliation ledger records historic outcomes, but history alone cannot
decide whether a policy is eligible on this scheduler run. Retrying every
blocked or failed policy wastes bounded execution time, while treating a
temporary database error as permanent can leave a healthy policy stranded.

The system needs current, policy-local control state that preserves only the
minimum information necessary to decide when to try again. It must not become
another source of policy intent or a store for raw legacy policy data.

## Official-Source Research

- [AWS Builders' Library: Making retries safe with idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/)
  recommends a known-success state and idempotent operation semantics before
  retrying. Classifarr retains the existing authority lock and idempotent
  conversion path; retry state never claims a conversion completed.
- [AWS Well-Architected: Limit retries](https://docs.aws.amazon.com/wellarchitected/2022-03-31/framework/rel_mitigate_interaction_failure_limit_retries.html)
  recommends bounded retry with exponential backoff and jitter. The service
  uses a five-minute base, one-hour cap, and deterministic fingerprint-derived
  jitter so the persisted next-attempt time is inspectable.
- [PostgreSQL serialization failure handling](https://www.postgresql.org/docs/16/mvcc-serialization-failure-handling.html)
  requires retrying the whole transaction for serialization failures. The apply
  gate classifies SQLSTATE `40001`, deadlock, lock, connection, and bounded
  network failure categories without returning exception text.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  advises minimizing event data and excluding secrets and sensitive payloads.
  State rows and logs retain only stable IDs, a SHA-256 fingerprint, timestamps,
  and a bounded failure count.

## Options Considered

### Re-evaluate Every Candidate On Every Run

Pros:

- No additional state.
- Always reads current policy information.

Cons:

- Blocked policies can consume each bounded discovery window indefinitely.
- Repeated transient failure can thrash the database and migration path.
- Scheduler restarts provide no useful retry discipline.

### Keep Retry State Only In Memory

Pros:

- Small implementation surface.
- No schema or restore work.

Cons:

- Restart loses backoff and repeats work immediately.
- Multiple replicas cannot share a safe eligibility decision.
- Support cannot distinguish a policy-local blocker from a new attempt.

### Recommended: Persisted, Fingerprint-Bound Policy State

Pros:

- Retry and terminal dispositions survive restart and backup/restore.
- A changed candidate fingerprint clears stale retry or quarantine state.
- Terminal policies stop consuming the ready conversion batch.
- Safe data is bounded and remains separate from policy authority.

Cons:

- Adds one small control-plane table and backup/restore mapping.
- Needs the later global circuit breaker for system-wide failure containment.

## Implemented Design

### Safe State Contract

`policy_native_intent_reconciliation_states` has one row per policy. It stores
only the policy reference, safe candidate fingerprint and status ID, outcome
and reason IDs, retry timestamp, failure count from zero through three, and
timestamps. Database constraints reject invalid fingerprints, identifiers,
outcomes, retry-state combinations, and out-of-order retry timing.

No JSON, raw legacy policy data, prompts, provider responses, stack traces, or
credentials are stored. `policy_intents` and existing migration events remain
the only authority for a completed native conversion.

### Eligibility And Selection

The reconciler inspects a bounded 100-policy discovery window and selects at
most its existing 10-policy conversion batch. The candidate loader prioritizes
new and due candidates ahead of matching retry backoff and unchanged terminal
states. This prevents an unsupported policy from permanently occupying the
discovery window while still allowing it back in when its current candidate
fingerprint changes.

A matching `blocked_current_state` or `requires_maintenance` state is a real
quarantine: it is not selected again until its candidate fingerprint changes.
The result reports a bounded quarantined-policy count without exposing policy
payloads.

The state contract classifies current candidate conditions as follows:

- Invalid authority or required verifier evidence becomes
  `blocked_current_state`.
- Unsupported legacy shape, partial inference, or explicit review becomes
  `requires_maintenance`.
- Execution-budget exhaustion becomes `deferred_retry` with backoff but does
  not consume or reset the technical-failure allowance.
- Transaction, database, lock, connection, and similar technical failure
  becomes `system_failure` with bounded exponential backoff.
- Three matching-fingerprint technical failures become
  `requires_maintenance`; this is policy-local and does not replace the later
  global circuit breaker.

Routing-target and profile-freshness information do not enter conversion retry
eligibility. They remain automation-readiness concerns after conversion.

### Commit And Recovery Boundaries

Baseline blocker state is persisted before conversion. Conversion still goes
through the existing transactional authority lock and idempotent apply gate.
After the gate returns, successful or already-native policies have their
current retry state deleted; non-success results receive a new safe state.

State-write failure after a committed conversion is logged as the bounded
`state_write` category and cannot relabel the conversion. The durable ledger
records the corresponding safe outcome override after the apply result.

Backups include state rows and restore them only after policy-ID mapping. A
restore does not resume an in-progress run: the next scheduler pass evaluates
the live candidate and fingerprint again.

## Security And Edge Cases

| Risk | Control |
| --- | --- |
| Stale retry or blocker gains authority after a policy change | Candidate fingerprint mismatch deletes state and returns the policy to evaluation. |
| Unsupported policies starve ready work | Discovery scans more than the conversion batch and prioritizes unseen or due state. |
| Busy scheduler incorrectly quarantines healthy work | Execution-budget deferral backs off without incrementing or resetting technical failure count. |
| Database serialization exposes internals | Apply gate reports only `transient_database`; exception text is omitted from results, state, and ledger. |
| Repeated write failure thrashes conversion | Matching candidate state uses capped exponential backoff and promotes only technical failures after three attempts. |
| Backup maps a state to the wrong policy | Restore maps each state through the restored policy ID and upserts by that mapped primary key. |
| A state update falsely changes conversion outcome | State is a scheduling control plane; native authority and migration events remain transactionally authoritative. |

## Verification

- Unit tests cover fingerprint reset, deferred backoff, blocker quarantine,
  technical retry escalation, non-penalizing execution-budget deferral, and
  required-verifier blockers.
- Execution tests verify a bounded discovery window passes only selected policy
  IDs to the apply gate and never exposes raw candidate payloads.
- Apply-gate tests verify SQLSTATE `40001` is sanitized as
  `transient_database`.
- Backup, restore, migration, schema-snapshot, typecheck, and security-lint
  coverage verify lifecycle and storage boundaries.

## Result

Automatic native-intent conversion now retries only current, eligible work and
keeps unsupported or repeatedly failing policies visible without allowing them
to starve unrelated ready policies. The next component is Phase 8R.3.2.4:
reversion, restore, and new-policy interaction guards.
