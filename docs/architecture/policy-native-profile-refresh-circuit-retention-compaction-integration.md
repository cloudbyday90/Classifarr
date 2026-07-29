# Native Profile Refresh Circuit Retention-Compaction Integration

## Decision

Native profile-refresh recovery history is removed only when it is both expired
and inactive. An eligible record is an old `closed` circuit with no active
native outbox work and no protected current source revision. `open` and
`half_open` circuits remain runtime recovery state regardless of age; recent
closed circuits, closed circuits with pending or processing work, and explicit
protected revisions remain intact.

The compactor derives retained circuits once in a materialized SQL CTE. Both
the circuit deletion and terminal-outbox deletion use that same retained set.
This avoids PostgreSQL sibling data-modifying CTE snapshot behavior leaving the
outbox row behind after its obsolete circuit is removed.

## Research

Research was retrieved from official sources on 28 July 2026. The sources used
were available by the requested June 2026 baseline. Microsoft's [background-job
guidance](https://learn.microsoft.com/en-us/azure/architecture/best-practices/background-jobs)
identifies data-retention cleanup as schedule-driven work, requires idempotency
when schedulers can overlap, and recommends durable state for recovery.
Microsoft's [asynchronous messaging guidance](https://learn.microsoft.com/en-us/azure/architecture/guide/technology-choices/messaging)
also requires consumers to tolerate repeated delivery without changing the
result. OWASP's [Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
states that retained records must not be removed before their required duration
or kept beyond it.

## Options Considered

### Delete Every Old Circuit and Clean Outbox Rows Later

Pros: simple initial SQL.

Cons: can remove active recovery state and, because sibling modifying CTEs use
one snapshot, leaves terminal outbox rows for a later run. Rejected.

### Retain Every Circuit Until Manual Cleanup

Pros: avoids premature deletion.

Cons: retains operational failures indefinitely, increases storage and audit
noise, and creates a manual maintenance dependency. Rejected.

### Materialized Retention Set With Atomic Terminal Cleanup

Pros: keeps active recovery and current source revisions, removes obsolete
closed state and terminal history together, remains idempotent across repeated
scheduler runs, and needs no browser or operator action. Selected.

Cons: retained active circuits can outlive their ordinary retention period
until recovery resolves or another lifecycle path makes them inactive.

## Final Recommendation Stack

1. Run retention cleanup as server-owned background work, never from the UI.
2. Retain all `open` and `half_open` circuit rows as active recovery state.
3. Retain any circuit with pending or processing outbox work for the same base
   source revision.
4. Retain explicitly protected current source revisions supplied by planning.
5. Retain recent rows until the configured 30-day window has elapsed.
6. Materialize the retained-set decision and use it for circuit and terminal
   outbox deletion in the same SQL statement.
7. Delete only terminal `completed` or `failed` outbox rows after the same
   eligibility check.

## Implementation Outcome

`policyNativeProfileRefreshCircuitCompactionRepository.mjs` now builds a
materialized `retained_circuits` CTE. The compactor deletes only circuit rows
outside that set, then deletes expired terminal outbox rows that have neither a
retained circuit nor a protected revision. This corrects the prior behavior
where an obsolete circuit could be deleted in one CTE while its terminal outbox
row survived until a later cleanup pass.

The PostgreSQL integration test creates six isolated revisions: expired
inactive, active open, active half-open with a pending probe, closed with a
pending successor, protected closed, and recent closed. It proves the one
obsolete circuit and its terminal row are removed together, while all five
retained categories remain untouched.

## Security Outcome

- Retention rules, source identity, and protected revisions remain server-owned.
- Active automatic recovery cannot be removed merely because a scheduler was
  delayed beyond the retention window.
- Terminal history is deleted only after its configured duration and only when
  no active or protected state depends on it.
- A single atomic statement prevents partial cleanup from exposing browser or
  operator recovery controls.
- The test uses isolated database rows and removes them after every run.

## Verification

Run the focused compaction and lifecycle integration suites with:

```powershell
cd server
node ./scripts/run-jest.mjs -c jest.integration.config.mjs --runInBand --no-coverage --runTestsByPath src/__tests__/integration/policy-native-profile-refresh-circuit-compaction.test.mjs src/__tests__/integration/policy-native-profile-refresh-circuit-lifecycle.test.mjs
```

## Next Step

Add concurrent planner-and-compaction interleaving integration coverage. It
must prove an overlapping scheduler cannot compact a current source revision
while another scheduler is planning its active recovery work.
