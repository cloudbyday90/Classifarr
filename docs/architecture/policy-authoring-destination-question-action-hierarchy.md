# Policy Authoring Destination Question Action Hierarchy

Status: implemented as durable destination-question presentation behavior.

## Scope

Destination questions explain the policy areas that Classifarr evaluates. They
must not repeat generic workflow readiness instructions inside every card.

This change removes the generic projected `Next` text from
`PolicyBuilderDestinationQuestions`. It retains explicit recovery controls in
the card that owns them, including evidence refresh, library synchronization,
and library-mapping actions. Compatibility-policy editing retains its existing
single workflow-level readiness status.

This does not change policy intent, save eligibility, routing, learning,
provider activity, quota use, database schema, or API contracts.

## Official Sources Reviewed

Official sources reviewed as of June 2026:

- W3C WCAG 2.2, Labels or Instructions:
  <https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html>
  - Instructions should clearly identify the expected input without making
    users parse unnecessary repeated detail.
- W3C WCAG 2.2, Status Messages:
  <https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html>
  - Workflow status changes should be programmatically determinable without
    interrupting the current context.
- WAI-ARIA Authoring Practices Guide, Button Pattern:
  <https://www.w3.org/WAI/ARIA/apg/patterns/button/>
  - An action control needs a clear purpose and description; descriptive text
    should not impersonate a local command when no local action exists.

## Recommendations

1. When generic automation readiness is needed, show it once at the workflow
   level.
2. Keep a destination card's local next step only when the card presents the
   control that performs that specific recovery.
3. Keep card headings, question text, helper text, and status badges so each
   policy area remains understandable without a generic `Next` label.
4. Preserve native contextual guidance where policy creation and later routing
   are intentionally separate.
5. Do not create a new readiness state, action, route, or persistence path to
   compensate for removed presentation text.

## Pros And Cons

### Pros

- Removes repeated advisory wording and reduces decision load.
- Leaves actionable evidence and routing recovery controls in their owning
  question card.
- Keeps compatibility editing's single workflow-level readiness status as the
  source of generic automation guidance.
- Preserves keyboard focus order because no interactive control is removed.

### Cons

- A card no longer repeats the generic readiness label for users scanning only
  that card; its status and helper text remain available.
- The native path deliberately presents routing as context or an explicit
  recovery action rather than a global automation-readiness instruction.

## Final Stack

- Destination-question rendering:
  `client/src/components/policies/PolicyBuilderDestinationQuestions.vue`
- Explicit question-scoped readiness recovery:
  `client/src/components/policies/PolicyDestinationEmptyStateNotice.vue`
- Component regression coverage:
  `client/src/__tests__/PolicyBuilderDestinationQuestions.test.js`
  `client/src/__tests__/PolicyBuilderWorkflowShell.test.js`

## Implemented Outcome

`PolicyBuilderDestinationQuestions` no longer renders generic projected
readiness labels such as `Next: Connect a routing target`. It still renders
explicit recovery actions in the question that owns them and native contextual
guidance that explains that policy creation does not route media. The
unreachable generic readiness card is retired. Native creation keeps only
server-projected question-scoped recovery actions, and it renders observed
controls only from selectable server values or an admitted custom entry.
