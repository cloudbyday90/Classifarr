# Policy Authoring Setup Card Progress Module Cutover

Status: implemented.

## Scope

This cutover removes phase-specific naming from the setup-card state-binding
evidence while preserving the existing read-only card progress projection,
recommended-next-action behavior, setup-card anchors, and regression coverage.

## Official Guidance Reviewed

- W3C WCAG 2.2, Status Messages:
  https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
- W3C WCAG 2.2, Labels or Instructions:
  https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html
- W3C WCAG Technique ARIA22:
  https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA22
- GOV.UK Design System, Task List:
  https://design-system.service.gov.uk/components/task-list/
- GOV.UK Design System, Complete Multiple Tasks:
  https://design-system.service.gov.uk/patterns/complete-multiple-tasks/
- GOV.UK Design System, Tag:
  https://design-system.service.gov.uk/components/tag/
- U.S. Web Design System, Process List:
  https://designsystem.digital.gov/components/process-list/
- U.S. Web Design System, Step Indicator:
  https://designsystem.digital.gov/components/step-indicator/

## Recommendations

1. Name the artifact after the durable product behavior: setup-card progress.
2. Keep setup cards as read-only navigation and progress, not policy authority.
3. Preserve a small status vocabulary with visible labels and explanatory text.
4. Preserve one action link per setup card and one recommended next action.
5. Keep status derivation in a utility so the Vue card component remains
   presentational.

## Pros And Cons

Pros:

- Removes phase-coded completion-audit metadata from another Vue rewrite slice.
- Keeps setup cards scan-friendly without adding API calls, persistence, or
  routing/classification side effects.
- Preserves the existing tests that cover card status, action targets, and
  recommended-next-action behavior.

Cons:

- The progress projection still depends on modal-local projections until
  server-owned readiness contracts replace them.
- Save/defer action boundary metadata still needs its own durable naming
  cutover.

## Final Recommendation Stack

- `docs/architecture/policy-authoring-setup-card-progress.md`
- `server/src/services/policyAuthoringWorkflowCompletionAudit.mjs`
- `server/src/__tests__/services/policyAuthoringWorkflowCompletionAudit.test.mjs`
- `client/src/utils/policyBuilderSetupCards.js`
- `client/src/components/policies/PolicyBuilderSetupCards.vue`
- `client/src/__tests__/utils/policyBuilderSetupCards.test.js`
- `client/src/__tests__/PolicyBuilderSetupCards.test.js`

## Outcome

The cutover renamed the setup-card progress architecture document, updated the
workflow completion audit slice to `policy_authoring_setup_card_progress`,
updated roadmap links to the durable artifact, and kept the existing
setup-card progress projection and Vue behavior unchanged.

## Next Step

Cut over the policy-authoring save/defer action boundary naming because it is
the next Vue rewrite slice that still uses phase-coded completion-audit
metadata.
