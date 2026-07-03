# Policy Authoring Review Triggers Module Cutover

Status: implemented.

## Scope

This cutover removes phase-specific naming from the review-trigger control
evidence while preserving the existing checkbox control, draft bridge
serialization, section projection, and regression coverage.

## Official Guidance Reviewed

- W3C WCAG 2.2, Labels or Instructions:
  https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html
- W3C WAI Forms Tutorial, Labeling Controls:
  https://www.w3.org/WAI/tutorials/forms/labels/
- W3C WAI Forms Tutorial, Grouping Controls:
  https://www.w3.org/WAI/tutorials/forms/grouping/
- WAI-ARIA Authoring Practices, Checkbox Pattern:
  https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/
- GOV.UK Design System, Checkboxes:
  https://design-system.service.gov.uk/components/checkboxes/
- U.S. Web Design System, Checkbox:
  https://designsystem.digital.gov/components/checkbox/
- U.S. Web Design System, Checkbox Accessibility Tests:
  https://designsystem.digital.gov/components/checkbox/accessibility-tests/

## Recommendations

1. Keep review triggers as a clearly labeled checkbox group because multiple
   uncertainty conditions may apply.
2. Keep labels, helper text, disabled reasons, and duplicate-state feedback
   visible and testable.
3. Keep completion-audit metadata named after the durable product behavior:
   policy-authoring review triggers.
4. Keep bridge serialization explicit until native intent storage replaces the
   compatibility layer.

## Pros And Cons

Pros:

- Removes another phase-coded Vue rewrite slice from production completion
  evidence.
- Keeps the current operator-facing review behavior unchanged.
- Preserves the accessibility rationale for checkbox grouping and disabled
  explanations.

Cons:

- The legacy `customSignals.review_triggers.when_any` bridge remains until the
  native storage cutover.
- Routing readiness still needs its own durable naming cutover.

## Final Recommendation Stack

- `docs/architecture/policy-authoring-review-triggers.md`
- `server/src/services/policyAuthoringWorkflowCompletionAudit.mjs`
- `server/src/__tests__/services/policyAuthoringWorkflowCompletionAudit.test.mjs`
- `client/src/components/policies/PolicyIntentReviewTriggerControl.vue`
- `client/src/__tests__/PolicyIntentReviewTriggerControl.test.js`

## Outcome

The cutover renamed the review-trigger architecture document, updated the
workflow completion audit slice to `policy_authoring_review_triggers`, updated
roadmap links to the durable artifact, and kept the existing checkbox control
and draft bridge behavior unchanged.

## Next Step

Cut over the policy-authoring routing readiness surface naming because it is
the next Vue rewrite slice that still uses phase-coded completion-audit
metadata.
