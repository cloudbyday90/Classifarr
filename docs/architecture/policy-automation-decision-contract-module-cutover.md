# Policy Automation Decision Contract Module Cutover

## Status

Implemented as a Phase 9R durable module-name cutover for the runtime
automation decision contract.

This change does not alter routing behavior. It removes temporary roadmap
naming from the production automation-decision contract, keeps the contract
side-effect-free, and preserves the existing validation gates.

## Official Guidance Reviewed

- [NIST Secure Software Development Framework SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final)
  recommends secure development practices that reduce recurring
  vulnerabilities and establish a common vocabulary. Durable module and
  contract names make the automation boundary easier to review after the
  roadmap phases are complete.
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
  provides a basis for testing application security controls and secure
  development requirements. This cutover keeps automation states allow-listed
  and validation-owned by the server.
- [OWASP ASVS Validation And Business Logic](https://asvs.dev/v5.0.0/V2-Validation-and-Business-Logic/)
  emphasizes validation of business logic and workflow behavior. The contract
  continues to distinguish route-ready, classify-only, review, mapping,
  stale-profile, insufficient-evidence, and hard-limit-blocked outcomes.
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)
  and [OpenTelemetry Naming](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  support stable telemetry naming. The contract keeps bounded
  `classifarr.runtime.decision.*` attributes and moves its payload version into
  the durable `policy.automation_decision.v1` namespace.

## Recommendation

Keep the automation decision contract as a product-domain runtime primitive:

```text
runtime evidence projection
  -> policy automation decision
  -> runtime question reduction
```

The contract should not be named after the roadmap phase because downstream
runtime code will keep consuming it after Phase 7R and Phase 9R are complete.

## Pros And Cons

Pros:

- Removes a phase-coded production import and test path.
- Makes the runtime chain easier to explain without roadmap knowledge.
- Preserves the existing side-effect-free validation boundary.
- Keeps trace and payload names stable for later telemetry and persistence.

Cons:

- Requires coordinated import/test/doc updates.
- Leaves downstream runtime question and metrics modules phase-coded until their
  own cutover slices.

## Final Implementation Stack

1. Rename the service to `policyAutomationDecisionContract.mjs`.
2. Rename the focused test to `policyAutomationDecisionContract.test.mjs`.
3. Rename exported constants and builders to `POLICY_AUTOMATION_DECISION_*` and
   `buildPolicyAutomationDecision*`.
4. Move the decision payload version to `policy.automation_decision.v1`.
5. Replace the local audit handoff with `nextStep.stepId =
   runtime_question_reduction`.
6. Keep the Phase 7R completion audit mapping as a compatibility adapter for the
   broader roadmap completion gate.
7. Update direct runtime consumers, docs, and the naming regression baseline
   only after inventory validation proves the count decreased.

## Security Boundary

- The contract does not call providers.
- The contract does not route media.
- The contract does not write classifications, questions, learning records, or
  policy state.
- Validation rejects unsafe auto-route claims, side-effect claims, invalid
  runtime evidence, missing evidence validation proof, and malformed or
  mismatched evidence fingerprints.
- Trace output remains bounded to reason codes and safe scalar attributes.

## Outcome

The automation decision contract now uses durable production naming while
retaining the same deterministic state machine and validation behavior.
Runtime question reduction, metrics traces, decision inventory, and rebuild
test reset consumers now import the durable automation contract.

## Validation

Validation should include:

```text
cd server
node ../scripts/run-jest.mjs --testPathPatterns="policyAutomationDecisionContract|policyRuntimeQuestionReduction|policyBuilderPhase7RuntimeMetricsTrace|policyBuilderPhase7CompletionAudit|policyRuntimeDecisionInventory|policyBuilderPhase7RuntimeRebuildTestReset|policyProductionNamingRegressionAudit" --no-coverage --runInBand
npm run lint:docs
npm --prefix server run lint:security -- --quiet
node scripts/generate-policy-builder-production-name-inventory.mjs --require-valid
npm --prefix server run test:unit -- --no-coverage --runInBand
```

## Next Step

Cut over Request-Time Learning And Destination Selection to a durable
product-domain module name. It is the direct consumer of runtime question
reduction and the next runtime link that still exposes Phase 7R naming in
production imports.
