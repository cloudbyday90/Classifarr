# Policy Operator Workflow Quality Gate Architecture Cutover

## Status

Implemented as the architecture naming cutover for the durable policy operator
workflow quality gate.

This record covers the documentation-level cutover from checkpoint-specific
workflow quality-gate language to the durable operator workflow quality
contract. Runtime enforcement already lives in `policyOperatorWorkflow.mjs`, so
this component keeps behavior stable and updates the active design surface.

## Official Guidance Reviewed

- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
  supports governed, measured, and managed AI-system behavior. The durable
  quality-gate design keeps evidence quality as explicit measured context.
- [NIST Secure Software Development Framework SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports verified secure design and lifecycle traceability. The cutover keeps
  server-side validation and focused tests as the evidence for behavior.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  provides guidance for validating inputs before application processing. The
  workflow gate validates legal combinations of bounded intent, readiness, and
  quality before returning a workflow.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends validating legal combinations and testing invalid combinations.
  The workflow quality tests continue to cover invalid quality handoffs.
- [OWASP Web Security Testing Guide: Business Logic Data Validation](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/10-Business_Logic_Testing/01-Test_Business_Logic_Data_Validation)
  reinforces that logical validity must be checked server-side.

## Recommendations

1. **Name the active quality-gate design after the product contract.**
   The active design file should be `policy-operator-workflow-quality-gate.md`,
   matching the durable operator workflow contract.

2. **Keep runtime behavior unchanged.**
   This cutover should not change workflow section IDs, audit risk IDs, bounded
   quality validation, or side-effect-free workflow projection behavior.

3. **Keep checkpoint terms in the roadmap only.**
   Roadmap sections can still sequence work, but active architecture records
   should describe durable policy concepts.

4. **Make the next handoff explicit.**
   The next component is the migration/deletion path architecture cutover so the
   next direct workflow consumer uses durable naming as well.

## Pros And Cons

Pros:

- Removes the old checkpoint-coded active workflow quality-gate design file.
- Aligns documentation with `policyOperatorWorkflow.mjs` bounded quality
  enforcement.
- Keeps workflow quality behavior stable while reducing future refactor
  confusion.
- Preserves the server-owned boundary that blocks missing, insufficient, or
  mismatched quality before UI rendering.

Cons:

- Historical changelog and roadmap sequencing still mention checkpoints where
  they describe release history or implementation order.
- The migration/deletion path and its quality gate still need their own durable
  architecture cutovers.

## Final Recommendation Stack

- Active quality-gate architecture:
  `docs/architecture/policy-operator-workflow-quality-gate.md`
- Cutover record:
  `docs/architecture/policy-operator-workflow-quality-gate-architecture-cutover.md`
- Runtime workflow:
  `server/src/services/policyOperatorWorkflow.mjs`
- Focused tests:
  `server/src/__tests__/services/policyOperatorWorkflow.test.mjs`
- Roadmap owner:
  `docs/architecture/policy-builder-intent-model-roadmap.md`

## Implementation Outcome

- Renamed the active workflow quality-gate design record to
  `policy-operator-workflow-quality-gate.md`.
- Rewrote the active design record around durable bounded quality continuity
  between intent, readiness, embedded readiness context, and operator workflow.
- Updated the roadmap to link to the durable workflow quality-gate record and
  this architecture cutover record.
- Updated the changelog with a high-level Unreleased note.

## Security Outcome

- No routing, provider, persistence, authorization, learning, readiness, or
  migration behavior changed.
- The documented workflow quality gate remains server-owned and blocks missing,
  insufficient, mismatched, or tampered quality before the normal operator
  workflow is returned.

## Next Step

Continue with **Policy Migration Deletion Path Architecture Cutover**.
