# Policy Builder Phase 1R Boundary Inventory

Status: implemented as the first Phase 1R client-boundary contract and
hardened with a live inventory freshness audit.

## Scope

Phase 1R.1 inventories current policy-builder client modules and assigns each
module to an ownership category before new UI, draft, evidence, or engine work
continues.

This slice does not change policy-builder UI behavior, save payloads,
classification scoring, preview execution, routing, database schema, or API
contracts. It adds a server-owned ESM inventory contract and test coverage that
classifies current client files by boundary ownership.

## Research Inputs

Official sources reviewed as of June 2026:

- Vue State Management:
  <https://vuejs.org/guide/scaling-up/state-management.html>
  - Shared client state should have clear ownership and mutation paths instead
    of being scattered through components.
- Vue Composables:
  <https://vuejs.org/guide/reusability/composables.html>
  - Stateful logic can be extracted into composables, but composables still need
    explicit boundaries and should not become hidden business engines.
- Vue Testing:
  <https://vuejs.org/guide/scaling-up/testing.html>
  - Unit and component tests should verify behavior at the appropriate layer
    without depending on fragile implementation details.
- OWASP Input Validation Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html>
  - Client validation is advisory; server-side validation and allow-listed
    inputs remain authoritative.
- OWASP Mass Assignment Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html>
  - Write payloads should use allow-listed fields rather than trusting broad
    client-side object state.
- NIST Secure Software Development Framework, SP 800-218:
  <https://csrc.nist.gov/publications/detail/sp/800-218/final>
  - Secure development requires defined responsibilities, traceable
    requirements, and verification before implementation.

## Recommendations

1. Classify policy-builder client files before changing them:
   - presentation only,
   - UI orchestration,
   - draft state,
   - legacy compatibility bridge,
   - reference data adapter,
   - engine candidate,
   - delete/replace after Phase 6R,
   - test boundary.
2. Keep `PolicyBuilderModal.vue` as orchestration only:
   - compose child components,
   - route commands,
   - handle save/cancel lifecycle,
   - do not infer evidence, readiness, migration parity, or learning.
3. Treat client draft state as editable projection only:
   - keep save serialization allow-listed,
   - keep native policy authority server-owned,
   - contain legacy payload mutation in bridge modules.
4. Split reference data from observed evidence:
   - static options are not evidence,
   - observed profile suggestions are evidence-backed suggestions,
   - provider-derived details should arrive through server projections.
5. Treat impact/replay/provider UI as temporary diagnostics:
   - Phase 6R must classify them as engine primitives, maintainer migration
     verifiers, or deletion candidates.
6. Keep the inventory fresh:
   - the live client-tree scan must fail on unclassified policy-builder modules,
   - every required boundary rule must have current file coverage,
   - legacy product surfaces must be classified explicitly rather than missed by
     a narrow filename matcher.
7. Treat the rule definitions as auditable architecture, not loose comments:
   - every boundary rule must declare an owner,
   - client modules must not be allowed to own engine authority,
   - engine candidates must point at the server-engine cutline,
   - delete/replace surfaces must require a Phase 6R verifier or deletion
     decision.

## Pros And Cons

### Pros

- Gives Phase 1R a current-state inventory instead of relying on memory of prior
  modal refactors.
- Prevents convenient client state from becoming accidental policy authority.
- Makes mixed-boundary modules visible before new work builds on them.
- Keeps legacy preset/custom-signal code bounded to bridge ownership.
- Adds a live client-tree test so new policy-builder files require boundary
  classification.
- Adds an explicit freshness audit so missing rule coverage is reported as a
  named architecture issue.
- Adds a rule-quality audit so future inventory rules cannot silently make
  client code authoritative or leave diagnostics without a cutline.

### Cons

- The inventory is a cutline, not a behavior refactor.
- Some current components still expose diagnostic UI until Phase 3R and Phase 6R
  decide whether to replace or delete them.
- Some client helpers are marked as engine candidates even though they remain
  display adapters for now.
- Future Phase 1R tasks still need component-level and composable-level
  refactors.
- Rule coverage proves that the inventory still sees a file for each required
  boundary, not that each file has already been refactored.
- Rule ownership is a planning contract; Phase 1R.2 through Phase 6R still own
  the actual component and engine refactors.

## Final Stack

- Phase 0R checklist dependency:
  `server/src/services/policyPhase0RChecklist.mjs`
- Boundary inventory contract:
  `server/src/services/policyBuilderPhase1BoundaryInventory.mjs`
- Unit coverage:
  `server/src/__tests__/services/policyBuilderPhase1BoundaryInventory.test.mjs`
- Roadmap:
  `docs/architecture/policy-builder-intent-model-roadmap.md`
- This implementation record:
  `docs/architecture/policy-builder-phase-1r-boundary-inventory.md`

## Implemented Outcome

Phase 1R.1 now classifies current policy-builder client files by rule. The test
suite scans the live `client/src` tree for policy-builder paths and fails if a
matching file has no ownership classification.

The contract also exposes `buildPolicyBuilderBoundaryInventoryAudit(filePaths)`.
That audit returns:

- rule-owner and cutline issues,
- unclassified policy-builder modules,
- required boundary rules with no current file coverage,
- the live inventory summary used by Phase 1R and later phase audits.

The contract also exposes `buildPolicyBuilderBoundaryRuleAudit()`, which checks
that each rule has an explicit owner, keeps `clientEngineAuthorityAllowed`
false, sends engine candidates to the server-engine cutline, and requires
Phase 6R decisions for delete/replace surfaces.

Boundary categories:

| Category | Meaning | Examples |
| --- | --- | --- |
| Presentation only | Renders props and emits explicit events. | `PolicyIntentGenreControl.vue`, `PolicyIntentSectionCard.vue` |
| UI orchestration | Coordinates lifecycle, composition, and commands. | `PolicyBuilderModal.vue`, `PolicyIntentEditor.vue` |
| Draft state | Holds editable client projection and save preparation. | `usePolicyBuilderState.js`, `usePolicyIntentDraft.js` |
| Legacy compatibility bridge | Reads/writes legacy preset/custom-signal projection. | `policyIntentDraftBridge.js`, `policyIntentModel.js` |
| Reference data adapter | Fetches or adapts options and observed-profile suggestions. | `usePolicyBuilderReferenceData.js`, `policyBuilderLibraryGenreOptions.js` |
| Engine candidate | Client display logic that may need server-side ownership. | `policyIntentSectionProjection.js`, `policyIntentSummary.js` |
| Delete/replace after Phase 6R | Diagnostic surfaces awaiting engine cutline. | Impact and replay preview components/utilities |
| Test boundary | Tests that must be reset by Phase 1R.6. | Policy-builder component/composable/util tests |

Boundary owners:

| Owner | Meaning |
| --- | --- |
| Client presentation | Renders approved data and emits explicit events only. |
| Client orchestration | Coordinates flow and commands without owning policy meaning. |
| Client draft projection | Holds editable state that remains subordinate to server validation. |
| Client compatibility bridge | Contains legacy preset/custom-signal projection while migration is incomplete. |
| Client reference adapter | Fetches or adapts options and observed-profile suggestions without becoming evidence authority. |
| Server engine candidate | Client helper logic that Phase 6R must either move server-side or reduce to display-only projection. |
| Maintainer verifier or delete | Diagnostic surfaces that must become verifier tools or be removed. |
| Test contract | Tests that protect architecture rules without freezing transitional UI. |

Mixed-boundary risks identified:

- `PolicyBuilderModal.vue` still composes normal workflow and diagnostic preview
  panels. Phase 1R.2 should keep it orchestration-only.
- `usePolicyBuilderState.js` mixes form state, preset selection, draft commands,
  and legacy payload serialization. Phase 1R.3 and 1R.5 should split ownership.
- `usePolicyBuilderReferenceData.js` mixes static options, starter templates,
  observed profile suggestions, and migration notice state. Phase 1R.4 should
  separate categories.
- Client section/readiness helpers are engine candidates. Phase 6R should decide
  what moves behind server-owned evidence/readiness contracts.
- Impact/replay preview UI is not the future product path by default. Phase 6R
  must classify it as maintainer verifier or delete/replace.
- `PolicyCombinedSignalsSummary.vue` exposes preset-era combined-signal language
  in the product path. It is now classified as a delete/replace candidate rather
  than being missed by the inventory matcher.

## Phase 1R.1 Checklist Result

| Phase 0R Checklist Item | Result |
| --- | --- |
| Source of truth identified | Client modules are not source of truth; they are presentation, orchestration, draft projection, adapters, bridges, diagnostics, or tests. |
| Authority level identified | Client modules cannot own durable policy authority, learning, evidence generation, migration verification, or engine decisions. |
| Learning side effect identified | No learning side effects are added by this task. |
| Rollback or migration impact identified | Legacy bridge and diagnostic surfaces are marked for Phase 5R/6R/8R cutlines before migration or deletion. |
| Operator-facing language validated | No product copy changes were introduced; diagnostic/product-surface risks are classified for later removal or replacement. |

## Follow-Up

The next Phase 1R task is **1R.2 UI Orchestration Boundary**. It should use this
inventory to narrow `PolicyBuilderModal.vue` to lifecycle, composition, command
routing, loading, error presentation, and save/cancel flow.
