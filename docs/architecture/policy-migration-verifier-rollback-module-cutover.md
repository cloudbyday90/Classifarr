# Policy Migration Verifier And Rollback Module Cutover

## Status

Implemented as a durable module-name cutover for migration verification and
rollback gating.

This change does not apply policy replacement, create rollback snapshots, or
delete legacy paths. It removes temporary roadmap naming from the production
migration verifier contract while preserving the existing side-effect-free
verification boundary.

## Official Guidance Reviewed

- [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
  identifies insecure output handling, excessive agency, and overreliance as
  core LLM application risks. The verifier remains deterministic, bounded, and
  server-owned; it cannot activate, replace, delete, persist policy, or trust
  stale proposal-validation proof.
- [NIST Generative AI Profile](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence)
  emphasizes governed measurement and lifecycle risk controls for generative AI
  systems. The verifier keeps sample-set provenance, migration differences,
  operator acceptance, rollback proof, and deletion readiness separate.
- [OpenTelemetry Naming](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  recommends lower-case namespacing, snake_case multi-word name components, and
  precise unambiguous names. The payload versions now use
  `policy.migration_verifier.v1` and
  `policy.migration_verifier_sample_set_fingerprint.v1`.

## Recommendation

Keep migration verification as a durable runtime primitive:

```text
library-derived policy rebuild
  -> migration verifier and rollback path
  -> runtime metrics and decision trace
```

The verifier should be product-domain code because it is the permanent safety
boundary between a generated policy proposal and any future replacement or
legacy-deletion workflow.

## Pros And Cons

Pros:

- Removes a phase-coded production module and focused test name.
- Moves verifier and sample-set fingerprint payload versions to durable
  `policy.*` namespaces.
- Keeps verification side-effect-free.
- Keeps proposal validation, bounded sample-set proof, operator acceptance,
  rollback snapshot proof, and deletion readiness in the server-owned contract.
- Preserves the completion-audit roadmap checkpoint through a small adapter.

Cons:

- Leaves metrics/trace and test-reset modules phase-coded until later cutover
  slices.
- Requires downstream consumers to import the renamed verifier contract.
- Does not make replacement or deletion executable; apply/rollback remains
  gated later work.

## Final Implementation Stack

1. Rename the service to `policyMigrationVerifierRollback.mjs`.
2. Rename the focused test to `policyMigrationVerifierRollback.test.mjs`.
3. Rename exported constants and builders to `POLICY_MIGRATION_*` and
   `buildPolicyMigrationVerifier*`.
4. Move the verifier contract version to `policy.migration_verifier.v1`.
5. Move the sample-set fingerprint version to
   `policy.migration_verifier_sample_set_fingerprint.v1`.
6. Replace verifier-local phase handoff with
   `nextStep.stepId = runtime_metrics_trace`.
7. Rename deletion readiness from Phase 8-specific language to
   `native_intent_storage_stable` while keeping legacy input compatibility for
   existing callers that still send `phase8NativeIntentStable`.
8. Use the runtime completion audit to verify the semantic `nextStep` handoff sequence.
9. Update direct runtime consumers, docs, changelog, and naming regression
   baseline after inventory validation proves the count decreased.

## Security Boundary

- The verifier does not call providers.
- The verifier does not persist reports.
- The verifier does not activate, replace, delete, or write policies.
- The verifier does not write learning or routing changes.
- The verifier does not create rollback snapshots.
- Replacement remains blocked unless operator acceptance and rollback snapshot
  proof are present.
- Legacy deletion remains blocked unless native intent storage stability,
  verifier pass, rollback, retention, approval, and replacement criteria are
  all met.
- Trace output uses bounded reason codes, counts, and fingerprints, not raw
  evidence, provider payloads, prompts, AI text, replay diagnostics, or item
  titles.

## Outcome

Migration verification now uses durable production naming while preserving the
same deterministic statuses, validation checks, rollback gates, deletion gates,
sample-set fingerprint validation, and bounded trace shape. Completion-audit,
metrics/trace, native-intent conversion, decision inventory, and rebuild test
reset consumers now import the durable verifier contract.

## Validation

Validation should include:

```text
cd server
node ../scripts/run-jest.mjs --testPathPatterns="policyMigrationVerifierRollback|policyRuntimeMetricsTrace|policyRuntimeCompletionAudit|policyIntentConversionWorkflow|policyRuntimeDecisionInventory|policyRuntimeRebuildTestReset|policyProductionNamingRegressionAudit" --no-coverage --runInBand
npm run lint:docs
npm --prefix server run lint:security -- --quiet
node scripts/generate-policy-builder-production-name-inventory.mjs --require-valid
npm --prefix server run test:unit -- --no-coverage --runInBand
```

## Next Step

Cut over Runtime And Rebuild Test Reset to a durable product-domain module name
because migration verification and runtime metrics now export durable names,
and test reset is the next direct runtime consumer still carrying Phase 7R
production naming.

## Related Active Architecture

The active migration verifier and rollback design record is now
[Policy Migration Verifier And Rollback Path](policy-migration-verifier-rollback.md).
The architecture naming cutover is recorded in
[Policy Migration Verifier And Rollback Architecture Cutover](policy-migration-verifier-rollback-architecture-cutover.md).
