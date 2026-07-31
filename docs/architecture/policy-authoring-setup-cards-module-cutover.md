# Policy Authoring Setup Cards Module Cutover

Status: superseded for the deleted compatibility grid. See [Policy Compatibility
Setup-Card Grid Retirement Audit](policy-compatibility-setup-card-grid-retirement-audit.md).

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
3. Treat the setup-card record as historical after the native workflow replaces
   the grid.
4. Retire stale links, headings, helper text, action labels, and focused tests
   with the disconnected component.
5. Keep the historical design record only as context for the deletion audit.

## Pros And Cons

### Pros

- Removes a phase-coded architecture path from the workflow completion audit.
- Keeps the setup-card behavior documented in operator-facing vocabulary.
- Removes an unmounted duplicate workflow and stale navigation targets.
- Reduces production naming inventory counts without changing runtime behavior.

### Cons

- Later Vue workflow docs still carry phase-coded filenames until they are cut
  over one at a time.
- The shared server mental-model card data needs a separate consumer audit.

## Final Stack

- Historical design record:
  [Policy Authoring Setup Cards](policy-authoring-setup-cards.md)
- Deletion outcome:
  [Policy Compatibility Setup-Card Grid Retirement Audit](policy-compatibility-setup-card-grid-retirement-audit.md)
- Completion gate:
  `server/src/services/policyAuthoringWorkflowCompletionAudit.mjs`
- Deleted client component:
  `client/src/components/policies/PolicyBuilderSetupCards.vue`
- Deleted client utility:
  `client/src/utils/policyBuilderSetupCards.js`

## Outcome

The prior completion-audit record remains historical. The client component,
utility, and focused tests are deleted because the native workflow owns the
current destination questions and readiness result.

## Next Step

Audit the server-side setup-card data in `policyUserMentalModel.mjs` and retain
only contracts with a current server workflow consumer.
