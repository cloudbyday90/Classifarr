# Policy Authoring Save And Defer Action Boundary Module Cutover

Status: implemented.

## Scope

This cutover removes phase-specific naming from the save/defer action-boundary
evidence while preserving the existing footer action projection, disabled
reason behavior, save payload event, and defer-without-saving close event.

## Official Guidance Reviewed

- W3C WCAG 2.2, Labels or Instructions:
  https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html
- W3C WCAG 2.2, Error Identification:
  https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html
- W3C WCAG 2.2, Status Messages:
  https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
- GOV.UK Design System, Button:
  https://design-system.service.gov.uk/components/button/
- GOV.UK Design System, Error Message:
  https://design-system.service.gov.uk/components/error-message/
- U.S. Web Design System, Button:
  https://designsystem.digital.gov/components/button/
- U.S. Web Design System, Form:
  https://designsystem.digital.gov/components/form/

## Recommendations

1. Name the artifact after the durable product behavior: save/defer action
   boundary.
2. Keep save readiness projected in the existing utility so modal composition
   stays small.
3. Preserve visible, polite status text for save readiness and blocking
   reasons.
4. Preserve `Defer for now` as a close-only action until native draft
   persistence exists.
5. Keep routing readiness as a non-blocking warning so policy intent can be
   saved before automation routing is fully configured.

## Pros And Cons

Pros:

- Removes phase-coded completion-audit metadata from another Vue rewrite slice.
- Keeps the save/defer footer understandable without adding draft persistence,
  routing execution, provider calls, or Arr writes.
- Preserves the existing tests that cover disabled reasons, ready states, and
  close/save events.

Cons:

- Defer remains close-only until native draft persistence is designed.
- Save validation is still client-projected until server-owned policy
  validation replaces it.
- Accessibility and decision-load audit metadata still needs its own durable
  naming cutover.

## Final Recommendation Stack

- `docs/architecture/policy-authoring-save-defer-action-boundary.md`
- `server/src/services/policyAuthoringWorkflowCompletionAudit.mjs`
- `server/src/__tests__/services/policyAuthoringWorkflowCompletionAudit.test.mjs`
- `client/src/utils/policyBuilderActionBoundary.js`
- `client/src/components/policies/PolicyBuilderFooterActions.vue`
- `client/src/__tests__/utils/policyBuilderActionBoundary.test.js`
- `client/src/__tests__/PolicyBuilderFooterActions.test.js`

## Outcome

The cutover renamed the save/defer action-boundary architecture document,
updated the workflow completion audit slice to
`policy_authoring_save_defer_action_boundary`, updated roadmap links to the
durable artifact, and kept the existing Vue save/defer behavior unchanged.

## Next Step

Cut over the policy-authoring accessibility and decision-load audit naming
because it is the next Vue rewrite slice that still uses phase-coded
completion-audit metadata after the starter-template accelerator cutover.
