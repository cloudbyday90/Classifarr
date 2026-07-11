# Policy Runtime Metrics And Decision Trace

## Status

Implemented as the durable runtime metrics and decision trace contract.

This projection turns automation decisions, runtime question plans,
request-time learning decisions, rebuild proposals, migration verifier
reports, and rebuild lifecycle events into bounded counters, sanitized trace
records, and action-oriented operator summaries. Trace records retain
supported upstream source fingerprints for correlation without copying raw
evidence. It does not persist telemetry, export to an observability backend,
expose raw provider payloads, or surface diagnostic internals as normal policy
UI.

Metrics construction now separates raw runtime adaptation from the
decision-only aggregation reducer. The reducer accepts a valid normalized
metrics-input contract; raw source records are reduced to allowlisted state,
reason, and fingerprint fields before aggregation.

## Problem

Classifarr now has deterministic contracts for runtime evidence, automation,
questions, request-time learning, rebuild proposals, and migration verification.
Without a bounded metrics contract, the next failure mode is predictable:

```text
too many internal panels
raw replay/provider payloads in logs
prompt or embedding leakage
unclear counts for automation vs review
broken correlation between metrics and source decisions
operators seeing diagnostics instead of next action
```

The runtime metrics trace makes runtime behavior auditable while keeping the operator workflow
small and action-oriented.

## Official Guidance Reviewed

- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)
  emphasize stable attribute naming and common telemetry structure. The runtime
  metrics trace emits stable `classifarr.policy.runtime_metrics_trace.*`
  attributes for future telemetry
  wiring.
- [OpenTelemetry Signals](https://opentelemetry.io/docs/concepts/signals/)
  separates traces, metrics, and logs. This contract keeps counters and trace
  records as a local projection and does not conflate them with raw logs.
- [OpenTelemetry Context Propagation](https://opentelemetry.io/docs/concepts/context-propagation/)
  explains that propagated context lets traces, logs, and metrics be correlated.
  The runtime metrics trace preserves only approved source fingerprints for
  correlation.
- [W3C Trace Context](https://www.w3.org/TR/trace-context/)
  defines portable trace context propagation. The runtime metrics trace does not export
  W3C spans yet, but follows the same principle: carry stable correlation
  identifiers without embedding payload data.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  warns against logging sensitive data and recommends event attributes useful
  for monitoring and response. The runtime metrics trace suppresses provider
  payloads, prompts, embeddings, raw payloads, and diagnostic internals.
- [NIST Privacy Framework](https://www.nist.gov/privacy-framework)
  emphasizes managing privacy risk and minimizing unnecessary data exposure.
  This contract records bounded counts and reason codes instead of user prompts,
  provider bodies, or embeddings.

## Recommendation

Use a server-owned metrics and trace projection that consumes policy runtime contracts
and emits only bounded counters, reason-coded traces, and operator next-action
summaries.

The projection should answer:

```text
How many items auto-routed?
How many classified without routing?
How many need review, routing, or profile refresh?
How many learning decisions were allowed, blocked, or downgraded?
How many rebuilds were accepted, rejected, or rolled back?
Which bounded reason codes explain each outcome?
Which safe upstream source fingerprint, if any, links this trace back to the
source decision?
What operator action, if any, follows from the counts?
Was any sensitive/raw diagnostic data exposed?
```

## Pros And Cons

Pros:

- Gives runtime/rebuild behavior auditable counters.
- Keeps trace records bounded and reason-coded.
- Preserves safe source-fingerprint correlation for automation, question,
  request-learning, rebuild-proposal, and migration-verifier outputs.
- Prevents raw payload, prompt, embedding, provider, or diagnostic leakage.
- Produces operator summaries only when they support a next action.
- Creates a stable handoff to runtime and rebuild test reset.

Cons:

- Does not yet persist metrics or export to OpenTelemetry.
- Later integration must decide retention and transport.
- Counts are only as complete as the policy runtime contract events passed into
  the projection.
- Source correlation is intentionally limited to known SHA-256 fingerprint
  attributes and derived rebuild fingerprint-set digests; unsupported ad hoc
  trace fields are ignored.

## Final Recommendation Stack

1. Count only known policy runtime outcomes:
   - auto-routed,
   - classified-not-routed,
   - asked-for-review,
   - blocked-by-hard-limit,
   - missing-routing,
   - stale-profile retry,
   - learning allowed/blocked/downgraded,
   - rebuild accepted/rejected/rolled back.
2. Emit trace records with stable component ids:
   - `automation_decision`,
   - `question_reduction`,
   - `request_learning`,
   - `rebuild_proposal`,
   - `migration_verifier`,
   - `rebuild_event`.
3. Limit emitted trace records with `maxTraceRecords`.
4. Limit trace reason codes to bounded arrays.
5. Carry only supported upstream source fingerprints into trace attributes:
   - automation evidence projection fingerprint,
   - question decision-evidence fingerprint,
   - request-learning upstream evidence fingerprint,
   - derived rebuild guarded-outcome fingerprint-set digest,
   - migration-verifier sample-set fingerprint.
6. Validate that source fingerprints are SHA-256 digests and match trace
   attributes.
7. Suppress raw payloads, prompts, embeddings, provider payloads, and diagnostic
   internals.
8. Surface only action-oriented operator summaries.
9. Leave persistence, retention, and OpenTelemetry export to a later integration
   slice.
10. Require normalized metrics input before aggregating counters or traces;
    preserve sensitive input only as a suppression marker.

## Implemented Files

- Runtime metrics and trace contract:
  `server/src/services/policyRuntimeMetricsTrace.mjs`
- Runtime metrics-input normalizer:
  `server/src/services/policyRuntimeMetricsInput.mjs`
- Metrics input-boundary outcome:
  `docs/architecture/policy-runtime-metrics-input-boundary.md`
- Focused tests:
  `server/src/__tests__/services/policyRuntimeMetricsTrace.test.mjs`
- Automation decision dependency:
  `server/src/services/policyAutomationDecisionContract.mjs`
- Runtime question dependency:
  `server/src/services/policyRuntimeQuestionReduction.mjs`
- Request learning dependency:
  `server/src/services/policyRequestTimeLearning.mjs`
- Rebuild proposal dependency:
  `server/src/services/policyLibraryPolicyRebuild.mjs`
- Migration verifier dependency:
  `server/src/services/policyMigrationVerifierRollback.mjs`
- Roadmap owner:
  Runtime Metrics And Decision Trace in
  `docs/architecture/policy-builder-intent-model-roadmap.md`

## Implemented Contract

The service exports:

- `POLICY_RUNTIME_METRIC_AUDIT_RISK_IDS`
- `POLICY_RUNTIME_METRIC_COMPONENT_IDS`
- `POLICY_RUNTIME_METRIC_COUNTER_IDS`
- `POLICY_RUNTIME_METRIC_REASON_IDS`
- `POLICY_REBUILD_EVENT_STATUS_IDS`
- `buildPolicyRuntimeMetricsTraceFromMetricsInput`
- `buildPolicyRuntimeMetricsTraceFromRuntimeInput`
- `buildPolicyRuntimeMetricsTraceAudit`
- `validatePolicyRuntimeMetricsTrace`

## Security And Data Handling

- The projection does not call providers.
- The projection does not persist metrics.
- The projection does not export telemetry.
- Trace records suppress raw payloads, prompts, embeddings, provider payloads,
  replay payloads, impact preview payloads, and diagnostic internals.
- Trace records can carry supported upstream SHA-256 source fingerprints for
  correlation, with the originating source attribute name mirrored in bounded
  trace attributes.
- Rebuild proposal traces derive a SHA-256 fingerprint-set digest from
  sanitized guarded-outcome fingerprints and request-proof counts; they do not
  copy library labels, item titles, raw evidence, or request payloads.
- Validation rejects malformed or mismatched source fingerprints.
- Operator summaries require action ids and labels.
- Security flags must remain false for exposed sensitive data categories.

## Test Coverage

The focused test suite verifies:

- all required runtime counters are counted from contract outcomes,
- trace records are bounded by `maxTraceRecords`,
- trace reason arrays are bounded,
- supported upstream source fingerprints are carried into bounded trace
  attributes,
- rebuild proposal source correlation uses a derived guarded-outcome
  fingerprint-set digest,
- malformed or mismatched source fingerprints fail validation,
- raw payloads, prompts, embeddings, provider payloads, and diagnostic internals
  are suppressed,
- operator summaries are action-oriented,
- unknown/negative/non-integer counters fail validation,
- sensitive trace exposure fails validation,
- trace summary mismatches fail validation,
- the component audit points to `nextStep.stepId = runtime_rebuild_test_reset`.

## Outcome

The runtime metrics trace gives runtime/rebuild observability this shape:

```text
policy runtime contract outputs
  -> bounded counters
  -> sanitized trace records with supported source-fingerprint correlation
  -> action-oriented operator summaries
  -> no persistence/export side effects
```

This makes policy runtime behavior auditable without reintroducing noisy
diagnostic UI.

## Next Step

Runtime And Rebuild Test Reset should categorize old runtime and rebuild tests,
then define the regression coverage that protects the new evidence, automation,
question, learning, rebuild, verifier, rollback, and metrics contracts.
