# Policy Builder Phase 3R Vue Save And Defer Action Boundary

Status: implemented as the sixth Vue-facing Phase 3R workflow rewrite slice.

## Scope

This slice replaces the generic policy-builder footer with an explicit
save/defer boundary. Operators can now see whether saving is available, why it
is disabled, and that deferring closes the workflow without saving.

This slice does not add draft persistence, classification, learning, routing,
provider calls, TMDB calls, Arr writes, database schema, or server routes. It
preserves the existing save payload path and the existing close event.

## Research Inputs

Official sources reviewed as of June 2026:

- W3C WCAG 2.2, Labels or Instructions:
  <https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html>
  - Save controls need visible instructions that explain required input.
- W3C WCAG 2.2, Error Identification:
  <https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html>
  - When an action cannot be completed, the UI should identify what needs to be
    fixed.
- W3C WCAG 2.2, Status Messages:
  <https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html>
  - Save readiness should be programmatically exposed without forcing focus.
- GOV.UK Design System, Buttons:
  <https://design-system.service.gov.uk/components/button/>
  - Primary and secondary actions should be visually distinct and have clear
    labels.
- GOV.UK Design System, Error Message:
  <https://design-system.service.gov.uk/components/error-message/>
  - Blocking messages should be concise and point to the required correction.
- U.S. Web Design System, Button:
  <https://designsystem.digital.gov/components/button/>
  - Button labels should describe the action and disabled states should not be
    the only way information is communicated.
- U.S. Web Design System, Form Controls:
  <https://designsystem.digital.gov/components/form-controls/>
  - Required controls and validation state should include helper text and clear
    status.

## Recommendations

1. Keep save eligibility in a small utility rather than spreading footer rules
   through the modal template.
2. Preserve current save requirements:
   - selected library,
   - at least one starter template while the compatibility bridge is active,
   - scoring weights total 100%.
3. Treat incomplete routing as a non-blocking save warning, not a save blocker.
4. Rename cancel to **Defer for now** to match the Phase 3R workflow language
   without inventing draft persistence.
5. Expose disabled reasons in visible status text and button title text.
6. Preserve modal public events: defer emits the existing close event, save
   emits the existing save payload.

## Pros And Cons

### Pros

- Makes disabled save behavior understandable.
- Separates save readiness from routing readiness.
- Keeps footer behavior aligned with the destination-first workflow.
- Avoids adding premature draft-persistence or automation contracts.
- Keeps `PolicyBuilderModal.vue` focused on composition and command routing.

### Cons

- "Defer for now" currently closes without persistence until a future native
  draft system exists.
- The compatibility bridge still requires a starter-template attachment.
- Save readiness is client-projected until server-owned policy validation is
  introduced.
- Routing readiness is warning-only in this slice.

## Final Stack

- Save/defer boundary projection:
  `client/src/utils/policyBuilderActionBoundary.js`
- Footer action component:
  `client/src/components/policies/PolicyBuilderFooterActions.vue`
- Modal integration:
  `client/src/components/policies/PolicyBuilderModal.vue`
- Unit coverage:
  `client/src/__tests__/utils/policyBuilderActionBoundary.test.js`
  `client/src/__tests__/PolicyBuilderFooterActions.test.js`
  `client/src/__tests__/PolicyBuilderModal.test.js`

## Implemented Outcome

The policy-builder modal footer now renders:

- a polite status message explaining save readiness,
- a **Defer for now** action that closes without saving,
- a save/create button with an accessible disabled reason when save is blocked.

The save boundary reports these states:

- choose a library before saving,
- add a starter template before saving,
- adjust weights before saving,
- ready to save with routing setup still needed,
- ready to save.

The save path still calls `buildSavePayload()` and emits the existing `save`
event. The defer path emits only the existing `close` event.

## Follow-Up

The next high-value item is **Phase 3R Vue Starter Template Role Reset**. The
footer now makes the compatibility attachment requirement visible, but starter
template mechanics still occupy a large normal-path surface. The next slice
should continue moving templates into an accelerator role without changing the
save contract prematurely.
