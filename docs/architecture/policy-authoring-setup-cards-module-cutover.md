# Policy Authoring Setup Cards Module Cutover

Status: implemented.

## Scope

This cutover renames the setup-card design record and completion-audit entry
from roadmap-phase language to durable policy-authoring language.

The change does not modify Vue rendering, policy saves, server routes,
classification, learning, database schema, provider calls, or Arr routing. It
updates documentation and completion-audit evidence so production-owned records
no longer depend on a phase-coded setup-card document path.

## Official Sources Reviewed

Official sources reviewed as of June 2026:

- W3C WCAG 2.2, Headings and Labels:
  <https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels.html>
- W3C WCAG 2.2, Labels or Instructions:
  <https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html>
- W3C WCAG 2.2, Name, Role, Value:
  <https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html>
- U.S. Web Design System, Card:
  <https://designsystem.digital.gov/components/card/>
- U.S. Web Design System, Components:
  <https://designsystem.digital.gov/components/overview/>
- GOV.UK Design System:
  <https://design-system.service.gov.uk/>

## Recommendations

1. Use `policy_authoring_setup_cards` as the durable completion-audit id.
2. Keep setup-card documentation in `policy-authoring-setup-cards.md`.
3. Treat setup cards as product entry points, not roadmap rewrite artifacts.
4. Keep links, headings, helper text, and action labels as the testable
   behavior surface.
5. Leave historical Vue follow-up docs in place until their own cutover slices
   are addressed.

## Pros And Cons

### Pros

- Removes a phase-coded architecture path from the workflow completion audit.
- Keeps the setup-card behavior documented in operator-facing vocabulary.
- Preserves the existing Vue component/test stack without unnecessary churn.
- Reduces production naming inventory counts without changing runtime behavior.

### Cons

- Later Vue workflow docs still carry phase-coded filenames until they are cut
  over one at a time.
- The client component names still include `PolicyBuilder`, which is durable
  product language for the current feature and not part of this cleanup.

## Final Stack

- Design record:
  [Policy Authoring Setup Cards](policy-authoring-setup-cards.md)
- Completion gate:
  `server/src/services/policyAuthoringWorkflowCompletionAudit.mjs`
- Client component:
  `client/src/components/policies/PolicyBuilderSetupCards.vue`
- Client utility:
  `client/src/utils/policyBuilderSetupCards.js`

## Outcome

The completion audit now tracks `policy_authoring_setup_cards` and points at
the durable setup-card design record. Historical roadmap references remain in
roadmap/history docs only.

## Next Step

Cut over **Policy Authoring Destination Section Split** so the next Vue-facing
workflow design record no longer depends on a phase-coded architecture path.
