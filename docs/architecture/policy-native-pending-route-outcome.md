# Policy Native Pending-Route Outcome Adapter

## Status

Implemented for Phase 7R.5. This design follows native pending-resolution
provenance and records only the terminal result returned by the browser or
Discord routing adapter.

## Problem

Native pending resolution already records the operator's normalized selection
before routing begins. Browser and Discord then invoke different routing
adapters, but neither appends the actual route result to the same bounded
outcome path. As a result, a completed classification can be mistaken for a
successful route, while an absent Arr mapping can disappear into a log message.

The route adapter must distinguish these facts:

```text
operator selected a destination
classification resolution completed
Arr route succeeded
Arr route could not begin because mapping is missing
Arr route was skipped, invalid, or failed transiently
```

Only the third and fourth are terminal route outcomes. The fifth remains an
operational result and must not become policy evidence.

## Official Guidance Reviewed

- [OpenTelemetry event semantic conventions](https://opentelemetry.io/docs/specs/semconv/general/events/)
  define events as meaningful, timestamped state changes or outcomes in an
  asynchronous flow. Route success and a confirmed mapping gap therefore need
  their own transitions after routing returns; neither belongs on the earlier
  resolution transition.
- [OpenTelemetry semantic conventions](https://opentelemetry.io/docs/specs/semconv/)
  support common names and stable values that can be correlated across a code
  base. The adapter reuses the existing `route_succeeded` and
  `route_failed_missing_mapping` request-time event IDs instead of introducing
  transport-specific labels.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends consistent, testable event fields and verification that logging
  does not introduce unwanted side effects. The durable outcome contains
  bounded status, destination, and reason identifiers; it excludes raw Arr
  errors, media titles, operator identities, prompts, provider state, and
  quotas.
- [NIST AI RMF Playbook](https://airc.nist.gov/airmf-resources/playbook/)
  describes iterative risk management tailored to the deployment context. The
  route adapter keeps a missing configuration distinguishable from a failed
  match so later policy assessment can respond to the correct operational risk.

## Design

```text
native resolver
  -> native_pending_resolution transition
  -> resolved transition
  -> browser or Discord routing adapter returns actual result
  -> policyNativePendingRouteOutcome.mjs (pure)
       -> route_succeeded, or
       -> route_failed_missing_mapping
       -> outcome-only learning guard
  -> policyNativePendingRouteOutcomePersistence.mjs
  -> native_pending_route transition
```

`policyNativePendingRouteOutcome.mjs` accepts only the server-owned native
resolution provenance, classification ID, and the routing adapter's returned
result. It derives the destination from the already-validated resolution
selection; callers cannot supply a replacement destination or route event ID.

The pure adapter admits exactly two terminal cases:

1. `routed === true` becomes `route_succeeded`.
2. `reason` of `no_mapping` or `missing_arr_id` becomes
   `route_failed_missing_mapping` with the canonical `missing_mapping` reason.

Every other result is `not_applicable`, including `already_routed`, invalid
metadata, unsupported Arr type, missing media identifiers, thrown exceptions,
and generic Arr failures. Those are visible through existing operational logs
but do not create a policy route transition and cannot become positive
destination evidence.

The adapter builds the existing `policy.request_time_event.v1` record, which
normalizes a terminal route event as attempted even when the mapping preflight
prevented an outbound Arr request. Here, "attempted" means Classifarr reached
and evaluated the routing boundary; it does not claim a remote Arr API call.

The adapter always passes the normalized route event through the policy learning
guard with `do_not_learn`. It emits no policy evidence, profile refresh,
provider call, quota read, routing call, or persistence write itself. The thin
persistence wrapper appends a compact `native_pending_route` transition only
when the pure result passes audit. A persistence failure is logged and reported
to the caller but does not reverse an actual Arr route or alter its status.

## Security And Behavior Guarantees

1. The route event type and destination are server-derived; no browser or
   Discord label, identity, or interaction metadata can authorize them.
2. Completion of a classification does not imply route success. A transition is
   written only after a routing adapter returns an admitted terminal result.
3. A missing mapping is a negative operational outcome, never positive policy
   evidence.
4. Generic failures, malformed metadata, and exceptions remain non-terminal to
   avoid persisting misleading evidence from uncertain infrastructure state.
5. Durable fields are bounded enum IDs, destination IDs/names, normalized route
   state, guard summary, and reason codes. Raw errors and content are excluded.
6. Repeated delivery of the same terminal outcome is idempotent through the
   existing outcome-path identity and updates the latest transition rather than
   appending duplicate identical route events.

## Recommendations

1. Reuse `policyRequestTimeEvent.mjs` for route-state normalization; do not
   recreate missing-mapping logic in browser or Discord handlers.
2. Keep route-result persistence best-effort after the external route result:
   successful routing must not be reported as failed solely because telemetry
   persistence is temporarily unavailable.
3. Use one persistence wrapper for browser and Discord so both paths record
   identical event schemas and failure behavior.
4. Return a bounded persistence result for logs and tests, not raw failure
   details or the full classification payload.
5. Add focused tests for success, missing mapping, non-terminal failures,
   forged provenance, duplicate terminal outcomes, and non-fatal persistence
   failure.

## Pros And Cons

Pros:

- Preserves the difference between selection, resolution, successful routing,
  and mapping failure.
- Reuses existing request-time and outcome-path contracts.
- Provides identical automatic behavior for browser and Discord.
- Prevents transient operational failures from changing policy behavior.

Cons:

- Adds one outcome-history transition for each admitted native route result.
- Persistence occurs after external routing, so a telemetry write failure cannot
  be atomically rolled back with the Arr operation.
- Non-terminal routing errors require existing operational diagnostics rather
  than appearing as policy transitions.

## Final Recommendation Stack

1. `policyNativePendingResolutionProvenance.mjs` records the normalized
   selection before routing.
2. Browser and Discord routing adapters return their actual bounded routing
   result.
3. `policyNativePendingRouteOutcome.mjs` admits only terminal native route
   outcomes and applies the outcome-only guard.
4. `policyNativePendingRouteOutcomePersistence.mjs` appends the compact route
   transition through `classificationOutcomeService.mjs`.
5. Existing route logs retain non-terminal diagnostic detail without converting
   it into policy evidence.

## Verification

Focused server coverage proves:

- a successful browser or Discord route appends `route_succeeded` only after
  the route adapter returns;
- `no_mapping` and `missing_arr_id` append the canonical missing-mapping event;
- transient, invalid, exception, and already-routed states append nothing;
- the patch excludes raw errors and client-controlled data;
- browser and Discord use the shared persistence wrapper; and
- a failed outcome write does not change an already-observed route result.

The focused adapter, persistence, browser, and Discord suites verify 217
assertions. Server linting and static type checking also pass.

## Next Step

Complete **Phase 7R Completion Audit, Task 7R.10.1**: extend the request-time
learning component evidence and runtime/rebuild test-reset ownership to
explicitly inventory native pending-selection and native pending-route outcome
adapters. The audit must keep both transitions outcome-only and verify their
docs, services, and focused tests before Phase 8R storage work proceeds.
