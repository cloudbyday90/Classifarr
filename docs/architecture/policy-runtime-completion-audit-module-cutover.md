# Policy Runtime Completion Audit Module Cutover

## Status

Implemented as the durable module-name cutover for the runtime completion
audit.

This change removes temporary roadmap naming from the production completion
audit while preserving the same side-effect-free current-state verification
boundary.

## Official Guidance Reviewed

- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
  frames secure software development as lifecycle-integrated practices. This
  cutover keeps completion evidence deterministic, current-state based, and
  server-owned.
- [NIST SP 800-218 Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  includes verification and testing as secure development practices. The audit
  verifies component records, focused tests, implementation files, local
  component audits, and handoff order before native storage migration work
  proceeds.
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
  provides a basis for testing application security controls. The audit treats
  runtime contracts as the application verification boundary instead of UI
  preview state.
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)
  describe common names for operations and data. The component ids now use
  product-domain names such as `runtime_evidence_projection` and
  `automation_decision_contract`.
- [OpenTelemetry Naming](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  recommends printable, lowercase, namespaced names. The contract version now
  uses `policy.runtime_completion_audit.v1`.

## Recommendation

Keep runtime completion as the final side-effect-free gate before native intent
storage:

```text
runtime component audits
  -> runtime completion audit
  -> native intent storage readiness
```

The audit should use product-domain component ids and `nextStep.stepId`
handoffs directly. Roadmap phase ids belong in planning docs, not runtime
contract payloads or production service names.

## Pros And Cons

Pros:

- Removes the last phase-coded production service and focused test from the
  runtime/rebuild chain.
- Moves the audit payload version to `policy.runtime_completion_audit.v1`.
- Replaces roadmap handoff ids with semantic `nextStep.stepId` values.
- Points component evidence at durable module-cutover docs.
- Keeps completion verification deterministic and side-effect-free.

Cons:

- Historical phase docs remain as roadmap history until broader documentation
  cleanup removes or consolidates them.
- Completion records must stay current when runtime component files or cutover
  documents move.
- The audit still composes local component audits; it does not replace full
  test-suite execution.

## Final Implementation Stack

1. Rename the service to `policyRuntimeCompletionAudit.mjs`.
2. Rename the focused test to `policyRuntimeCompletionAudit.test.mjs`.
3. Rename exported constants and builders to `POLICY_RUNTIME_COMPLETION_*` and
   `buildPolicyRuntimeCompletionAudit`.
4. Move the contract version to `policy.runtime_completion_audit.v1`.
5. Replace phase-coded component ids with product-domain component ids.
6. Validate component handoffs from `nextStep.stepId` directly.
7. Return `nextStep.stepId = native_intent_storage` for the storage handoff.
8. Update docs, changelog, and naming regression baseline after inventory
   validation proves the count decreased.

## Security Boundary

- The audit does not modify policies.
- The audit does not run migrations.
- The audit does not delete tests or docs.
- The audit reads only repository-owned artifact metadata.
- Component artifacts must exist in the current checkout.
- Component audits must pass before the completion audit passes.
- Runtime handoffs must match the expected semantic `nextStep` sequence.

## Outcome

Runtime completion audit now uses durable production naming while preserving the
same current-state artifact checks, local audit composition, request-time
learning proof sample, side-effect-free posture, and native-storage handoff.

## Related Active Architecture

- Active architecture:
  [Policy Runtime Completion Audit](policy-runtime-completion-audit.md)
- Architecture cutover:
  [Policy Runtime Completion Audit Architecture Cutover](policy-runtime-completion-audit-architecture-cutover.md)

## Validation

Validation should include:

```text
cd server
node ../scripts/run-jest.mjs --testPathPatterns="policyRuntimeCompletionAudit|policyRuntimeRebuildTestReset|policyProductionNamingRegressionAudit" --no-coverage --runInBand
npm run lint:docs
npm --prefix server run lint:security -- --quiet
node scripts/generate-policy-builder-production-name-inventory.mjs --require-valid
npm --prefix server run test:unit -- --no-coverage --runInBand
```

## Next Step

Continue with native intent storage readiness and the remaining production
naming cutovers identified by the inventory, starting with the draft command
boundary family because it still carries temporary sequencing terms in active
service names and diagnostics.
