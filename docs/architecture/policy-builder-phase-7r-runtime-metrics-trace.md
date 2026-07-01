# Policy Builder Phase 7R Runtime Metrics And Decision Trace

## Status

Implemented as the eighth Phase 7R runtime/rebuild contract.

This slice projects Phase 7R automation decisions, runtime question plans,
request-time learning decisions, rebuild proposals, migration verifier reports,
and rebuild lifecycle events into bounded counters, sanitized trace records, and
action-oriented operator summaries. It does not persist telemetry, export to an
observability backend, expose raw provider payloads, or surface diagnostic
internals as normal policy UI.

## Problem

Phase 7R now has deterministic contracts for runtime evidence, automation,
questions, request-time learning, rebuild proposals, and migration verification.
Without a bounded metrics contract, the next failure mode is predictable:

```text
too many internal panels
raw replay/provider payloads in logs
prompt or embedding leakage
unclear counts for automation vs review
operators seeing diagnostics instead of next action
```

Phase 7R.8 makes runtime behavior auditable while keeping the operator workflow
small and action-oriented.

## Official Guidance Reviewed

- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)
  emphasize stable attribute naming and common telemetry structure. Phase 7R.8
  emits stable `classifarr.phase7r.trace.*` attributes for future telemetry
  wiring.
- [OpenTelemetry Signals](https://opentelemetry.io/docs/concepts/signals/)
  separates traces, metrics, and logs. This slice keeps counters and trace
  records as a local projection and does not conflate them with raw logs.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  warns against logging sensitive data and recommends event attributes useful
  for monitoring and response. Phase 7R.8 suppresses provider payloads, prompts,
  embeddings, raw payloads, and diagnostic internals.
- [NIST Privacy Framework](https://www.nist.gov/privacy-framework)
  emphasizes managing privacy risk and minimizing unnecessary data exposure.
  This contract records bounded counts and reason codes instead of user prompts,
  provider bodies, or embeddings.

## Recommendation

Use a server-owned metrics and trace projection that consumes Phase 7R contracts
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
What operator action, if any, follows from the counts?
Was any sensitive/raw diagnostic data exposed?
```

## Pros And Cons

Pros:

- Gives runtime/rebuild behavior auditable counters.
- Keeps trace records bounded and reason-coded.
- Prevents raw payload, prompt, embedding, provider, or diagnostic leakage.
- Produces operator summaries only when they support a next action.
- Creates a stable handoff to Phase 7R.9 test reset.

Cons:

- Does not yet persist metrics or export to OpenTelemetry.
- Later integration must decide retention and transport.
- Counts are only as complete as the Phase 7R contract events passed into the
  projection.

## Final Recommendation Stack

1. Count only known Phase 7R outcomes:
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
5. Suppress raw payloads, prompts, embeddings, provider payloads, and diagnostic
   internals.
6. Surface only action-oriented operator summaries.
7. Leave persistence, retention, and OpenTelemetry export to a later integration
   slice.

## Implemented Files

- Runtime metrics and trace contract:
  `server/src/services/policyBuilderPhase7RuntimeMetricsTrace.mjs`
- Focused tests:
  `server/src/__tests__/services/policyBuilderPhase7RuntimeMetricsTrace.test.mjs`
- Automation decision dependency:
  `server/src/services/policyBuilderPhase7AutomationDecisionContract.mjs`
- Runtime question dependency:
  `server/src/services/policyBuilderPhase7RuntimeQuestionReduction.mjs`
- Request learning dependency:
  `server/src/services/policyBuilderPhase7RequestTimeLearning.mjs`
- Rebuild proposal dependency:
  `server/src/services/policyBuilderPhase7LibraryPolicyRebuild.mjs`
- Migration verifier dependency:
  `server/src/services/policyBuilderPhase7MigrationVerifierRollback.mjs`
- Roadmap owner:
  Phase 7R.8 Runtime Metrics And Decision Trace in
  `docs/architecture/policy-builder-intent-model-roadmap.md`

## Implemented Contract

The service exports:

- `PHASE7R_METRIC_AUDIT_RISK_IDS`
- `PHASE7R_METRIC_COMPONENT_IDS`
- `PHASE7R_METRIC_COUNTER_IDS`
- `PHASE7R_METRIC_REASON_IDS`
- `PHASE7R_REBUILD_EVENT_STATUS_IDS`
- `buildPolicyBuilderPhase7RuntimeMetricsTrace`
- `buildPolicyBuilderPhase7RuntimeMetricsTraceAudit`
- `validatePolicyBuilderPhase7RuntimeMetricsTrace`

## Security And Data Handling

- The projection does not call providers.
- The projection does not persist metrics.
- The projection does not export telemetry.
- Trace records suppress raw payloads, prompts, embeddings, provider payloads,
  replay payloads, impact preview payloads, and diagnostic internals.
- Operator summaries require action ids and labels.
- Security flags must remain false for exposed sensitive data categories.

## Test Coverage

The focused test suite verifies:

- all required Phase 7R counters are counted from contract outcomes,
- trace records are bounded by `maxTraceRecords`,
- trace reason arrays are bounded,
- raw payloads, prompts, embeddings, provider payloads, and diagnostic internals
  are suppressed,
- operator summaries are action-oriented,
- unknown/negative/non-integer counters fail validation,
- sensitive trace exposure fails validation,
- trace summary mismatches fail validation,
- the component audit points to Phase 7R.9.

## Outcome

Phase 7R.8 gives runtime/rebuild observability this shape:

```text
Phase 7R contract outputs
  -> bounded counters
  -> sanitized trace records
  -> action-oriented operator summaries
  -> no persistence/export side effects
```

This makes Phase 7R auditable without reintroducing noisy diagnostic UI.

## Next Step

Phase 7R.9 Runtime And Rebuild Test Reset should categorize old runtime and
rebuild tests, then define the regression coverage that protects the new
evidence, automation, question, learning, rebuild, verifier, rollback, and
metrics contracts.
