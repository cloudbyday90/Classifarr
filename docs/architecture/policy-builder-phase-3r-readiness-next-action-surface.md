# Policy Builder Phase 3R Readiness And Next Action Surface

Status: implemented as the sixth Phase 3R operator-workflow contract.

## Scope

Phase 3R.6 replaces dense policy-builder diagnostics with a small
action-oriented readiness surface. The normal workflow should answer one
operator question: "What do I do next?"

This checkpoint defines visible readiness states, issue-to-action mapping,
destination workflow links, and verifier-only treatment for old preview,
replay, provider, TMDB, scoring, and parity surfaces.

## Current Best-Practice Inputs

Official sources reviewed for this checkpoint:

- WAI-ARIA Authoring Practices Guide:
  https://www.w3.org/WAI/ARIA/apg/
- W3C WCAG 2.2:
  https://www.w3.org/TR/WCAG22/
- OWASP API Security Top 10, API3:2023 Broken Object Property Level
  Authorization:
  https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/
- OWASP Input Validation Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
- NIST Secure Software Development Framework SP 800-218:
  https://csrc.nist.gov/pubs/sp/800/218/final
- Vue Test Utils Guide:
  https://test-utils.vuejs.org/
- Vitest Guide:
  https://vitest.dev/guide/

The applied guidance:

- Status messages should be short, programmatically identifiable, and tied to
  the control or section that resolves them.
- Operator-facing status should avoid exposing raw provider, replay, scoring,
  parity, or metadata payload details.
- Server-side projections should allowlist visible states and issue IDs rather
  than passing arbitrary diagnostic keys to the browser.
- Tests should verify issue-to-action behavior and diagnostic exclusion instead
  of preserving old panel layout.

## Recommendation Stack

1. Use six visible readiness states:
   - `Ready`,
   - `Needs examples`,
   - `Needs review`,
   - `Needs routing`,
   - `Blocked by hard limit`,
   - `Stale profile`.
2. Give every readiness issue exactly one next action.
3. Link every next action to one destination workflow step and resolving
   component or setting.
4. Select the highest-priority issue when multiple issues exist, but preserve
   the full issue list for secondary display.
5. Keep impact preview, replay preview, provider readiness, TMDB live preview,
   scoring details, and parity delta as migration verifier candidates only.
6. Reject unknown diagnostic surfaces from normal readiness.

## Pros And Cons

### Action-Oriented Readiness

Pros:

- Replaces diagnostic interpretation with a concrete next action.
- Keeps the normal workflow understandable without provider, scoring, replay, or
  parity knowledge.
- Gives future UI work stable state IDs and links.

Cons:

- Advanced operators lose immediate access to some diagnostic detail in the
  normal authoring path.

### Verifier-Only Diagnostics

Pros:

- Preserves support value during migration without making diagnostics the
  product model.
- Reduces accidental exposure of provider or scoring internals.
- Aligns with the Phase 3R cutline that diagnostics must not drive normal
  authoring.

Cons:

- Requires a separate maintainer/verifier entry point if those panels still need
  to exist during migration.

## Final Recommendation

Build the normal readiness surface as a small projection:

```text
readiness issue
  -> visible state
  -> one next action
  -> one resolving destination step/component
```

Everything else, including replay, provider, TMDB, scoring, parity, and impact
details, should stay out of the normal policy-authoring workflow.

## Implementation

The Phase 3R.6 implementation now provides:

- `server/src/services/policyBuilderPhase3ReadinessNextActionSurface.mjs`
  - defines the six visible readiness states,
  - defines six readiness issues mapped to one next action each,
  - links issues to destination flow steps and resolving components,
  - builds a prioritized readiness projection,
  - classifies old diagnostic surfaces as migration verifier only,
  - rejects unknown diagnostic surfaces in normal readiness.
- `server/src/__tests__/services/policyBuilderPhase3ReadinessNextActionSurface.test.mjs`
  - pins visible readiness states,
  - proves each issue has exactly one next action and one destination link,
  - checks highest-priority issue selection,
  - checks ready-state save action,
  - checks verifier-only diagnostic classification,
  - rejects unknown normal diagnostic surfaces.

## Phase 3R.6 Checklist Result

| Check | Result |
| --- | --- |
| Visible readiness states defined | Yes; six state IDs are pinned. |
| One next action per readiness issue | Yes; every issue maps to one action. |
| Links to resolving section or setting | Yes; each issue links to a destination flow step and component. |
| Raw diagnostics removed from normal workflow | Yes; replay, provider, TMDB, scoring, parity, and impact surfaces are verifier-only. |
| Readiness answers what to do next | Yes; projection returns the highest-priority next action. |
| Diagnostic panel tests redirected | Yes; server tests now protect readiness semantics and verifier-only diagnostics. |

## Next Step

Continue with **Phase 3R.7 Starter Template Role Reset**. That task should keep
starter templates useful as post-destination accelerators while preventing
template mechanics from becoming the normal policy mental model.
