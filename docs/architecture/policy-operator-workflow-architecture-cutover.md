# Policy Operator Workflow Architecture Cutover

## Status

Implemented as the architecture naming cutover for the durable policy operator
workflow.

This record covers the documentation-level cutover from checkpoint-specific
operator workflow language to the durable `policy.operator_workflow.v1`
contract. The runtime service was already named `policyOperatorWorkflow.mjs`,
so this component keeps behavior stable while updating the active design
surface and runtime-facing labels that still used rebuild terminology.

## Official Guidance Reviewed

- [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/) covers recommendations for
  accessible labels, instructions, status messages, and error identification.
  The durable workflow remains organized around plain-language sections and
  next actions.
- [W3C WAI Forms Tutorial](https://www.w3.org/WAI/tutorials/forms/)
  applies accessible form concepts to web application forms, including forms
  processed client-side or server-side. The workflow keeps grouped controls and
  explicit labels as the UI-facing contract.
- [W3C WAI Grouping Controls](https://www.w3.org/WAI/tutorials/forms/grouping/)
  emphasizes grouping related controls so forms are easier to understand. The
  workflow keeps related destination questions in bounded sections.
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
  provides a basis for testing application security controls. The workflow
  remains server-validated and blocks direct persistence, direct routing
  execution, raw payload exposure, and diagnostic panels in the normal flow.
- [OpenTelemetry Context Propagation](https://opentelemetry.io/docs/concepts/context-propagation/)
  describes propagating causal context across process boundaries. The workflow
  continues to propagate sanitized fingerprint and audit context rather than
  raw evidence labels.

## Recommendations

1. **Name the active design after the product contract.**
   The active design file should be `policy-operator-workflow.md`, matching the
   runtime module and `policy.operator_workflow.v1` contract.

2. **Remove temporary construction wording from runtime-facing labels.**
   Runtime labels should say `Policy Operator Workflow` because temporary
   construction language is implementation-sequencing context.

3. **Keep quality-gate behavior intact.**
   This cutover should not change workflow section IDs, status IDs, audit risk
   IDs, bounded quality validation, or side-effect-free workflow behavior.

4. **Keep checkpoint terms in the roadmap only.**
   Roadmap sections can still sequence work, but active architecture records
   should describe durable policy concepts.

5. **Make the next handoff explicit.**
   The next component is the operator workflow quality-gate architecture
   cutover so the remaining workflow hardening record uses the same durable
   naming model.

## Pros And Cons

Pros:

- Removes the old checkpoint-coded active workflow design file.
- Aligns documentation with `policyOperatorWorkflow.mjs` and
  `policy.operator_workflow.v1`.
- Removes rebuild wording from runtime audit labels.
- Keeps section behavior, bounded readiness handoff, and quality checks stable.
- Preserves the server-owned, side-effect-free workflow boundary.

Cons:

- Historical changelog and roadmap sequencing still mention checkpoints where
  they describe release history or implementation order.
- The workflow quality-gate design record still needs its own naming cutover.

## Final Recommendation Stack

- Active architecture:
  `docs/architecture/policy-operator-workflow.md`
- Cutover record:
  `docs/architecture/policy-operator-workflow-architecture-cutover.md`
- Runtime workflow:
  `server/src/services/policyOperatorWorkflow.mjs`
- Focused tests:
  `server/src/__tests__/services/policyOperatorWorkflow.test.mjs`
- Readiness dependency:
  `server/src/services/policyAutomationReadinessEngine.mjs`
- Roadmap owner:
  `docs/architecture/policy-builder-intent-model-roadmap.md`

## Implementation Outcome

- Renamed the active operator workflow design record to
  `policy-operator-workflow.md`.
- Rewrote the active design record around the durable workflow contract,
  destination-first sections, server-owned readiness, and bounded quality
  continuity.
- Updated runtime-facing readiness and completion labels from operator workflow
  rebuild wording to policy operator workflow wording.
- Updated the module cutover note, roadmap links, and changelog entry.

## Security Outcome

- No routing, provider, persistence, authorization, learning, readiness, or
  migration behavior changed.
- The workflow remains server-owned, side-effect free, and blocked from direct
  persistence, direct routing execution, raw payload exposure, diagnostic-panel
  authority, failed upstream audits, mismatched fingerprints, and unusable
  bounded quality.

## Next Step

Continue with **Policy Migration Deletion Path Architecture Cutover**.
