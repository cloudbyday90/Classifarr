# Policy Builder Phase 3R Workflow Inventory And Cutline

Status: implemented as the first Phase 3R operator-workflow contract.

## Scope

Phase 3R.1 classifies the current policy-builder UI before adding or polishing
more controls. This checkpoint decides which artifacts can remain in the normal
policy-authoring path, which must be rewritten, which should be replaced by a
new component or server contract, and which should be deleted or moved to a
maintainer/verifier-only flow.

This document does not redesign the final screen layout. It creates the cutline
that later Phase 3R work must respect.

## Current Best-Practice Inputs

Official sources reviewed for this checkpoint:

- W3C WCAG 2.2: https://www.w3.org/TR/WCAG22/
- WAI-ARIA Authoring Practices Guide:
  https://www.w3.org/WAI/ARIA/apg/
- Vue Test Utils Guide: https://test-utils.vuejs.org/
- Vitest Guide: https://vitest.dev/guide/
- OWASP Mass Assignment Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html
- NIST Secure Software Development Framework SP 800-218:
  https://csrc.nist.gov/pubs/sp/800/218/final

The applied guidance:

- Keep interactions simple, perceivable, operable, and explainable before
  adding more UI.
- Prefer behavior-oriented component tests over layout snapshots for surfaces
  that are being redesigned.
- Treat UI as a command and presentation layer, not as policy authority.
- Keep diagnostic, migration, and provider internals out of the normal
  user-facing workflow.

## Recommendation Stack

1. Start Phase 3R with an executable inventory contract.
2. Require every policy-builder surface to have one of four decisions:
   - `keep`,
   - `rewrite`,
   - `replace`,
   - `delete`.
3. Allow only destination context, workflow shell, declared intent editing, and
   action-oriented readiness surfaces in the normal authoring path.
4. Keep starter templates as accelerators behind destination context, not as
   the primary model.
5. Remove replay, impact preview, provider readiness, raw scoring weights, and
   migration notices from the normal workflow.
6. Treat tests as support-only until Phase 3R.9 resets presentation coverage
   around the new product shape.

## Pros And Cons

### Explicit Workflow Inventory

Pros:

- Stops new UI work from accumulating around surfaces that should disappear.
- Gives each component a concrete product role before the rebuild.
- Catches new unclassified policy-builder files automatically.

Cons:

- Requires updates when files are renamed or new policy-builder components are
  added.
- Does not itself simplify the UI; it defines the safe starting point.

### Keeping Only Destination-Oriented Surfaces In Normal Path

Pros:

- Aligns the builder with the core Classifarr goal: understand what belongs in a
  media-server destination.
- Reduces operator decision load.
- Prevents diagnostics and provider state from becoming a second policy model.

Cons:

- Existing advanced and replay users may lose direct access unless those tools
  are rebuilt as explicit maintainer/verifier flows.

### Rewrite/Delete Candidate Tracking

Pros:

- Makes technical debt visible before more implementation.
- Gives Phase 6R and Phase 8R a clear deletion and migration verifier queue.

Cons:

- Later phases must follow through; otherwise the inventory becomes stale.

## Final Recommendation

Proceed with a destination-first rebuild:

```text
select library
  -> see observed destination meaning
  -> accept or edit declared intent
  -> confirm hard limits only when needed
  -> see readiness next action
  -> save or defer
```

The normal policy-authoring path must not require operators to understand replay
samples, provider readiness, TMDB coverage, scoring weights, raw preset JSON, or
legacy bridge internals.

## Implementation

The Phase 3R.1 implementation now provides:

- `server/src/services/policyBuilderPhase3WorkflowInventory.mjs`
  - classifies current policy-builder paths,
  - assigns keep/rewrite/replace/delete decisions,
  - marks normal-authoring versus migration/support-only surfaces,
  - validates that diagnostics, provider readiness, raw weights, starter
    templates, and tests do not enter the normal path.
- `server/src/__tests__/services/policyBuilderPhase3WorkflowInventory.test.mjs`
  - scans the live client tree,
  - verifies every current policy-builder surface is classified,
  - pins the cutline for modal shell, destination context, intent controls,
    starter templates, preview/replay diagnostics, advanced scoring, migration
    notices, bridge utilities, and tests.

## Current Inventory Summary

The live client tree currently classifies 93 policy-builder paths:

| Decision | Count | Meaning |
| --- | ---: | --- |
| Keep | 22 | Useful as-is for the destination-first model or implementation support. |
| Rewrite | 59 | Concept survives, but current shape is tied to old modal, tests, templates, or migration support. |
| Replace | 6 | Product need remains, but current UI/mechanic is the wrong model. |
| Delete | 6 | Normal workflow should not keep these surfaces; move to verifier/maintainer flow or remove. |

Role split:

| Role | Count |
| --- | ---: |
| Normal authoring path | 25 paths |
| Migration/support-only path | 68 paths |

Normal authoring can include:

- `PolicyBuilderModal.vue` as a workflow shell to rewrite,
- `PolicyBuilderLibraryContext.vue`,
- intent editor and leaf controls,
- destination/reference-data helpers,
- summary/readiness concepts after replacement into next-action surfaces.

Normal authoring must exclude:

- starter template browser/details/mechanics as first-class policy model,
- raw advanced scoring and weights,
- replay and impact preview panels,
- provider readiness and TMDB coverage diagnostics,
- migration notices,
- draft bridge internals,
- presentation tests.

## Phase 3R.1 Checklist Result

| Check | Result |
| --- | --- |
| Every current builder surface classified | Yes; live-tree scan has no unclassified paths. |
| Normal path recorded | Yes; normal-authoring paths are explicit in the contract summary. |
| Migration/support-only path recorded | Yes; templates, bridge internals, diagnostics, tests, and migration notices are support-only. |
| Diagnostic surfaces preserved as normal path | No; replay and impact preview diagnostics are delete/maintainer-verifier candidates. |
| New UI work gated by target role | Yes; new policy-builder files fail the live-tree test until classified. |

## Next Step

Continue with **Phase 3R.2 Destination-First Flow**. That task should define the
actual product flow around library selection, observed destination meaning,
declared intent, hard limits, routing readiness, and save/defer behavior.
