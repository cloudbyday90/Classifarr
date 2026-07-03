# Policy Runtime Question Reduction Module Cutover

## Status

Implemented as a Phase 9R durable module-name cutover for runtime question
reduction.

This change does not wire new pending-question behavior. It removes temporary
roadmap naming from the production question-reduction contract while preserving
the existing side-effect-free validation boundary.

## Official Guidance Reviewed

- [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
  identifies prompt injection, insecure output handling, excessive agency, and
  overreliance as core LLM application risks. Runtime questions remain
  deterministic, bounded, and server-owned rather than model-authored.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends syntactic and semantic validation plus allow-listed values.
  Runtime question dispositions, reason ids, frames, and learning flags remain
  allow-listed.
- [Microsoft Human-AI Experience Guidelines](https://www.microsoft.com/en-us/haxtoolkit/ai-guidelines/)
  emphasize clear user control and useful feedback. The reducer continues to
  ask about destination fit or concrete next action, not internal diagnostics.
- [NIST Generative AI Profile](https://csrc.nist.gov/pubs/ai/600/1/final)
  emphasizes governance, measurement, and risk controls. The reducer keeps
  automation state, question shape, final outcome, and learning eligibility
  separate.
- [OpenTelemetry Naming](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  supports consistent semantic naming. The contract keeps bounded
  `classifarr.runtime.question.*` attributes and moves its payload version into
  the durable `policy.runtime_question_reduction.v1` namespace.

## Recommendation

Keep runtime question reduction as a durable runtime primitive:

```text
policy automation decision
  -> runtime question reduction
  -> request-time learning
```

The reducer should be product-domain code because it is a permanent runtime
gate, not a temporary roadmap artifact.

## Pros And Cons

Pros:

- Removes a phase-coded production module and focused test name.
- Moves the question-reduction payload version to a durable `policy.*`
  namespace.
- Keeps runtime question planning side-effect-free.
- Keeps stale/legacy question cleanup, routing gaps, and learning eligibility
  explicit.

Cons:

- Leaves request-time learning, rebuild, migration verifier, metrics, and test
  reset modules phase-coded until later cutover slices.
- Requires downstream consumers to import the renamed contract.

## Final Implementation Stack

1. Rename the service to `policyRuntimeQuestionReduction.mjs`.
2. Rename the focused test to `policyRuntimeQuestionReduction.test.mjs`.
3. Rename exported constants and builders to `POLICY_RUNTIME_QUESTION_*` and
   `buildPolicyRuntimeQuestionReduction*`.
4. Move the contract version to `policy.runtime_question_reduction.v1`.
5. Replace the contract-local audit handoff with `nextStep.stepId =
   request_time_learning`.
6. Keep the Phase 7R completion audit mapping as a compatibility adapter for
   the broader roadmap completion gate.
7. Update direct runtime consumers, docs, changelog, and naming regression
   baseline after inventory validation proves the count decreased.

## Security Boundary

- The reducer does not call providers.
- The reducer does not persist questions.
- The reducer does not write learning or policy changes.
- Runtime question plans cannot authorize durable learning directly.
- Stale or legacy questions must go through cleanup before answer or learning.
- Trace output uses bounded reason codes and fingerprints, not provider
  payloads, prompts, AI text, replay diagnostics, or raw evidence labels.

## Outcome

Runtime question reduction now uses durable production naming while preserving
the same deterministic dispositions, validation checks, and bounded trace
shape. Completion-audit, request-time learning, metrics, decision inventory,
and rebuild test reset consumers now import the durable runtime question
contract.

## Validation

Validation should include:

```text
cd server
node ../scripts/run-jest.mjs --testPathPatterns="policyRuntimeQuestionReduction|policyBuilderPhase7RequestTimeLearning|policyBuilderPhase7RuntimeMetricsTrace|policyBuilderPhase7CompletionAudit|policyRuntimeDecisionInventory|policyBuilderPhase7RuntimeRebuildTestReset|policyProductionNamingRegressionAudit" --no-coverage --runInBand
npm run lint:docs
npm --prefix server run lint:security -- --quiet
node scripts/generate-policy-builder-production-name-inventory.mjs --require-valid
npm --prefix server run test:unit -- --no-coverage --runInBand
```

## Next Step

Cut over Request-Time Learning And Destination Selection to a durable
product-domain module name because it directly consumes runtime question
reduction and still carries Phase 7R production naming.
