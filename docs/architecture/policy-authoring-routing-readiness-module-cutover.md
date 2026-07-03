# Policy Authoring Routing Readiness Module Cutover

Status: implemented.

## Scope

This cutover removes phase-specific naming from the routing-readiness surface
evidence while preserving the existing read-only client projection, status
message behavior, setup-card anchor target, and regression coverage.

## Official Guidance Reviewed

- W3C WCAG 2.2, Status Messages:
  https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
- W3C WCAG 2.2 Technique ARIA22:
  https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA22
- GOV.UK Design System, Summary List:
  https://design-system.service.gov.uk/components/summary-list/
- GOV.UK Design System, Warning Text:
  https://design-system.service.gov.uk/components/warning-text/
- U.S. Web Design System, Alert:
  https://designsystem.digital.gov/components/alert/
- U.S. Web Design System, Summary Box:
  https://designsystem.digital.gov/components/summary-box/

## Recommendations

1. Keep routing readiness named after the durable product behavior, not the
   roadmap slice that introduced it.
2. Keep the card read-only and status-oriented until a server-owned readiness
   result replaces the client projection.
3. Preserve `role="status"` and `aria-live="polite"` for state messages.
4. Preserve the existing `#policy-builder-routing-readiness` anchor because it
   is a stable UI target, not phase-coded product debt.
5. Keep one next action per incomplete routing state.

## Pros And Cons

Pros:

- Removes phase-coded completion-audit metadata from the routing readiness
  slice.
- Keeps the current setup-card routing target and card behavior unchanged.
- Preserves the accessibility rationale for status messages and read-only
  facts.

Cons:

- The client projection remains a temporary compatibility surface until
  runtime readiness owns the authoritative result.
- Later setup-card state binding still has phase-coded metadata until its own
  cutover.

## Final Recommendation Stack

- `docs/architecture/policy-authoring-routing-readiness.md`
- `server/src/services/policyAuthoringWorkflowCompletionAudit.mjs`
- `server/src/__tests__/services/policyAuthoringWorkflowCompletionAudit.test.mjs`
- `client/src/components/policies/PolicyBuilderRoutingReadinessCard.vue`
- `client/src/utils/policyBuilderRoutingReadiness.js`
- `client/src/__tests__/PolicyBuilderRoutingReadinessCard.test.js`
- `client/src/__tests__/utils/policyBuilderRoutingReadiness.test.js`

## Outcome

The cutover renamed the routing-readiness architecture document, updated the
workflow completion audit slice to `policy_authoring_routing_readiness`,
updated roadmap links to the durable artifact, and kept the existing read-only
status card, anchor target, and client projection behavior unchanged.

## Next Step

Cut over the policy-authoring setup-card progress naming because it is the
next Vue rewrite slice that still uses phase-coded completion-audit metadata.
