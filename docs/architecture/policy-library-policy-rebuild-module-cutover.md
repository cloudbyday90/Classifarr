# Policy Library-Derived Policy Rebuild Module Cutover

## Status

Implemented as a Phase 9R durable module-name cutover for library-derived
policy rebuild proposals.

This change does not apply or persist policy replacements. It removes temporary
roadmap naming from the production rebuild proposal contract while preserving
the existing side-effect-free validation boundary.

## Official Guidance Reviewed

- [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
  identifies insecure output handling, excessive agency, and overreliance as
  core LLM application risks. The rebuild proposal remains deterministic,
  bounded, and server-owned; it cannot activate, replace, delete, or persist
  policy.
- [NIST Generative AI Profile](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence)
  emphasizes governed measurement and lifecycle risk controls for generative AI
  systems. The rebuild contract keeps observed library evidence, guarded
  outcomes, explicit constraints, routing readiness, operator acceptance, and
  rollback gating separate.
- [OpenTelemetry Naming](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  recommends lower-case namespacing, snake_case multi-word name components, and
  precise unambiguous names. The payload version now uses
  `policy.library_policy_rebuild.v1`.

## Recommendation

Keep library-derived rebuild as a durable runtime primitive:

```text
request-time learning
  -> library-derived policy rebuild
  -> migration verifier and rollback path
```

The rebuild contract should be product-domain code because it is the permanent
proposal boundary between learned/library evidence and any future migration or
replacement workflow.

## Pros And Cons

Pros:

- Removes a phase-coded production module and focused test name.
- Moves the rebuild payload version to a durable `policy.*` namespace.
- Keeps proposal generation side-effect-free.
- Keeps operator acceptance, rollback, routing readiness, and explicit
  constraint preservation in the server-owned contract.
- Preserves the completion-audit roadmap checkpoint through a small adapter.

Cons:

- Leaves migration verifier, metrics, and test reset modules phase-coded until
  later cutover slices.
- Requires downstream consumers to import the renamed rebuild contract.
- Does not make rebuild proposals executable; apply/rollback remains gated
  later work.

## Final Implementation Stack

1. Rename the service to `policyLibraryPolicyRebuild.mjs`.
2. Rename the focused test to `policyLibraryPolicyRebuild.test.mjs`.
3. Rename exported constants and builders to `POLICY_REBUILD_*` and
   `buildPolicyLibraryPolicyRebuild*`.
4. Move the contract version to `policy.library_policy_rebuild.v1`.
5. Replace the contract-local audit handoff with
   `nextStep.stepId = migration_verifier_rollback`.
6. Keep the Phase 7R completion audit mapping as a compatibility adapter for
   the broader roadmap completion gate.
7. Update direct runtime consumers, docs, changelog, and naming regression
   baseline after inventory validation proves the count decreased.

## Security Boundary

- The proposal builder does not call providers.
- The proposal builder does not persist proposals.
- The proposal builder does not activate, replace, delete, or write policies.
- The proposal builder does not write learning or routing changes.
- Observed absence remains warning-only context.
- Guarded outcomes must carry valid request-time learning proof before they can
  influence proposal evidence.
- Trace output uses bounded reason codes, counts, and fingerprints, not raw
  evidence, provider payloads, prompts, AI text, replay diagnostics, or item
  titles.

## Outcome

Library-derived policy rebuild now uses durable production naming while
preserving the same deterministic proposal statuses, validation checks,
operator gates, rollback gates, and bounded trace shape. Completion-audit,
migration verifier, metrics, decision inventory, and rebuild test reset
consumers now import the durable rebuild contract.

## Validation

Validation should include:

```text
cd server
node ../scripts/run-jest.mjs --testPathPatterns="policyLibraryPolicyRebuild|policyMigrationVerifierRollback|policyBuilderPhase7RuntimeMetricsTrace|policyBuilderPhase7CompletionAudit|policyRuntimeDecisionInventory|policyBuilderPhase7RuntimeRebuildTestReset|policyProductionNamingRegressionAudit" --no-coverage --runInBand
npm run lint:docs
npm --prefix server run lint:security -- --quiet
node scripts/generate-policy-builder-production-name-inventory.mjs --require-valid
npm --prefix server run test:unit -- --no-coverage --runInBand
```

## Next Step

Cut over Runtime Metrics And Decision Trace to a durable product-domain module
name because library-derived policy rebuild and migration verification now
export durable names, and metrics/trace is the next direct runtime consumer
still carrying Phase 7R production naming.
