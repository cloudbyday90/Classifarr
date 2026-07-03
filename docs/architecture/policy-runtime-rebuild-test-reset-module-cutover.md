# Policy Runtime And Rebuild Test Reset Module Cutover

## Status

Implemented as a Phase 9R durable module-name cutover for runtime and rebuild
test reset evidence.

This change does not rewrite or delete tests. It removes temporary roadmap
naming from the production test reset contract while preserving side-effect-free
classification of retained regressions, runtime contract rewrites, and old
diagnostic deletion candidates.

## Official Guidance Reviewed

- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
  frames secure software development as practices integrated into the software
  lifecycle. This cutover keeps test-reset evidence server-owned and
  deterministic before native storage migration work proceeds.
- [NIST SP 800-218 Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  includes verification and testing as secure development practices. The reset
  validates artifact existence, repo-relative paths, authority preservation, and
  required coverage before the audit can pass.
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
  provides a basis for testing application security controls. The reset treats
  runtime/rebuild tests as authority-boundary evidence, not UI preview
  snapshots.
- [OpenTelemetry Naming](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  recommends precise, namespaced, lower-case product terms. The payload version
  now uses `policy.runtime_rebuild_test_reset.v1`.
- [NIST Generative AI Profile](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence)
  emphasizes lifecycle risk management for generative AI systems. The reset
  preserves evidence that automation, learning, rebuild, verifier, rollback,
  and metrics contracts remain bounded before migration proceeds.

## Recommendation

Keep runtime/rebuild test reset as a durable verification primitive:

```text
runtime metrics and decision trace
  -> runtime and rebuild test reset
  -> runtime contract completion audit
```

The reset should be product-domain code because it is the permanent evidence
manifest for which tests protect server authority, which old diagnostics are
migration-only, and which coverage is required before native storage migration.

## Pros And Cons

Pros:

- Removes a phase-coded production module and focused test name.
- Moves the reset payload version to `policy.runtime_rebuild_test_reset.v1`.
- Keeps test reset side-effect-free.
- Keeps test artifact availability, authority protection, routing distinction,
  rollback coverage, and old diagnostic deletion criteria in one server-owned
  contract.
- Preserves the completion-audit roadmap checkpoint through a small adapter.

Cons:

- Leaves the completion audit itself phase-coded until the next cutover slice.
- Does not remove old preview/replay tests; deletion remains gated by migration
  parity and replacement coverage.
- Requires the manifest to stay current when test files move.

## Final Implementation Stack

1. Rename the service to `policyRuntimeRebuildTestReset.mjs`.
2. Rename the focused test to `policyRuntimeRebuildTestReset.test.mjs`.
3. Rename exported constants and builders to `POLICY_RUNTIME_TEST_RESET_*` and
   `buildPolicyRuntimeRebuildTestReset*`.
4. Move the contract version to `policy.runtime_rebuild_test_reset.v1`.
5. Replace the contract-local audit handoff with
   `nextStep.stepId = completion_audit`.
6. Keep the Phase 7R completion audit mapping as a compatibility adapter for
   the broader roadmap completion gate.
7. Update direct completion-audit consumers, docs, changelog, and naming
   regression baseline after inventory validation proves the count decreased.

## Security Boundary

- The reset does not rewrite tests.
- The reset does not delete tests.
- The reset does not modify workflows.
- The reset reads only repository-owned artifact metadata.
- Artifact paths must be repo-relative, resolve inside the repository, and
  exist on disk.
- Runtime rewrites must protect server authority.
- Missing-routing coverage must distinguish classification from routing.
- Old impact/replay preview UI cannot be frozen as the migration contract.

## Outcome

Runtime and rebuild test reset now uses durable production naming while
preserving the same deterministic artifact manifest, coverage mapping,
authority checks, routing checks, old diagnostic deletion gates, side-effect
flags, and completion-audit handoff. The Phase 7R completion audit now imports
the durable reset contract.

## Validation

Validation should include:

```text
cd server
node ../scripts/run-jest.mjs --testPathPatterns="policyRuntimeRebuildTestReset|policyBuilderPhase7CompletionAudit|policyProductionNamingRegressionAudit" --no-coverage --runInBand
npm run lint:docs
npm --prefix server run lint:security -- --quiet
node scripts/generate-policy-builder-production-name-inventory.mjs --require-valid
npm --prefix server run test:unit -- --no-coverage --runInBand
```

## Next Step

Cut over the completion audit to a durable product-domain module name because
all runtime/rebuild component contracts now export durable names, and the
completion audit is the next production service still carrying Phase 7R naming.
