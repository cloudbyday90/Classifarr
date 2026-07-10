# Policy Builder Boundary Inventory

Status: implemented and hardened with a live inventory freshness audit.

## Scope

This document records the durable policy-builder boundary inventory contract. It
classifies current policy-builder client modules by ownership before additional
UI, draft, evidence, or engine work builds on them.

This slice does not change UI behavior, save payloads, classification scoring,
preview execution, routing, database schema, or API contracts. It provides a
server-owned ESM inventory contract and focused tests that keep client files
from quietly becoming policy-engine authority.

## Official Guidance Reviewed

Official sources reviewed as of June 2026:

- NIST Secure Software Development Framework:
  <https://csrc.nist.gov/projects/ssdf>
  - Design and implementation work should have explicit responsibilities,
    traceable requirements, and verification before release.
- NIST SP 800-128, Configuration Management:
  <https://csrc.nist.gov/pubs/sp/800/128/upd1/final>
  - Configuration and component state should be inventoried and controlled so
    drift is visible.
- OWASP Application Security Verification Standard:
  <https://owasp.org/www-project-application-security-verification-standard/>
  - Trust boundaries and server-side authorization/validation should be explicit
    rather than implied by client behavior.
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

## Recommendations

1. Keep a server-owned inventory of policy-builder client files.
2. Classify each file into a durable ownership category:
   presentation only, UI orchestration, draft state, legacy compatibility
   bridge, reference data adapter, engine candidate, rewrite/delete after engine
   cutline, test boundary, or unclassified.
3. Treat client draft state as editable projection only.
4. Treat static reference options and observed evidence as different inputs.
5. Treat preview, replay, advanced scoring, and legacy combined-signal panels as
   rewrite/delete candidates until an engine cutline assigns them a durable role.
6. Fail closed when a new policy-builder file has no boundary classification.
7. Fail closed when an inventory rule allows client engine authority, lacks an
   owner, or requires an engine cutline without declaring it.

## Pros And Cons

Pros:

- New policy-builder files cannot enter silently without ownership.
- Client code cannot become policy authority just because state is convenient.
- Mixed-boundary modules remain visible while refactors proceed.
- Legacy bridge and diagnostic UI are explicitly bounded.
- Tests assert the architecture contract without freezing layout snapshots.

Cons:

- The inventory is a boundary contract, not a behavior refactor by itself.
- Some client helpers remain display adapters until engine ownership decisions
  move or narrow them.
- Rule coverage proves classification exists; it does not prove each file has
  already been fully simplified.

## Final Stack

- Boundary inventory contract:
  `server/src/services/policyBuilderBoundaryInventory.mjs`
- Modal orchestration consumer:
  `server/src/services/policyBuilderModalOrchestrationContract.mjs`
- Test-boundary reset consumer:
  `server/src/services/policyBuilderTestBoundaryReset.mjs`
- Unit coverage:
  `server/src/__tests__/services/policyBuilderBoundaryInventory.test.mjs`
- Roadmap:
  `docs/architecture/policy-builder-intent-model-roadmap.md`

## Implemented Outcome

The inventory scans the live `client/src` tree for policy-builder modules and
fails if any matching file has no ownership classification.

The contract exposes:

- `classifyPolicyBuilderClientPath(filePath)`
- `summarizePolicyBuilderBoundaryInventory(filePaths)`
- `buildPolicyBuilderBoundaryInventoryAudit(filePaths, options)`
- `buildPolicyBuilderBoundaryRuleAudit(rules)`
- `validatePolicyBuilderBoundaryRule(rule)`
- `listPolicyBuilderBoundaryRules()`

Boundary categories:

| Category | Meaning | Examples |
| --- | --- | --- |
| Presentation only | Renders props and emits explicit events. | `PolicyIntentGenreControl.vue`, `PolicyIntentSectionCard.vue` |
| UI orchestration | Coordinates lifecycle, composition, and commands. | `PolicyBuilderModal.vue`, `PolicyIntentEditor.vue` |
| Draft state | Holds editable client projection and save preparation. | `usePolicyBuilderState.js`, `usePolicyIntentDraft.js` |
| Legacy compatibility bridge | Reads/writes legacy preset/custom-signal projection. | `policyIntentDraftBridge.js`, `policyIntentModel.js` |
| Reference data adapter | Fetches or adapts options and observed-profile suggestions. | `usePolicyBuilderReferenceData.js`, `policyBuilderLibraryGenreOptions.js` |
| Engine candidate | Client display logic that may need server ownership. | `policyIntentSectionProjection.js`, `policyIntentSummary.js` |
| Rewrite/delete after engine cutline | Diagnostic or legacy surfaces awaiting durable ownership. | Impact/replay preview utilities, combined-signal summary |
| Test boundary | Tests that protect architecture contracts without freezing transitional UI. | Policy-builder component/composable/util tests |

Boundary owners:

| Owner | Meaning |
| --- | --- |
| Client presentation | Renders approved data and emits explicit events only. |
| Client orchestration | Coordinates flow and commands without owning policy meaning. |
| Client draft projection | Holds editable state subordinate to server validation. |
| Client compatibility bridge | Contains legacy preset/custom-signal projection while migration is incomplete. |
| Client reference adapter | Fetches or adapts options and observed-profile suggestions without becoming evidence authority. |
| Server engine candidate | Client helper logic that must move server-side or reduce to display-only projection. |
| Maintainer verifier or delete | Diagnostic surfaces that must become verifier tools or be removed. |
| Test contract | Tests that protect architecture rules without freezing transitional UI. |

## Current Risk Register

- `PolicyBuilderModal.vue` still composes normal workflow and diagnostic preview
  panels. Modal orchestration work should keep it focused on lifecycle,
  composition, command routing, loading/error presentation, and save/cancel flow.
- `usePolicyBuilderState.js` mixes form state, preset selection, draft commands,
  and legacy payload serialization. Draft ownership work should split these
  responsibilities.
- `usePolicyBuilderReferenceData.js` mixes static options, starter templates,
  observed profile suggestions, and migration notice state. Reference-data work
  should separate options from evidence.
- Client section/readiness helpers are engine candidates. Engine cutline work
  should decide what moves behind server-owned evidence/readiness contracts.
- Impact/replay preview UI and combined-signal summary UI are not assumed to be
  the future product path. They must become verifier tools or be removed.

## Follow-Up

The next highest-value boundary task is the modal orchestration cutover: keep
`PolicyBuilderModal.vue` as flow coordination only, and route all policy meaning,
evidence, readiness, learning, and legacy payload work through owned contracts.
