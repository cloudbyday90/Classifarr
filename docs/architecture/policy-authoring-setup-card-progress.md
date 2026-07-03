# Policy Authoring Setup Card Progress

Status: implemented as durable policy-authoring setup-card progress.

## Scope

This document defines how setup cards behave as a small read-only progress
surface. Each card reflects existing modal state and shows whether that step is
complete, needs setup, optional, or checking.

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

## Final Stack

- Setup-card state projection:
  `client/src/utils/policyBuilderSetupCards.js`
- Setup-card rendering:
  `client/src/components/policies/PolicyBuilderSetupCards.vue`
- Modal integration:
  `client/src/components/policies/PolicyBuilderModal.vue`
- Unit coverage:
  `client/src/__tests__/utils/policyBuilderSetupCards.test.js`
  `client/src/__tests__/PolicyBuilderSetupCards.test.js`
  `client/src/__tests__/PolicyBuilderModal.test.js`

## Implemented Outcome

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

The card action links remain unchanged except for the prior routing-readiness
target correction. Cards do not mutate policy, run routing, or call providers.

## Follow-Up

The next high-value item is **Policy Authoring Starter Template Accelerator**.
The setup flow now shows state and the modal footer has an explicit save/defer
boundary, but starter-template mechanics still occupy a large normal-path
surface. The next slice should keep templates as optional accelerators without
adding routing, learning, provider, or classification side effects.
