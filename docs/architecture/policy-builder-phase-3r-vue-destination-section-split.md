# Policy Builder Phase 3R Vue Destination Section Split

Status: implemented as the second Vue-facing Phase 3R workflow rewrite slice.

## Scope

This slice splits the current policy intent editor into setup-aligned sections
without changing policy persistence, draft command semantics, server routes,
classification behavior, learning behavior, or routing.

The prior setup-card slice gave operators four plain actions, but two actions
still pointed to the same monolithic editor target. This slice gives those
actions distinct targets:

- `#policy-builder-review-behavior`
- `#policy-builder-destination-rules`

## Research Inputs

Official sources reviewed as of June 2026:

- W3C WCAG 2.2, Headings and Labels:
  <https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels.html>
  - The editor split uses descriptive section headings so operators can predict
    what each area contains.
- WAI-ARIA Authoring Practices, Keyboard Interface:
  <https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/>
  - Stable focusable targets and predictable navigation are required when
    actions move users between workflow sections.
- GOV.UK Design System, Task List:
  <https://design-system.service.gov.uk/components/task-list/>
  - Complex setup is easier to follow when broken into named tasks with a clear
    relationship to progress.
- GOV.UK Design System, Content Design:
  <https://design-system.service.gov.uk/styles/content/>
  - Section text should stay plain, direct, and action-oriented.

## Recommendations

1. Keep `PolicyIntentEditor.vue` as the command owner for now.
2. Add a pure grouping utility so the section split is testable outside Vue.
3. Keep readiness/review behavior visually separate from editable destination
   rule cards.
4. Do not create new save payloads or raw bridge mutations.
5. Use stable anchor IDs that match setup-card actions.

## Pros And Cons

### Pros

- Makes the setup-card actions concrete without a full editor rewrite.
- Preserves existing typed draft-command behavior.
- Creates a clean utility boundary for the eventual component extraction.
- Gives tests stable workflow groups instead of relying on incidental grid
  ordering.

### Cons

- `PolicyIntentEditor.vue` still renders several concerns while later slices
  extract smaller components.
- Review behavior currently wraps readiness summary; dedicated review-trigger
  controls still belong to a future slice.
- Routing readiness still targets advanced settings until routing-specific
  Phase 3R UI exists.

## Final Stack

- Editor grouping utility:
  `client/src/utils/policyIntentEditorGroups.js`
- Editor integration:
  `client/src/components/policies/PolicyIntentEditor.vue`
- Setup-card target updates:
  `client/src/utils/policyBuilderSetupCards.js`
- Unit coverage:
  `client/src/__tests__/utils/policyIntentEditorGroups.test.js`
  `client/src/__tests__/utils/policyBuilderSetupCards.test.js`
  `client/src/__tests__/PolicyBuilderSetupCards.test.js`
  `client/src/__tests__/PolicyIntentEditor.test.js`
  `client/src/__tests__/PolicyBuilderModal.test.js`

## Implemented Outcome

The editor now renders:

| Group | Target | Contents |
| --- | --- | --- |
| When should Classifarr ask? | `policy-builder-review-behavior` | Readiness summary and review next actions |
| What clearly belongs here? | `policy-builder-destination-identity` | Belongs Here |
| What should always or never belong here? | `policy-builder-destination-rules` | Helpful Matches, Hard Limits, Avoid |
| What helps after fit is clear? | `policy-builder-confidence-support` | Boosts |

The setup-card actions now point to these specific targets instead of a generic
editor anchor.

## Follow-Up

The next high-value item is **Phase 3R Vue Review Trigger Control**. The review
behavior group is now distinct, but it still only wraps readiness. The next
slice should add a bounded review-trigger control surface that lets operators
declare when Classifarr should ask without exposing replay, provider, or scoring
diagnostics.
