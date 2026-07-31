# Policy Authoring Setup Card Progress

Status: superseded. The local setup-card progress projection and grid are
deleted. See [Policy Compatibility Setup-Card Grid Retirement
Audit](policy-compatibility-setup-card-grid-retirement-audit.md).

## Scope

This document records the prior browser-derived setup-card progress surface.
Each card projected modal state as complete, needs setup, optional, or checking.

This slice does not add API calls, persistence, routing execution, learning,
classification, provider calls, TMDB calls, or Arr writes. It derives setup-card
state only from projections already available in the policy builder modal:
selected library context, observed profile summary, policy intent summary,
profile freshness, and routing readiness.

## Research Inputs

Official sources reviewed as of June 2026:

- W3C WCAG 2.2, Status Messages:
  <https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html>
  - Status indicators should be programmatically determinable and should not
    require focus changes.
- W3C WCAG 2.2, Labels or Instructions:
  <https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html>
  - Each setup state needs a visible label and explanatory text.
- GOV.UK Design System, Task List:
  <https://design-system.service.gov.uk/components/task-list/>
  - Multi-step task surfaces should show the task name, status, and action
    separately.
- GOV.UK Design System, Summary List:
  <https://design-system.service.gov.uk/components/summary-list/>
  - Read-only state should be summarized instead of rendered as editable fields.
- U.S. Web Design System, Process List:
  <https://designsystem.digital.gov/components/process-list/>
  - Step-by-step workflows should make current progress and next action clear.
- U.S. Web Design System, Alert:
  <https://designsystem.digital.gov/components/alert/>
  - Warning state should use plain language and avoid exposing implementation
    detail.

## Recommendations

1. Keep setup cards as navigation and progress, not policy authority.
2. Use a small status vocabulary:
   - `complete`,
   - `needs_action`,
   - `optional`,
   - `loading`.
3. Derive status from existing projections only.
4. Keep one action link per setup card.
5. Do not expose raw legacy payload keys, SQL, provider status, replay details,
   score weights, TMDB data, or Arr diagnostic identifiers.
6. Keep dynamic state in a utility so card rendering remains presentational.

## Pros And Cons

### Pros

- Operators can see which setup steps still need attention without opening
  every section.
- Keeps the destination-first flow compact and scan-friendly.
- Avoids new server or database work before server-owned readiness contracts.
- Reduces the temptation to add more diagnostic panels.
- Keeps setup status testable outside the Vue component.

### Cons

- The status is only as complete as the existing modal projections.
- Profile and routing freshness still need future server-owned readiness.
- The cards do not yet know about manual outcomes or learning eligibility.
- Optional review-trigger state may become stricter after the
  automation-readiness engine is finalized.

## Historical Stack

- Deleted setup-card state projection:
  `client/src/utils/policyBuilderSetupCards.js`
- Deleted setup-card rendering:
  `client/src/components/policies/PolicyBuilderSetupCards.vue`
- Deleted focused coverage:
  `client/src/__tests__/utils/policyBuilderSetupCards.test.js`
  `client/src/__tests__/PolicyBuilderSetupCards.test.js`

## Historical Outcome

Each setup card now renders a status pill and short status message:

- **What already belongs here?**
  - complete when observed profile genre suggestions exist,
  - needs setup when no library/profile evidence is available,
  - checking while the profile is loading.
- **What should always or never belong here?**
  - complete when the draft has declared destination signals,
  - needs setup when the draft has none.
- **When should Classifarr ask?**
  - complete when operator-declared review triggers exist,
  - optional when only deterministic safeguards apply.
- **Can this destination route?**
  - complete when the routing readiness projection can route,
  - needs setup otherwise.

The card action links included a retired routing-readiness target. The grid is
deleted; the active native workflow owns the current server-derived readiness
status and next action.

## Follow-Up

The next high-value item is the **Phase 6R.5 policy user-mental-model
setup-card contract audit**. It must remove or reclassify server-side card data
that has no current operator-workflow consumer.
