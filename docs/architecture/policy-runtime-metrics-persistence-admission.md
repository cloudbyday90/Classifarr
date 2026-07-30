# Policy Runtime Metrics Persistence Admission

## Status

Implemented as the server-owned admission contract before any runtime metrics
storage or telemetry exporter is introduced.

The contract does not write a database record, emit an OpenTelemetry signal, or
add an operator setting. It accepts only the existing validated runtime-metrics
trace contract and returns either a fail-closed block or a minimized snapshot
that a future repository or exporter must revalidate.

## Problem

The runtime metrics projection safely produces bounded counters and traces, but
future observability wiring creates a different risk: a storage or export path
could bypass the projection's data minimization, ignore retention, or reattach
raw runtime input. A sink must not decide what it is allowed to retain.

The admission boundary separates those responsibilities:

```text
normalized runtime input
  -> runtime metrics trace projection
  -> persistence admission
  -> future repository or exporter
```

Only the final step may perform I/O, and only after receiving an admitted,
bounded snapshot.

## Official Guidance Reviewed

- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends sanitizing event data, excluding or masking sensitive data, and
  retaining logs only as long as required. This contract rejects raw payload,
  prompt, embedding, provider, and identity fields before a sink can receive a
  snapshot, and requires an expiration policy.
- [OpenTelemetry Logs Data Model](https://opentelemetry.io/docs/specs/otel/logs/data-model/)
  distinguishes stable named fields from flexible attributes. The admitted
  snapshot has a fixed, versioned schema instead of a pass-through attributes
  bag.
- [NIST SP 800-218, Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  calls for security requirements and verification throughout development. The
  contract is pure and focused tests prove both permitted and rejected inputs
  before any storage or exporter integration is allowed.

## Options

### Direct Database Writer

Pros:

- Persists metrics immediately.
- Can support historical reporting quickly.

Cons:

- Mixes validation, retention, and database concerns in one service.
- Makes an accidental raw-data write harder to test and prevent.
- Requires a migration, cleanup job, and backup policy before the data contract
  is stable.

### Immediate OpenTelemetry Export

Pros:

- Integrates with existing observability tooling.
- Avoids local telemetry storage.

Cons:

- Creates an external egress path before field and retention policy are proven.
- Requires transport authentication, retry, availability, and export failure
  handling.
- Cannot rely on a UI toggle as a security boundary.

### Admission-Only Boundary

Pros:

- Establishes one server-owned, fail-closed input contract for every future
  sink.
- Keeps only aggregate counters, trace totals, raw-data suppression count, and
  an integrity fingerprint.
- Enforces a 1-90 day retention range with a 30-day default before persistence
  exists.
- Keeps export disabled and creates no provider, routing, learning, profile, or
  storage side effect.
- Is small, ESM-native, and independently testable.

Cons:

- Does not yet make historical metrics queryable.
- A future sink must enforce physical expiry and transport controls using this
  admission output.

## Final Recommendation Stack

1. Require the exact current `policy.runtime_metrics_trace.v1` contract and its
   existing validation before admission.
2. Reject unsupported outer input and raw payload, prompt, embedding, provider,
   and identity fields anywhere in the candidate metrics object.
3. Admit only this fixed snapshot schema:
   - known aggregate counters,
   - total/emitted/truncated trace counts and the trace cap,
   - raw-payload suppression count,
   - a SHA-256 snapshot fingerprint.
4. Do not retain individual trace records, operator summaries, source
   fingerprints, item identifiers, library names, request data, or provider
   content.
5. Bind every admitted snapshot to `recorded_at` expiry with an explicit
   1-90 day policy and a 30-day default.
6. Keep telemetry export disabled at this boundary. A future exporter must
   accept only a revalidated admitted snapshot and must not receive a raw
   metrics object.
7. Keep the boundary side-effect-free and without operator controls. Retention
   enforcement and export enablement belong to a separately reviewed sink
   integration, not ordinary policy authoring.

## Implemented Contract

`server/src/services/policyRuntimeMetricsPersistenceAdmission.mjs` exports:

- versioned status, reason, and audit-risk identifiers,
- `buildPolicyRuntimeMetricsPersistenceAdmission`,
- `buildPolicyRuntimeMetricsPersistenceAdmissionAudit`, and
- `buildPolicyRuntimeMetricsPersistenceAdmissionAuditFromDefaultMetrics`.

Input is limited to:

```js
{
  metrics: validRuntimeMetricsTrace,
  retentionDays: 30,
}
```

Success returns a `ready` admission with a minimized snapshot, bounded
retention policy, disabled export declaration, all side-effect flags `false`,
and an audit. Invalid, unsupported, or sensitive input returns `blocked` with
no snapshot and no retention metadata.

## Security And Data Handling

- No database, filesystem, network, provider, routing, learning, profile, or
  policy write occurs.
- Telemetry export is always `{ enabled: false, statusId: 'disabled' }`.
- The snapshot schema is exact and fingerprinted; added fields and fingerprint
  mismatch fail audit.
- Sensitive nested keys are matched case-insensitively and block admission.
- The output deliberately excludes per-item traces and source fingerprints to
  reduce correlation and re-identification risk in retained telemetry.
- Retention is an admission rule only in this task. A later repository must
  physically expire accepted records and prove that behavior with integration
  tests before storage is enabled.

## Validation

Focused tests in
`server/src/__tests__/services/policyRuntimeMetricsPersistenceAdmission.test.mjs`
verify:

- valid minimized snapshot admission,
- default and bounded retention behavior,
- rejection of unsupported, raw, identity, and invalid metrics input,
- rejection of invalid retention values,
- rejection of snapshot tampering, exporter enablement, and reported side
  effects, and
- the explicit handoff to runtime/rebuild test-reset coverage.

The runtime completion audit and runtime/rebuild test-reset manifest also map
this service and focused ESM test as a required runtime contract.

## Outcome

Future metrics storage or OpenTelemetry work now has one mandatory input gate:

```text
validated metrics trace
  -> minimized admitted snapshot with bounded retention
  -> future revalidated sink
```

This adds no observability UI and no telemetry persistence. It prevents a
future sink from widening the data contract by accident.

## Next Step

Complete the Phase 7R runtime/rebuild test-reset and completion-audit handoff
with this admission contract included, then use the existing Phase 8R storage
closure work to decide whether a retained metrics repository is justified.
