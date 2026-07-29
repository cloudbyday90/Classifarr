# Native Profile Recovery Circuit Status Projection

## Decision

The persisted native-policy readiness view reports a durable native
profile-refresh circuit only as one fixed, read-only state:
`awaiting_automatic_probe`.

The state is valid only when all of the following are true:

1. Cached profile evidence needs automatic recovery.
2. No active profile-refresh outbox work already explains the recovery state.
3. The existing scheduler-candidate query finds the exact current library
   source revision.
4. The durable circuit for that library and exact source revision is valid and
   `open` or `half_open`.

The browser receives a fixed label and message. It never receives the circuit
state, failure code, cooldown time, outbox identifier, retry count, or a
retry/reset action.

## Research

Research was retrieved from official sources on 28 July 2026, newer than the
requested June 2026 baseline. W3C's [ARIA22: Using
`role=status`](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22) describes
a status message as a non-interruptive update that assistive technology can
announce without moving focus. WAI-ARIA defines `status` with polite, atomic
live-region semantics in the [status role
definition](https://www.w3.org/TR/wai-aria/#status). WCAG 2.1 Success
Criterion [4.1.3 Status Messages](https://www.w3.org/TR/WCAG21/#status-messages)
requires status messages to be programmatically determinable without a focus
change.

These sources support a persistent `role="status"`, explicit
`aria-live="polite"`, explicit `aria-atomic="true"`, fixed plain-language
copy, and no automatic focus move. They do not support exposing debugging data
or requiring an operator to drive a scheduler-owned retry loop.

## Options Considered

### Return the Raw Circuit Row to the Browser

Pros: exposes exact operational diagnostics.

Cons: leaks internal failure and timing details, couples the UI to runtime
storage, invites retry/reset controls, and makes the contract difficult to
evolve. Rejected.

### Read Any Circuit for the Library

Pros: one small lookup.

Cons: an obsolete circuit could incorrectly label a newer library profile
revision as waiting. Rejected.

### Let the Browser Infer Circuit State or Poll for a Probe

Pros: no additional summary read.

Cons: creates tab-dependent behavior, adds a timer and error surface, and
turns scheduler status into browser-owned logic. Rejected.

### Project an Exact-Revision Fixed Status From the Server

Pros: preserves the durable circuit as the server authority, keeps active
outbox work more specific than a circuit wait, avoids stale revision labels,
and keeps the browser display-only. Selected.

Cons: requires an additional bounded stored-state lookup when recovery is
needed and active work is absent.

## Final Recommendation Stack

1. Reuse the scheduler's candidate repository to resolve the current
   library/source-revision identity; never accept a browser-provided revision.
2. Read active outbox work first and preserve `scheduled`, `queued`, or
   `processing` when it exists.
3. Read the circuit by exact library and source revision without a lock; this
   is a summary projection, not a scheduler transition.
4. Map only valid `open` and `half_open` circuits to
   `awaiting_automatic_probe`; map all other results to the existing scheduled
   state.
5. Keep circuit lookup optional. A lookup failure must retain the existing
   available readiness summary with scheduled recovery, not make the core read
   unavailable.
6. Fail closed in the server and client contracts, and render fixed copy in the
   persistent polite, atomic status component without controls.

## Implementation Outcome

`policyNativeProfileRefreshCandidateRepository.mjs` now supports an exact
single-library scheduler-candidate lookup. The readiness summary uses it only
after it has established stale or missing cached profile evidence and confirmed
that active outbox work is absent.

`policyNativeProfileRefreshCircuitRepository.mjs` now has a parameterized,
non-locking exact-circuit read. The summary derives the same source-event ID
that the scheduler uses and projects only the fixed recovery state. It never
copies the repository result into the response.

`policyNativeReadinessSummaryService.mjs` treats this as optional enrichment.
An unavailable candidate or circuit read keeps the established `scheduled`
state and does not expose the dependency error. The summary's side-effect
audit records only whether the circuit was successfully read.

The client allowlists the new state in both response validation and persisted
policy summary formatting. `PolicyNativeProfileRecoveryStatus.vue` uses an
amber visual treatment while retaining its existing `role="status"`, polite,
atomic announcement, and zero controls.

## Security Outcome

- Source revision and circuit keys are derived from stored scheduler data.
- SQL remains parameterized and the status read does not acquire a transition
  lock.
- Active outbox work wins over circuit status, preventing stale or less
  precise status from replacing known work.
- The public summary contains only an allowlisted state, label, message, and a
  boolean that a circuit was read; it contains no raw circuit row.
- The browser cannot enqueue, retry, reset, postpone, or otherwise mutate
  recovery state.

## Verification

Focused server tests cover exact candidate filtering, exact non-locking
circuit reads, valid open-circuit projection, active-outbox precedence,
source-event derivation, contract redaction, and optional-read fallback.
Focused client tests cover fail-closed state validation, persisted summary
formatting, live-region semantics, visual treatment, and the absence of
buttons or internal circuit terms.

## Next Step

Add a concurrent-planner integration case. It must prove that two scheduler
instances cannot create duplicate probes for the same due current circuit and
that readiness projects only the resulting server-owned state. The completed
source-revision isolation verification is documented in [Native Profile Refresh
Circuit Source-Revision
Integration](policy-native-profile-refresh-circuit-source-revision-integration.md).
