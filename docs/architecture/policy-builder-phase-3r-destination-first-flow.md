# Policy Builder Phase 3R Destination-First Flow

Status: implemented as the second Phase 3R operator-workflow contract.

## Scope

Phase 3R.2 defines the normal policy-authoring flow around the destination
library before templates, scoring mechanics, replay diagnostics, or legacy
payload details appear. The media-server library remains the source of observed
application. Operator-declared intent remains explicit.

This document defines flow order, destination questions, empty states, next
actions, and normal-path exclusions. It does not yet rebuild the Vue modal; that
work follows after the component-system reset.

## Current Best-Practice Inputs

Official sources reviewed for this checkpoint:

- W3C WCAG 2.2: https://www.w3.org/TR/WCAG22/
- WAI-ARIA Authoring Practices Guide:
  https://www.w3.org/WAI/ARIA/apg/
- Vue Test Utils Guide: https://test-utils.vuejs.org/
- Vitest Guide: https://vitest.dev/guide/
- OWASP Input Validation Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
- NIST Secure Software Development Framework SP 800-218:
  https://csrc.nist.gov/pubs/sp/800/218/final

The applied guidance:

- Put the user's primary task first and avoid making users traverse internal
  mechanics before they can understand the outcome.
- Keep interactions perceivable and operable by presenting one clear next action
  for each blocking state.
- Test deterministic workflow contracts rather than transitional layout.
- Keep untrusted or internal fields behind explicit validation and typed
  command boundaries.

## Recommendation Stack

1. Make library selection and observed destination meaning the first normal
   workflow steps.
2. Use five destination questions as the product language:
   - `What belongs here?`
   - `What should not go here?`
   - `What helps but should not decide alone?`
   - `When should Classifarr ask?`
   - `Can this route?`
3. Allow starter templates only after destination context is visible.
4. Empty states must show an operator next action:
   - new library -> sync media server library,
   - sparse library -> add declared intent,
   - unmapped library -> map routing destination.
5. Keep these mechanics out of the normal flow:
   - starter-template-first setup,
   - raw scoring weights,
   - replay/provider diagnostics,
   - legacy preset internals,
   - raw bridge storage.

## Pros And Cons

### Destination-First Flow

Pros:

- Operators reason about the library they already understand.
- Observed media-server contents become useful context without becoming
  automatic rules.
- The flow aligns with the target automation model: Classifarr asks for intent
  only where evidence or routing is insufficient.

Cons:

- Existing template-first users need the template browser repositioned as an
  accelerator.
- The current modal needs later structural work to match the flow.

### Explicit Empty-State Next Actions

Pros:

- New, sparse, and unmapped libraries become actionable instead of mysterious.
- Avoids exposing internals like replay readiness, provider state, or raw
  profile diagnostics to explain simple setup issues.

Cons:

- Later UI work must map each next action to a concrete component or settings
  route.

### Starter Templates Behind Destination Context

Pros:

- Templates can still speed setup.
- Templates stop being treated as the durable policy model.

Cons:

- Template detail/mechanics surfaces must be rewritten or moved out of the
  normal path.

## Final Recommendation

Use this normal workflow:

```text
select connected library
  -> review observed destination meaning
  -> accept or edit declared intent
  -> confirm hard limits
  -> confirm routing readiness
  -> save or defer
```

Only destination context, declared intent editing, hard-limit confirmation,
readiness next actions, and save/defer controls belong in the normal path.
Everything else must be a support/verifier flow or a later server-owned engine
contract.

## Implementation

The Phase 3R.2 implementation now provides:

- `server/src/services/policyBuilderPhase3DestinationFirstFlow.mjs`
  - declares ordered workflow steps,
  - declares destination questions,
  - declares empty states and next actions,
  - marks starter templates as allowed only after destination context,
  - lists forbidden normal-flow mechanics,
  - validates step sequence, starter-template placement, empty-state actions,
    and forbidden mechanics.
- `server/src/__tests__/services/policyBuilderPhase3DestinationFirstFlow.test.mjs`
  - pins the ordered workflow,
  - proves the question language,
  - verifies empty-state next actions,
  - blocks starter-template-first and internal mechanics from the normal flow.

## Phase 3R.2 Checklist Result

| Check | Result |
| --- | --- |
| Normal workflow defined | Yes; six ordered steps are pinned by contract tests. |
| Library context appears before policy mechanics | Yes; observed destination review is step 2 and templates are only allowed at step 3. |
| Destination questions replace generic sections | Yes; five product questions are declared in the contract. |
| Empty states are actionable | Yes; new, sparse, and unmapped libraries each map to one next action. |
| Starter templates are behind destination context | Yes; template use is allowed only during accept/edit declared intent. |
| Internals excluded from normal path | Yes; raw weights, replay/provider diagnostics, legacy preset internals, and raw bridge storage are forbidden mechanics. |

## Next Step

Continue with **Phase 3R.3 UI Component System And Interaction Reset**. That
task should define the reusable component vocabulary and interaction rules before
the Vue modal is rebuilt around this flow.
