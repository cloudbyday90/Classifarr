# Policy Authoring Accessibility And Decision Load Audit Module Cutover

Status: implemented.

## Scope

This cutover removes phase-specific naming from the accessibility and
decision-load audit evidence while preserving the existing setup-card
recommended-next-action behavior, accessible link state, and no-template
fallback targets.

## Official Guidance Reviewed

- W3C WCAG 2.2, Focus Order:
  https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html
- W3C WCAG 2.2, Labels or Instructions:
  https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html
- W3C WAI-ARIA Authoring Practices Guide, Keyboard Interface:
  https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/
- W3C Technique ARIA26, Using `aria-current`:
  https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA26
- GOV.UK Design System, Task List:
  https://design-system.service.gov.uk/components/task-list/
- U.S. Web Design System, Step Indicator:
  https://designsystem.digital.gov/components/step-indicator/
- U.S. Web Design System, Step Indicator Accessibility Tests:
  https://designsystem.digital.gov/components/step-indicator/accessibility-tests/

## Recommendations

1. Name the artifact after the durable product behavior: accessibility and
   decision-load audit.
2. Preserve exactly one recommended setup action when setup is incomplete.
3. Preserve `aria-current="step"` for the recommended action and avoid marking
   multiple links as current.
4. Preserve visible recommended-next-action copy so the accessibility signal is
   not only programmatic.
5. Keep no-template action targets pointed at visible policy-authoring sections
   instead of missing preset-backed anchors.

## Pros And Cons

Pros:

- Removes phase-coded completion-audit metadata from another Vue rewrite slice.
- Keeps the normal setup path accessible without adding new workflow behavior.
- Preserves focused coverage for recommended next action, accessible link
  descriptions, and action-target fallback behavior.

Cons:

- Accessibility remains component/test guarded until broader manual assistive
  technology checks are run in the deployed app.
- Native intent storage may later replace some no-template fallback targets.
- Presentation-test reset metadata still needs its own durable naming cutover.

## Final Recommendation Stack

- `docs/architecture/policy-authoring-accessibility-decision-load-audit.md`
- `server/src/services/policyAuthoringWorkflowCompletionAudit.mjs`
- `server/src/__tests__/services/policyAuthoringWorkflowCompletionAudit.test.mjs`
- `client/src/utils/policyBuilderSetupCards.js`
- `client/src/components/policies/PolicyBuilderSetupCards.vue`
- `client/src/__tests__/utils/policyBuilderSetupCards.test.js`
- `client/src/__tests__/PolicyBuilderSetupCards.test.js`
- `client/src/__tests__/PolicyBuilderModal.test.js`

## Outcome

The cutover renamed the accessibility and decision-load architecture document,
updated the workflow completion audit slice to
`policy_authoring_accessibility_decision_load_audit`, updated roadmap links to
the durable artifact, and kept the existing setup-card accessibility behavior
unchanged.

## Next Step

Cut over the policy-authoring presentation test reset naming because it is the
next Vue rewrite slice that still uses phase-coded completion-audit metadata.
