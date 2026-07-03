# Policy Authoring Setup Cards

Status: implemented as the policy-authoring setup-card surface.

## Scope

Policy authoring setup cards provide the first visible entry points after the
library context in the policy-builder modal. The cards orient operators around
four product questions:

1. What already belongs here?
2. What should always or never belong here?
3. When should Classifarr ask?
4. Can this destination route?

This slice does not change saved policy payloads, server routes,
classification behavior, learning behavior, database schema, or Arr routing.
It documents and verifies the existing Vue setup-card surface with durable
product terminology.

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

1. Put the setup-card surface immediately after library context.
2. Use one card per product setup question.
3. Give each card a descriptive heading, concise helper text, and one explicit
   action.
4. Make each action navigate to an existing modal section instead of creating a
   new state machine.
5. Keep migration verifier panels hidden from the default workflow unless an
   explicit verifier flag is provided.
6. Keep card content in a small client utility until the server exposes a
   product-copy endpoint or native policy-builder UI schema.

## Pros And Cons

### Pros

- Moves the visible workflow toward destination-first setup without a large
  rewrite.
- Gives operators clear entry points before advanced starter-template
  mechanics.
- Keeps modal behavior compatible with existing save payloads.
- Uses accessible links rather than inert buttons or no-op controls.
- Creates a client-side contract that can be tested independently.

### Cons

- The card copy currently mirrors server vocabulary instead of being served
  dynamically.
- Actions navigate to existing broad sections because the detailed
  policy-authoring controls are still being cut over one component at a time.
- The old intent editor and starter-template mechanics still exist below the
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

The policy-builder modal renders `PolicyBuilderSetupCards` after the library
context. Each card links to one existing section:

| Setup Question | Action | Target |
| --- | --- | --- |
| What already belongs here? | Review suggestions | `#policy-builder-library-context` |
| What should always or never belong here? | Set destination rules | `#policy-builder-intent-editor` |
| When should Classifarr ask? | Set review triggers | `#policy-builder-intent-editor` |
| Can this destination route? | Check routing readiness | `#policy-builder-advanced-settings` |

Migration verifier panels remain outside the default workflow through
`showMigrationVerifierPanels`.

## Follow-Up Status

The setup cards now target distinct review behavior and destination-rule
sections instead of pointing both actions at one editor anchor. That follow-up
is documented in
[Policy Builder Phase 3R Vue Destination Section Split](policy-builder-phase-3r-vue-destination-section-split.md).
