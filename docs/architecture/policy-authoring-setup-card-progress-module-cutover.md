# Policy Authoring Setup Card Progress Module Cutover

Status: superseded for the deleted compatibility grid. See [Policy Compatibility
Setup-Card Grid Retirement Audit](policy-compatibility-setup-card-grid-retirement-audit.md).

## Scope

This cutover records the prior setup-card state-binding evidence. The local
progress projection, recommended-next-action behavior, anchors, and focused
coverage are deleted with the disconnected compatibility grid.

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
2. Keep the server-owned native workflow as the only destination-progress and
   readiness presentation.
3. Remove local status derivation rather than preserve a duplicate read model.

## Pros And Cons

Pros:

- Removes phase-coded completion-audit metadata from another Vue rewrite slice.
- Removes stale state, navigation, and tests without adding API calls,
  persistence, or routing/classification side effects.

Cons:

- The server-side legacy setup-card data still needs its own consumer audit.

## Final Recommendation Stack

- `docs/architecture/policy-compatibility-setup-card-grid-retirement-audit.md`
- `server/src/services/policyAuthoringWorkflowCompletionAudit.mjs`
- `server/src/__tests__/services/policyAuthoringWorkflowCompletionAudit.test.mjs`

## Outcome

The prior cutover remains a historical naming record. The client projection,
grid, and focused tests are now deleted; the native workflow supplies the
current server-derived destination and readiness status.

## Next Step

Audit the server-side setup-card data in `policyUserMentalModel.mjs` and delete
unreachable card-specific contracts without disturbing active workflow data.
