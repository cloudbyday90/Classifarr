# Policy Request-Time Learning Module Cutover

## Status

Implemented as a Phase 9R durable module-name cutover for request-time learning
and destination selection.

This change does not wire new request/import persistence. It removes temporary
roadmap naming from the production request-time learning contract while
preserving the existing side-effect-free validation boundary.

## Official Guidance Reviewed

- [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
  identifies prompt injection, insecure output handling, excessive agency, and
  overreliance as core LLM application risks. Request-time learning remains
  deterministic, bounded, and server-owned rather than model-authored.
- [NIST Generative AI Profile](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence)
  emphasizes governed measurement and lifecycle risk controls for generative AI
  systems. The request-time contract keeps request choice, operator change,
  final route outcome, learning eligibility, and profile refresh separate.
- [OpenTelemetry Naming](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  recommends lower-case namespacing, snake_case multi-word name components, and
  precise unambiguous names. The payload version now uses
  `policy.request_time_learning.v1`.

## Recommendation

Keep request-time learning as a durable runtime primitive:

```text
runtime question reduction
  -> request-time learning
  -> library policy rebuild
```

The request-time contract should be product-domain code because it is a
permanent runtime guard between request/manual/routing outcomes and any later
durable learning.

## Pros And Cons

Pros:

- Removes a phase-coded production module and focused test name.
- Moves the request-time payload version to a durable `policy.*` namespace.
- Keeps request/manual/routing outcomes side-effect-free.
- Keeps route outcomes, failed mappings, and learning eligibility separate.
- Preserves the completion-audit roadmap checkpoint through a small adapter.

Cons:

- Leaves rebuild, migration verifier, metrics, and test reset modules
  phase-coded until later cutover slices.
- Requires downstream consumers to import the renamed contract.
- Still requires a later runtime integration slice before request/import flows
  call this contract directly.

## Final Implementation Stack

1. Rename the service to `policyRequestTimeLearning.mjs`.
2. Rename the focused test to `policyRequestTimeLearning.test.mjs`.
3. Rename exported constants and builders to `POLICY_REQUEST_*` and
   `buildPolicyRequestTimeLearning*`.
4. Move the contract version to `policy.request_time_learning.v1`.
5. Replace the contract-local audit handoff with
   `nextStep.stepId = library_policy_rebuild`.
6. Keep the Phase 7R completion audit mapping as a compatibility adapter for
   the broader roadmap completion gate.
7. Update direct runtime consumers, docs, changelog, and naming regression
   baseline after inventory validation proves the count decreased.

## Security Boundary

- The contract does not call providers.
- The contract does not persist request outcomes.
- The contract does not write policies or profile evidence.
- Failed routing cannot become positive destination evidence.
- Successful Arr routing records final outcome only.
- Manual destination changes require auditable and reversible metadata.
- Trace output uses bounded reason codes and fingerprints, not raw evidence,
  provider payloads, prompts, AI text, replay diagnostics, or question text.

## Outcome

Request-time learning now uses durable production naming while preserving the
same deterministic event ids, learning dispositions, validation checks, and
bounded trace shape. Completion-audit, library rebuild, metrics, decision
inventory, and rebuild test reset consumers now import the durable
request-time learning contract.

## Validation

Validation should include:

```text
cd server
node ../scripts/run-jest.mjs --testPathPatterns="policyRequestTimeLearning|policyLibraryPolicyRebuild|policyRuntimeMetricsTrace|policyBuilderPhase7CompletionAudit|policyRuntimeDecisionInventory|policyBuilderPhase7RuntimeRebuildTestReset|policyProductionNamingRegressionAudit" --no-coverage --runInBand
npm run lint:docs
npm --prefix server run lint:security -- --quiet
node scripts/generate-policy-builder-production-name-inventory.mjs --require-valid
npm --prefix server run test:unit -- --no-coverage --runInBand
```

## Next Step

Cut over Migration Verifier And Rollback Path to a durable product-domain
module name because library-derived policy rebuild now exports durable names
and the verifier is the next direct runtime consumer still carrying Phase 7R
production naming.
