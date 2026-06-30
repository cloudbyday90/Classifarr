# Policy Builder Phase 3R Accessibility And Decision Load

Status: implemented as the eighth Phase 3R operator-workflow contract.

## Scope

Phase 3R.8 defines accessibility and decision-load requirements for the
re-imagined policy-builder surface before Vue screens are rebuilt.

This checkpoint does not change UI rendering, policy saves, scoring, routing,
database schema, or runtime learning. It creates a server-owned ESM contract
that future UI work can use to keep the normal workflow keyboard-accessible,
clearly labeled, and simpler than the current diagnostic-heavy builder.

## Current Best-Practice Inputs

Official sources reviewed as of June 2026:

- W3C WCAG 2.2, Labels or Instructions:
  <https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html>
  - Inputs need visible labels or instructions so users know what information
    to enter; too much instruction can be as harmful as too little.
- WAI-ARIA Authoring Practices Guide, Keyboard Interface:
  <https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/>
  - Custom interactive widgets need predictable keyboard operation and visible
    focus behavior.
- W3C WCAG 2.2:
  <https://www.w3.org/TR/WCAG22/>
  - Component state, labels, focus, and errors must be perceivable and operable.
- U.S. Web Design System, Form Controls:
  <https://designsystem.digital.gov/components/form-controls/>
  - Form controls should use clear labels, helper text, validation state, and
    grouped structure.
- GOV.UK Design System, Content Design:
  <https://design-system.service.gov.uk/styles/content/>
  - Product language should be direct, task-oriented, and avoid unnecessary
    detail.

## Recommendation Stack

1. Every normal policy-builder surface needs:
   - a visible accessible name,
   - concise helper text,
   - keyboard operation,
   - visible focus,
   - no internal diagnostic wording.
2. Normal workflow surfaces should expose no more than one primary action.
3. Readiness should show one highest-priority next action instead of several
   competing warnings.
4. Multi-select controls must expose selected state.
5. Chip-list removals must include accessible names that identify the removed
   value.
6. Disabled choices must explain why they are unavailable.
7. Hard-limit and blocking controls must require explicit confirmation.
8. Migration verifier diagnostics can exist outside the normal workflow, but
   they must not leak into destination setup.

## Pros And Cons

### Pros

- Gives future Vue work a clear accessibility contract before component
  rewrites.
- Keeps the normal setup path focused on one action at a time.
- Prevents old replay, provider, scoring, and parity panels from reappearing as
  normal user-facing controls.
- Makes multi-select, chip removal, disabled states, and readiness next actions
  testable without relying on visual snapshots.

### Cons

- This contract does not yet modify the current Vue components.
- The contract cannot prove final runtime accessibility until Phase 3R.9 adds
  presentation tests around rendered components.
- Some requirements are intentionally product-level constraints, so component
  implementation details still belong in later UI work.

## Final Recommendation

Use Phase 3R.8 as the acceptance contract for every rebuilt policy-builder
surface:

```text
Accessible name + helper text + keyboard/focus requirements
  -> one primary action in the normal path
  -> selected/disabled/removal state where relevant
  -> readiness exposes one next action
  -> diagnostics stay in migration verifier surfaces only
```

## Implementation

The Phase 3R.8 implementation provides:

- `server/src/services/policyBuilderPhase3AccessibilityDecisionLoad.mjs`
  - defines accessibility and decision-load surfaces for every Phase 3R target
    component,
  - maps normal workflow surfaces to one primary action,
  - pins multi-select state, chip removal naming, disabled reason, destructive
    confirmation, and single-next-action requirements,
  - blocks internal diagnostic language in normal workflow surfaces,
  - validates full component coverage.
- `server/src/__tests__/services/policyBuilderPhase3AccessibilityDecisionLoad.test.mjs`
  - verifies every target component has a Phase 3R.8 surface,
  - proves normal workflow surfaces stay keyboard/focus accessible and limited
    to one primary action,
  - proves readiness exposes one next action,
  - proves overloaded diagnostic surfaces fail the audit,
  - proves chip-list controls require accessible removal names.

## Phase 3R.8 Checklist Result

| Check | Result |
| --- | --- |
| Labels and helper text required | Yes; every surface requires both. |
| Keyboard and focus behavior specified | Yes; every surface requires keyboard operation and visible focus. |
| Disabled-state explanations required | Yes; picker, hard-limit, avoid, review-trigger, and starter-template surfaces require disabled reasons. |
| Multi-select state specified | Yes; intent picker, avoid, and review-trigger surfaces require selected-state exposure. |
| Chip removal names specified | Yes; declared intent chip lists require accessible removal names. |
| One next action preferred | Yes; readiness requires a single next action and normal surfaces allow at most one primary action. |
| Internal diagnostics excluded | Yes; normal workflow surfaces fail when they include internal diagnostic language. |

## Next Step

Continue with **Phase 3R.9 Presentation Test Reset**. That task should rewrite
presentation tests around the simplified workflow, accessible control contracts,
evidence-backed options, explicit hard limits, and readiness next actions
instead of preserving the old modal layout or diagnostic panels.
