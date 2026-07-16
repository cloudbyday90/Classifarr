# Native Intent Reconciliation Failure Attribution

## Status

Implemented as Phase 8R.3.2.6.1. This component closes the support-evidence
gap identified when automatic reconciliation reported a generic execution
failure while replacing the original exception with a logger-generated stack.

## Problem

Automatic native-intent reconciliation is server-owned and intentionally
hands-off. When it fails, operators need to know the safe stage, correlation,
and category without receiving raw policy data, SQL text, connection strings,
credentials, or stack traces.

Previously, the outer reconciliation catch block returned only a generic
`failed` result. It did not record a failed ledger header. It also called the
database logger without the caught error. The logger consequently created a
new stack at the logging call, which looked like the root cause but was only
the reporting location.

This component preserves the existing rule that a successful conversion cannot
be relabeled as failed if its later support write fails.

## Official-Source Research

Research reviewed in July 2026 against the requested June 2026 practices:

- [Node.js Errors](https://nodejs.org/api/errors.html) states that an error
  code is a more stable identifier than an error message. Classifarr uses
  stable codes only for internal categorization, never as an excuse to persist
  arbitrary exception details.
- [PostgreSQL Error Codes](https://www.postgresql.org/docs/16/errcodes-appendix.html)
  recommends applications test SQLSTATE rather than localized text. The
  reconciliation control already maps an allowlist of SQLSTATE and network
  codes to bounded system categories.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends structured event context while excluding secrets, database
  connection strings, passwords, tokens, stack traces, and unnecessary raw
  data.
- [NIST Log Management](https://csrc.nist.gov/Projects/log-management)
  emphasizes retaining the log data needed for operational and incident
  handling. A correlated failed-run header supplies that support value without
  copying the failing payload.

## Options Considered

### Persist The Caught Error And Stack

Pros:

- Highest immediate debugging detail.
- Does not need stage contracts.

Cons:

- Error messages and stacks can include credentials, database URLs, SQL,
  library names, filesystem paths, request details, or provider content.
- Makes the support database a second sensitive-data store.
- Error text is not a stable operational contract.

### Preserve The Generic Failure Only

Pros:

- Small and avoids raw exception material.

Cons:

- Cannot distinguish candidate discovery from conversion apply or state
  persistence.
- Produces a misleading synthetic logger stack.
- Leaves an aborted scheduler pass with no durable reconciliation record.

### Recommended: Bounded Stage Attribution And Failed-Run Evidence

Pros:

- Correlates the safe log row, public result, and durable ledger run with one
  server-generated UUID.
- Uses fixed stage IDs and fixed reason/category IDs rather than exception text.
- Preserves circuit-breaker classification from an internal code allowlist.
- Makes an aborted pass observable without retaining policy payloads or a
  second manual workflow.
- Requires no schema expansion because the run ledger already has a UUID,
  state, source status, reason, timestamps, and bounded counts.

Cons:

- Maintainers must add a stage wrapper when adding a new throw-capable
  reconciliation boundary.
- Detailed root-cause strings remain available only in transient local process
  diagnostics, not in the persistent product support record.

## Implemented Design

### Fixed Execution Stages

`nativeIntentReconciliationFailureAttribution.mjs` defines the only stages
that may leave the execution pipeline:

- operational control eligibility and lifecycle eligibility;
- candidate-input loading;
- candidate-report construction;
- lifecycle partitioning;
- reconciliation-state planning and initial persistence;
- dry-run construction;
- conversion apply; and
- post-apply state persistence.

Each boundary rethrows a static
`NativeIntentReconciliationExecutionStageError`. The wrapper copies only the
minimal internal fields needed by the existing circuit classifier. It never
copies the source message, stack, payload, `cause`, or arbitrary properties.

### Safe Failure Contract

The outer service produces a compact failure object:

- `stageId`, from the fixed allowlist;
- `reasonId`, such as `reconciliation_candidate_input_load_failed`;
- `categoryId`, such as `schema_incompatible` or
  `unexpected_execution_failure`;
- `systemFailureCategory`, only where the existing circuit breaker recognizes
  it; and
- `rawPayloadExposed: false`.

It generates a UUID correlation ID before execution. The ID is the ledger
`run_key`, the public run result correlation value, and structured log
metadata. It contains no user, policy, provider, or database information.

### Failed-Run Ledger Semantics

An outer execution abort now writes a run header with:

- `run_state = failed`;
- `source_status_id = failed`;
- the safe failure reason; and
- zero candidate outcomes when the process failed before candidates could be
  safely evaluated.

The ledger contract explicitly treats generic `failed` as failed rather than
mislabeling an empty run as `evaluated` with `no_candidates`. If the database
fault itself prevents ledger persistence, the returned result and structured
log still expose only `ledger_write_failed`; no unsafe fallback storage is
attempted.

### Logging Boundary

The logger now supports `persistStack: false`. Reconciliation uses it for
structured operational failures, storing `NULL` for `stack_trace` rather than
creating a synthetic stack at the logger call. Metadata is limited to the
correlation ID, stage, reason, category, status, ledger status, and the fixed
raw-payload marker.

The original exception remains internal to circuit classification. The control
receives its stable code/category only to decide whether a repeated systemic
failure should open the existing circuit. Unknown failures remain visible as
`unexpected_execution_failure` but do not automatically open the global
circuit.

## Security And Failure Handling

| Risk | Control |
| --- | --- |
| Database or provider errors contain credentials or connection details | The static stage wrapper drops message, stack, cause, and arbitrary error fields. |
| Logging creates a misleading stack after error handling | `persistStack: false` writes no synthetic stack for structured reconciliation failures. |
| A failed attempt has no durable support evidence | The service records a compact `failed` run with the same correlation UUID. |
| A database outage prevents both state and ledger writes | The result and stdout logger retain only bounded failure IDs; no unbounded fallback persistence occurs. |
| A policy-local blocker opens a global circuit | Only existing, allowlisted systemic categories reach circuit control. |
| A post-commit support write fails | Committed conversion status remains applied; only the support substatus is failed. |

## Verification

- Failure-attribution tests verify stable stage/category contracts and exclude
  password/API-key-like text.
- Execution-service tests verify candidate loading failure is statically staged
  without the underlying connection detail.
- Reconciliation-service tests verify a rejected gate records a correlated,
  sanitized failed ledger run and structured log record.
- Ledger-contract tests verify a generic aborted execution is `failed`, not an
  empty successful evaluation.
- Logger tests verify structured reconciliation errors can persist with a null
  stack trace.

## Result

Automatic conversion remains hands-off. Operators can now correlate a failed
scheduled pass and safely understand which reconciliation boundary failed,
while the existing circuit breaker can react only to known systemic categories.
The next component is the read-only reconciliation-status contract and
rate-limited alert evaluation in Phase 8R.3.2.6.2.
