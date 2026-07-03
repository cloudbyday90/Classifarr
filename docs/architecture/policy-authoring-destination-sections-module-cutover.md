# Policy Authoring Destination Sections Module Cutover

Status: implemented.

## Scope

This cutover removes phase-specific naming from the policy-authoring
destination-section layout evidence while preserving the existing Vue editor
anchors, typed draft-command behavior, and regression coverage.

## Official Guidance Reviewed

- W3C WCAG 2.2, Headings and Labels:
  https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels.html
- W3C WCAG 2.2, Section Headings:
  https://www.w3.org/WAI/WCAG22/Understanding/section-headings.html
- WAI-ARIA Authoring Practices, Keyboard Interface:
  https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/
- GOV.UK Design System, Complete Multiple Tasks:
  https://design-system.service.gov.uk/patterns/complete-multiple-tasks/
- GOV.UK Design System, Task List:
  https://design-system.service.gov.uk/components/task-list/

## Recommendations

1. Keep section names tied to durable policy-authoring concepts:
   review behavior, destination identity, destination rules, and confidence
   support.
2. Keep stable anchor IDs so setup cards and tests can target sections without
   depending on layout order.
3. Keep the completion-audit slice id product-named rather than phase-named.
4. Keep this cutover documentation separate from the destination-flow contract
   because the flow contract describes sequence, while this artifact describes
   Vue section layout.

## Pros And Cons

Pros:

- Removes phase-coded completion-audit metadata from another production-facing
  Vue rewrite slice.
- Keeps setup-card routing and editor regression tests pointed at the same
  stable anchors.
- Preserves the source-controlled design record needed for future refactors.

Cons:

- Later Vue rewrite slices still carry phase-coded names until their own
  cutovers run.
- Historical changelog entries retain their original phase labels so past
  release notes remain accurate.

## Final Recommendation Stack

- `docs/architecture/policy-authoring-destination-sections.md`
- `server/src/services/policyAuthoringWorkflowCompletionAudit.mjs`
- `server/src/__tests__/services/policyAuthoringWorkflowCompletionAudit.test.mjs`
- `client/src/__tests__/PolicyIntentEditor.test.js`

## Outcome

The cutover renamed the destination-section architecture document, updated the
workflow completion audit slice to `policy_authoring_destination_sections`,
updated roadmap links to the durable artifact, and kept editor anchors and typed
draft commands unchanged.

## Next Step

Cut over the policy-authoring review-trigger control naming because it is the
next Vue rewrite slice that still uses phase-coded completion-audit metadata.
