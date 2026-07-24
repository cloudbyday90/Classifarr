# Policy Authoring Accessibility And Decision Load Audit

Status: implemented as durable policy-authoring accessibility and decision-load behavior.

## Scope

This design applies the durable
[Policy Authoring Accessibility](policy-authoring-accessibility.md) contract to
the current Vue authoring workflow, including setup cards and the save/defer
footer.

The change keeps all four setup cards visible, but only one card is marked as
the recommended next action. Secondary setup links remain available, and action
links now describe their status and completion context for assistive
technology.

This design does not change policy saves, scoring, routing, database schema,
runtime learning, AI calls, provider calls, Arr writes, or native intent
storage.

## Research Inputs

Official sources reviewed as of June 2026:

- W3C WCAG 2.2, Focus Order:
  <https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html>
  - Interactive content should preserve a meaningful order when users navigate
    by keyboard.
- W3C WCAG 2.2, Labels or Instructions:
  <https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html>
  - Actions and controls need clear labels or instructions so users understand
    what will happen next.
- WAI-ARIA Authoring Practices Guide, Keyboard Interface:
  <https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/>
  - Custom interactive flows need predictable keyboard operation and visible
    focus targets.
- U.S. Web Design System, Form Controls:
  <https://designsystem.digital.gov/components/form-controls/>
  - Grouped controls should expose clear labels, helper text, state, and
    validation or status context.
- GOV.UK Design System, Content Design:
  <https://design-system.service.gov.uk/styles/content/>
  - Product language should be plain, task-oriented, and avoid unnecessary
    detail.

## Recommendations

1. Keep setup cards as orientation, not four competing primary actions.
2. Mark exactly one setup-card action as the recommended next action:
   - first card with `needs_action`,
   - otherwise first `optional` card,
   - otherwise no recommendation when setup is complete.
3. Use `aria-current="step"` on the recommended action link.
4. Add a visible "Recommended next action" summary before the card list.
5. Attach action links to the card status, completion signal, and
   recommendation state with `aria-describedby`.
6. Keep secondary setup links available but visually quieter.
7. Avoid missing anchors:
   - when no starter template is selected, destination-rule and review-behavior
     setup links point to the intent editor empty state instead of invisible
     preset-backed sections.
8. When save is unavailable, expose the required correction in the existing
   save-status message and associate the disabled action with that message.
   Do not rely on a hover-only title tooltip or add a duplicate warning panel.

## Pros And Cons

### Pros

- Reduces decision load without hiding setup context.
- Gives keyboard and assistive-technology users one clear recommended next
  action.
- Keeps secondary actions available for operators who know where they want to
  go.
- Prevents setup-card links from pointing at missing sections when starter
  templates are absent.
- Preserves the existing modal composition and save behavior.

### Cons

- This still uses local client-side setup-card metadata; a later slice can
  consume the durable server field-group contract directly.
- No-template intent editing remains conservative until native intent storage
  replaces preset-backed draft commands.
- This does not remove legacy migration verifier panels; they remain gated
  outside the normal path.

## Final Stack

- Setup-card view model:
  `client/src/utils/policyBuilderSetupCards.js`
- Setup-card rendering:
  `client/src/components/policies/PolicyBuilderSetupCards.vue`
- Intent editor fallback target:
  `client/src/components/policies/PolicyIntentEditor.vue`
- Modal context wiring:
  `client/src/components/policies/PolicyBuilderModal.vue`
- Save/defer feedback:
  `client/src/components/policies/PolicyBuilderFooterActions.vue`
- Unit coverage:
  `client/src/__tests__/utils/policyBuilderSetupCards.test.js`
  `client/src/__tests__/PolicyBuilderSetupCards.test.js`
  `client/src/__tests__/PolicyIntentEditor.test.js`
  `client/src/__tests__/PolicyBuilderModal.test.js`

## Implemented Outcome

The policy-builder setup card surface now:

- computes one recommended next action from card state,
- renders a visible recommended-next-action summary,
- marks the recommended action with `aria-current="step"`,
- describes action links with card status, completion, and recommendation
  context,
- styles secondary actions as lower-emphasis links,
- routes no-template destination-rule and review-behavior actions to the intent
  editor empty state instead of missing anchors,
- renders the blocked save correction as the existing footer status message's
  single **Next** instruction and associates the disabled primary action with
  it without relying on a title tooltip or duplicate advisory panel,
- keeps save, defer, routing, and starter-template behavior unchanged.

## Follow-Up

The next high-value item is **Policy Authoring Presentation Test Reset**. Now
that the visible setup flow exposes one recommended next action, presentation
tests should stop preserving old diagnostic-heavy modal assumptions and instead
lock the simplified order, next-action behavior, accessible link state, and
absence of normal-path internal diagnostics.
