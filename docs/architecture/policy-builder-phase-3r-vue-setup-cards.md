# Policy Builder Phase 3R Vue Setup Cards

Status: implemented as the first Vue-facing Phase 3R workflow rewrite slice.

## Scope

This slice applies the Phase 0R.2 mental model and Phase 3R workflow reset to
the current policy-builder modal without rebuilding the full editor.

It adds a small setup-card surface that gives operators four plain next actions:

1. What already belongs here?
2. What should always or never belong here?
3. When should Classifarr ask?
4. Can this destination route?

This slice does not change saved policy payloads, server routes, classification
behavior, learning behavior, database schema, or Arr routing.

## Research Inputs

Official sources reviewed as of June 2026:

- W3C WCAG 2.2, Headings and Labels:
  <https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels.html>
  - The setup cards use descriptive headings so the purpose of each section is
    clear before the operator activates an action.
- W3C WCAG 2.2, Labels or Instructions:
  <https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html>
  - Each card has helper text and one explicit action label.
- W3C WCAG 2.2, Name, Role, Value:
  <https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html>
  - The card actions are real links with visible names and stable targets.
- U.S. Web Design System, Card:
  <https://designsystem.digital.gov/components/card/>
  - Cards are used as grouped entry points with concise headings, body copy, and
    clear actions.
- U.S. Web Design System, Form Controls:
  <https://designsystem.digital.gov/components/form-controls/>
  - The card copy keeps labels and instructions separate from later form
    controls.
- GOV.UK Design System, Content Design:
  <https://design-system.service.gov.uk/styles/content/>
  - The card language is direct, task-oriented, and avoids internal
    implementation vocabulary.

## Recommendations

1. Put the setup-card surface immediately after library context.
2. Use one card per Phase 0R setup question.
3. Make each action navigate to an existing modal section instead of creating a
   new state machine.
4. Keep migration verifier panels hidden from the default workflow unless an
   explicit verifier flag is provided.
5. Keep card content in a small client utility until the server exposes a
   product-copy endpoint or native policy-builder UI schema.

## Pros And Cons

### Pros

- Moves the visible workflow toward destination-first setup without a large
  rewrite.
- Gives operators clear entry points before advanced starter-template mechanics.
- Keeps the modal behavior compatible with existing save payloads.
- Uses accessible links rather than inert buttons or no-op controls.
- Creates a client-side contract that can be tested independently.

### Cons

- The card copy currently mirrors the server Phase 0R contract instead of being
  served dynamically.
- The actions navigate to existing broad sections because the detailed Phase 3R
  components are not fully rebuilt yet.
- The old intent editor and starter-template mechanics still exist below the new
  setup surface until later slices replace them.

## Final Stack

- Client setup-card contract:
  `client/src/utils/policyBuilderSetupCards.js`
- Client setup-card component:
  `client/src/components/policies/PolicyBuilderSetupCards.vue`
- Modal integration:
  `client/src/components/policies/PolicyBuilderModal.vue`
- Unit coverage:
  `client/src/__tests__/utils/policyBuilderSetupCards.test.js`
  `client/src/__tests__/PolicyBuilderSetupCards.test.js`
  `client/src/__tests__/PolicyBuilderModal.test.js`
- Related server contract:
  `server/src/services/policyUserMentalModel.mjs`

## Implemented Outcome

The policy-builder modal now renders `PolicyBuilderSetupCards` after the library
context. Each card links to one existing section:

| Setup Question | Action | Target |
| --- | --- | --- |
| What already belongs here? | Review suggestions | `#policy-builder-library-context` |
| What should always or never belong here? | Set destination rules | `#policy-builder-intent-editor` |
| When should Classifarr ask? | Set review triggers | `#policy-builder-intent-editor` |
| Can this destination route? | Check routing readiness | `#policy-builder-advanced-settings` |

Migration verifier panels remain outside the default workflow through
`showMigrationVerifierPanels`.

## Follow-Up

The next high-value item is **Phase 3R Vue Destination Section Split**: split the
current monolithic intent editor into setup-aligned subsections so `Set
destination rules` and `Set review triggers` can target distinct, simpler
components instead of the same editor anchor.
