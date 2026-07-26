# Policy Native Pending Route-Outcome Learning Intake Adoption

## Status

Implemented as Phase 6R.3.2d. Native pending route outcomes now build a
canonical learning intake before they evaluate the outcome-only learning guard.

## Problem

The native pending route-outcome adapter already derives a bounded terminal
route event after browser or Discord routing returns. It previously rebuilt
guard input directly from that event, leaving a second source/outcome/final
outcome normalization path outside the canonical intake contract.

## Research Inputs

Official sources reviewed July 2026 against the requested June 2026 baseline:

- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-derived security-relevant state and explicit workflow
  transitions. The adapter accepts a terminal route result only after it
  derives the classification, destination, event type, and source event on the
  server.
- [OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
  requires server-side authorization and a final execution control. This pure
  reducer does not authorize or execute routing; future durable persistence
  must still revalidate state and idempotency at its transaction boundary.
- [OpenTelemetry General Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/general/)
  distinguish semantic event records from unbounded diagnostic data. The
  adapter retains stable terminal event IDs and a bounded correlation while
  excluding raw Arr errors and transport metadata.
- [NIST SP 800-218 Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports testable secure-development practices. Focused route, persistence,
  and audit tests verify the intake gate without changing route behavior.

## Design

```text
server-validated native resolution + terminal routing result
  -> policy.request_time_event.v1
  -> policy.learning_intake.v1 with sourceEventId
  -> intake validation
  -> policy.learning_guard.v1
  -> compact terminal outcome and guarded persistence wrapper
```

The existing route event supplies `classification:<classification id>` as the
source-event identifier. The intake derives its source, answer outcome,
question frame, destination, route state, and final outcome from that trusted
event. The adapter publishes a compact intake summary only; it does not expose
raw routing errors, media titles, actor data, provider payloads, or AI output.

`route_succeeded` and `route_failed_missing_mapping` remain distinct terminal
states. Both use `do_not_learn`, so neither may produce durable learning or a
profile refresh. A missing mapping remains an operational final outcome rather
than evidence that an item belongs in a destination.

## Recommendations

1. Require canonical intake before every terminal route-outcome guard call;
   do not reconstruct a route-specific guard payload.
2. Retain `policyRequestTimeEvent.mjs` as the sole terminal-route state
   normalizer, including its bounded source-event identifier.
3. Keep route failure and route success outcome-only until the later
   persistence transaction explicitly authorizes a different behavior.
4. Keep raw Arr diagnostics in operational logging only, never in intake,
   outcome history, or learning context.
5. Treat a malformed intake as fail closed and block the wrapper from writing
   an outcome transition.

## Pros And Cons

### Pros

- Removes direct guard-input shaping from the native terminal-route adapter.
- Aligns route success and missing-mapping transitions with the shared intake
  contract used by the other adopted source adapters.
- Preserves terminal-route classification, bounded outcome history, and
  idempotent persistence behavior.
- Audits malformed internal intake before any compact transition is written.

### Cons

- The request-import fallback still has a separate direct guard call and must
  be adopted independently.
- Source-event correlation is not a substitute for the future transaction's
  unique persistence key and current-state check.
- Invalid internal intake produces a blocked outcome transition instead of
  attempting to infer intent from raw routing diagnostics.

## Final Recommendation Stack

1. `policyNativePendingResolutionProvenance.mjs` supplies server-validated
   destination context.
2. `policyRequestTimeEvent.mjs` normalizes terminal route state and source
   correlation.
3. `policyLearningIntakeContract.mjs` validates the canonical route handoff.
4. `policyLearningGuard.mjs` enforces the outcome-only learning decision.
5. `policyNativePendingRouteOutcome.mjs` returns bounded audited provenance.
6. `policyNativePendingRouteOutcomePersistence.mjs` writes only an audited
   compact transition; Phase 6R.3.3 later supplies unified authorization and
   transactional idempotency.

## Security Outcome

- Browser and Discord data cannot choose a source, event type, destination,
  answer outcome, or final route status.
- The guard cannot run without valid canonical intake and event correlation.
- Route success and missing mapping cannot create learning, refresh work,
  provider activity, quota reads, or a new route action.
- Invalid intake and raw routing diagnostics cannot become durable policy
  evidence.

## Verification

Focused tests cover route success, normalized missing mapping, non-terminal
failure rejection, compact patch redaction, invalid intake audit rejection, and
persistence behavior. The adapter and persistence suites remain separate so
the pure intake gate and durable outcome wrapper can be verified independently.

## Next Step

Proceed to **Phase 6R.3.2e: Request-Import Fallback Intake Adoption**. Replace
that remaining direct routing guard-input construction before beginning the
Discord answer adapter.
