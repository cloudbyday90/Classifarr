# Policy Authoring Destination Flow Module Cutover

Status: implemented.

## Scope

This cutover removes phase-specific naming from the destination-first policy
authoring flow service and focused test while preserving the ordered workflow
contract.

## Official Guidance Reviewed

- W3C WCAG 2.2:
  https://www.w3.org/TR/WCAG22/
- WAI-ARIA Authoring Practices Guide:
  https://www.w3.org/WAI/ARIA/apg/
- NIST Secure Software Development Framework SP 800-218:
  https://csrc.nist.gov/pubs/sp/800/218/final

## Recommendations

1. Keep destination-flow code named after the durable product concept, not the
   roadmap phase that introduced it.
2. Preserve one clear ordered workflow and one next action per empty or blocked
   state.
3. Keep diagnostic/provider/scoring mechanics outside the normal authoring
   flow.
4. Keep completion-audit evidence paths aligned with live durable artifacts.

## Pros And Cons

Pros:

- Reduces phase-coded production naming debt.
- Gives downstream authoring contracts a stable destination-flow vocabulary.
- Keeps the accessibility-oriented flow contract testable without UI layout
  coupling.

Cons:

- Leaves the component-system, evidence-option, hard-limit, readiness, and
  starter-template contracts with phase-coded module names until their own
  cutover slices are completed.

## Final Recommendation Stack

- `server/src/services/policyAuthoringDestinationFlow.mjs`
- `server/src/__tests__/services/policyAuthoringDestinationFlow.test.mjs`
- `docs/architecture/policy-authoring-destination-flow.md`
- `server/src/services/policyAuthoringWorkflowCompletionAudit.mjs`

## Outcome

The cutover renamed the destination-flow module and focused test, replaced
phase-coded exported constants and helpers with `POLICY_AUTHORING_DESTINATION_*`
and `policyAuthoringDestination*` names, updated dependent contracts to consume
the durable vocabulary, and moved completion-audit evidence to durable artifact
paths.

## Next Step

Cut over the policy-authoring component-system contract because it is the next
direct consumer of the destination-flow vocabulary.
