# Policy Runtime Metrics And Decision Trace Module Cutover

## Status

Implemented as the durable module-name cutover for runtime metrics and decision
trace projection.

This change does not persist telemetry, export spans, or add an observability
backend. It removes temporary roadmap naming from the production metrics/trace
contract while preserving bounded counters, sanitized traces, and action-only
operator summaries.

## Official Guidance Reviewed

- [OpenTelemetry Naming](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  requires precise names composed from lowercase letters, numbers, underscores,
  and dots as namespace delimiters. Runtime trace attributes now use the durable
  `classifarr.policy.runtime_metrics_trace.*` namespace.
- [OpenTelemetry Metrics Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/general/metrics/)
  recommends understandable metric names and alignment with the general naming
  guidelines. The counter ids remain stable product outcomes rather than
  roadmap checkpoint labels.
- [W3C Trace Context](https://www.w3.org/TR/trace-context/)
  standardizes request correlation context for distributed tracing. Classifarr
  does not export W3C spans here, but the local trace projection follows the
  same principle by carrying bounded correlation fingerprints instead of raw
  payloads.
- [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
  highlights sensitive information disclosure, improper output handling,
  excessive agency, and vector/embedding weaknesses. The metrics trace rejects
  raw payloads, prompts, embeddings, provider payloads, and diagnostic internals.
- [NIST Generative AI Profile](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence)
  emphasizes governed measurement and lifecycle risk controls for generative AI
  systems. The projection keeps measurement, source fingerprints, security
  suppression, and operator next actions separated.

## Recommendation

Keep runtime metrics and decision traces as a durable projection primitive:

```text
migration verifier and rollback path
  -> runtime metrics and decision trace
  -> runtime and rebuild test reset
```

The projection should be product-domain code because it is the permanent
measurement boundary for automation, review, learning, rebuild, rollback, and
migration outcomes.

## Pros And Cons

Pros:

- Removes a phase-coded production module and focused test name.
- Moves the metrics payload version to `policy.runtime_metrics_trace.v1`.
- Moves trace attributes to the durable
  `classifarr.policy.runtime_metrics_trace.*` namespace.
- Keeps traces bounded, reason-coded, and free of raw provider or AI payloads.
- Preserves the completion-audit roadmap checkpoint through a small adapter.

Cons:

- Leaves native intent storage readiness architecture naming for a later
  cutover slice.
- Does not persist or export telemetry; transport and retention remain later
  integration work.
- Requires downstream consumers to import the renamed metrics contract.

## Final Implementation Stack

1. Rename the service to `policyRuntimeMetricsTrace.mjs`.
2. Rename the focused test to `policyRuntimeMetricsTrace.test.mjs`.
3. Rename exported constants and builders to `POLICY_RUNTIME_METRIC_*` and
   `buildPolicyRuntimeMetricsTrace*`.
4. Move the payload version to `policy.runtime_metrics_trace.v1`.
5. Move trace attributes to `classifarr.policy.runtime_metrics_trace.*`.
6. Move the rebuild fingerprint-set version to
   `policy.library_policy_rebuild_guarded_outcome_fingerprint_set.v1`.
7. Replace the contract-local audit handoff with
   `nextStep.stepId = runtime_rebuild_test_reset`.
8. Use the runtime completion audit to verify the semantic `nextStep` handoff sequence.
9. Update direct runtime consumers, docs, changelog, and naming regression
   baseline after inventory validation proves the count decreased.

## Security Boundary

- The projection does not call providers.
- The projection does not persist metrics.
- The projection does not export telemetry.
- The projection does not write policies, learning, routing, or rollback state.
- Trace records can carry only supported SHA-256 source fingerprints.
- Raw payloads, prompts, embeddings, provider payloads, replay payloads, impact
  preview payloads, and diagnostic internals remain validation failures.
- Operator summaries require explicit action ids and labels.

## Outcome

Runtime metrics and decision trace now uses durable production naming while
preserving the same deterministic counters, bounded trace records, source
fingerprint validation, security suppression checks, and operator summary
shape. Completion-audit, decision inventory, and runtime/rebuild test reset
consumers now import the durable metrics contract.

## Related Active Architecture

- Active architecture:
  [Policy Runtime Metrics And Decision Trace](policy-runtime-metrics-trace.md)
- Architecture cutover:
  [Policy Runtime Metrics And Decision Trace Architecture Cutover](policy-runtime-metrics-trace-architecture-cutover.md)

## Validation

Validation should include:

```text
cd server
node ../scripts/run-jest.mjs --testPathPatterns="policyRuntimeMetricsTrace|policyRuntimeCompletionAudit|policyRuntimeDecisionInventory|policyRuntimeRebuildTestReset|policyProductionNamingRegressionAudit" --no-coverage --runInBand
npm run lint:docs
npm --prefix server run lint:security -- --quiet
node scripts/generate-policy-builder-production-name-inventory.mjs --require-valid
npm --prefix server run test:unit -- --no-coverage --runInBand
```

## Next Step

Continue with native intent storage readiness after runtime cutover records are
durable.
