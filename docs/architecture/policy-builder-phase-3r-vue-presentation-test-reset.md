# Policy Builder Phase 3R Vue Presentation Test Reset

Status: implemented as the ninth Vue-facing Phase 3R rewrite slice.

## Scope

This slice applies the Phase 3R.9 presentation test reset to the highest-risk
client tests. It keeps the simplified policy-builder workflow protected while
stopping verifier-only impact and replay details from becoming normal
policy-authoring UI requirements.

The change does not remove the explicit migration verifier panels. It changes
their tests so they prove bounded, read-only verifier behavior without freezing
provider readiness, TMDB dry-run, scoring, parity, sample-selection, or
enrichment diagnostics as ordinary setup workflow.

## Current Best-Practice Inputs

Official sources reviewed as of June 2026:

- Vue Test Utils, A Crash Course:
  <https://test-utils.vuejs.org/guide/essentials/a-crash-course.html>
  - Component tests should mount the component, find rendered elements,
    interact with the UI, and assert observable behavior.
- Vue Test Utils, Event Handling:
  <https://test-utils.vuejs.org/guide/essentials/event-handling>
  - Emitted events are part of the public component contract and should be
    verified through `emitted()` instead of component internals.
- Vue Test Utils, API Reference:
  <https://test-utils.vuejs.org/api/>
  - Tests are stronger when they assert the visible effect of props, emitted
    events, or DOM updates rather than implementation details.
- Vitest, Writing Tests:
  <https://vitest.dev/guide/learn/writing-tests.html>
  - Each test should have a descriptive name and assertions tied to the
    behavior being verified.
- W3C WCAG, Name, Role, Value:
  <https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html>
  - Interactive controls need programmatically determinable names, roles,
    states, and values.
- W3C WCAG, Labels or Instructions:
  <https://www.w3.org/WAI/WCAG21/Understanding/labels-or-instructions.html>
  - Form controls and selectable options need labels or instructions that make
    the expected action clear.

## Recommendation Stack

1. Keep the modal presentation test focused on the destination-first setup
   path:
   - setup cards are visible,
   - one recommended next action is programmatically marked,
   - verifier panels remain absent unless explicitly enabled.
2. Keep impact preview tests verifier-only:
   - prove stale guidance is visible,
   - prove the panel states that preview is read-only,
   - prove the refresh button emits the bounded preview command.
3. Keep replay preview tests verifier-only:
   - prove read-only and no-execution language remains visible,
   - prove sample context can render,
   - prove the TMDB live-preview request remains disabled until the two-key
     gate is available,
   - avoid asserting provider, TMDB, scoring, parity, or sample-selection
     internals as normal presentation requirements.
4. Preserve explicit migration-verifier coverage in `PolicyBuilderModal.test.js`
   only behind `showMigrationVerifierPanels`.

## Pros And Cons

### Pros

- Stops the test suite from protecting abandoned diagnostic panel detail as
  normal product surface.
- Strengthens the real workflow assertion by checking the recommended next
  action and `aria-current` state.
- Keeps verifier panels testable without turning dry-run internals into UI
  obligations.
- Aligns component tests with observable behavior and accessible control
  contracts.

### Cons

- The replay card component still contains diagnostic sections for verifier
  mode; this slice only resets the test contract.
- Future Phase 6R work still needs to decide which replay/verifier component
  surfaces remain, move, or are removed.
- Fewer exact diagnostic assertions means server-side contracts must remain the
  owner for provider, TMDB, scoring, and parity details.

## Final Recommendation

Use this split for Phase 3R presentation tests:

```text
Normal workflow tests -> setup path, one next action, accessible labels
Verifier tests        -> read-only, no execution, explicit opt-in gates
Server tests          -> diagnostics, scoring, provider readiness, parity
```

This keeps the product workflow simple while leaving deeper diagnostics covered
by server contracts or explicit verifier-only tests.

## Implementation

Client tests updated:

- `client/src/__tests__/PolicyBuilderModal.test.js`
  - verifies the setup workflow exposes one recommended next action with
    `aria-current="step"` and an explanatory `aria-describedby` reference,
  - continues proving impact and replay verifier panels are absent from the
    default workflow.
- `client/src/__tests__/PolicyIntentImpactPreviewCard.test.js`
  - verifies stale impact previews remain read-only and emit only the preview
    command.
- `client/src/__tests__/PolicyIntentReplayPreviewCard.test.js`
  - reduces the main replay fixture to the operator-facing verifier contract,
  - preserves read-only, no-execution, sample, and TMDB opt-in gate assertions,
  - explicitly avoids requiring sample-selection, provider-readiness, and
    policy-engine diagnostic wording.

## Checklist Result

| Check | Result |
| --- | --- |
| Normal workflow protects one next action | Yes; modal setup card test checks `aria-current` on the destination action. |
| Verifier panels stay out of default workflow | Yes; modal test continues asserting impact and replay panels are absent unless explicitly enabled. |
| Impact verifier remains bounded | Yes; stale/read-only copy and preview emission are covered. |
| Replay verifier remains bounded | Yes; no-execution, read-only, sample context, and TMDB request gate are covered. |
| Diagnostic detail removed from presentation contract | Yes; the replay presentation test no longer requires sample-selection, provider-readiness, scoring, parity, or detailed TMDB coverage text. |

## Next Step

The next high-value item is Phase 6R.1: define the simplified runtime decision
pipeline contract that consumes the Phase 3R operator intent without carrying
the old replay/provider diagnostics into the normal authoring workflow.
