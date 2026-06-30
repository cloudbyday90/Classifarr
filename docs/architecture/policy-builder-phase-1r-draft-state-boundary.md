# Policy Builder Phase 1R Draft State Boundary

Status: implemented as the third Phase 1R client-boundary contract and
hardened with a draft-operation audit.

## Scope

Phase 1R.3 defines the client policy intent draft as an editable projection,
not durable policy authority.

This slice does not change draft behavior, save payload shape, legacy bridge
serialization, policy scoring, database schema, API contracts, or UI behavior.
It adds a server-owned ESM boundary contract that classifies draft fields,
allow-lists draft commands, and blocks UI-only or server-projection state from
being treated as save payload authority.

## Research Inputs

Official sources reviewed as of June 2026:

- Vue State Management:
  <https://vuejs.org/guide/scaling-up/state-management.html>
  - Shared state needs clear mutation paths and ownership.
- Vue Composables:
  <https://vuejs.org/guide/reusability/composables.html>
  - Stateful logic can be extracted into composables, but composables should
    expose deliberate state and command APIs.
- Vue Testing:
  <https://vuejs.org/guide/scaling-up/testing.html>
  - Tests should verify boundaries and behavior at the correct layer.
- OWASP Input Validation Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html>
  - Client-side validation is advisory; authoritative validation stays
    server-side.
- OWASP Mass Assignment Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html>
  - Write payloads should use allow-listed fields rather than broad client
    object assignment.
- NIST Secure Software Development Framework, SP 800-218:
  <https://csrc.nist.gov/publications/detail/sp/800-218/final>
  - Secure implementation requires defined responsibilities, verification
    criteria, and traceable boundaries.

## Recommendations

1. Treat client draft state as editable projection only:
   - derived from server/compatibility data,
   - editable by explicit commands,
   - validated by the server before save,
   - not durable policy authority.
2. Keep draft commands allow-listed and narrow:
   - sync from selected presets,
   - build selected presets from draft,
   - apply draft to selected presets,
   - add/remove signal values,
   - set/clear signal config,
   - set metadata and removal markers.
3. Separate draft fields by ownership:
   - declared intent edits,
   - compatibility payload metadata,
   - UI-only transient state,
   - server projection display state.
4. Keep save payload serialization explicitly allow-listed.
5. Treat `customSignals`, runtime semantics, metadata overrides, and removal
   markers as legacy bridge internals until Phase 8R native intent storage
   replaces them.
6. Audit public draft-state operations:
   - operation records must not claim durable authority,
   - operation records must not persist UI-only state,
   - operation records must not persist server projections,
   - operation records must reference only known allow-listed draft commands,
   - save payload builders must pass the payload allow-list boundary.

## Pros And Cons

### Pros

- Prevents the client draft from becoming the source of truth.
- Documents which draft fields are operator intent versus legacy compatibility
  metadata.
- Makes accidental UI-state serialization testable.
- Gives Phase 2R a precise compatibility bridge target.
- Keeps existing saves compatible while still preparing for native intent
  storage.
- Makes public draft-state operations traceable before Phase 2R and Phase 6R
  depend on them.

### Cons

- The current draft still serializes through legacy `customSignals` until Phase
  8R.
- Some product-facing events still use custom-signal naming until Phase 1R.5
  and Phase 2R contain the bridge.
- The contract does not yet move server projection display state out of current
  composables.
- Future Phase 6R work still needs to move evidence/readiness authority behind
  server-owned contracts.
- The operation audit is a boundary contract, not a replacement for runtime
  server validation.

## Final Stack

- Phase 1R.1 dependency:
  `server/src/services/policyBuilderPhase1BoundaryInventory.mjs`
- Draft boundary contract:
  `server/src/services/policyBuilderDraftStateBoundary.mjs`
- Unit coverage:
  `server/src/__tests__/services/policyBuilderDraftStateBoundary.test.mjs`
- Current draft implementation:
  - `client/src/composables/usePolicyIntentDraft.js`
  - `client/src/composables/usePolicyBuilderState.js`
  - `client/src/utils/policyIntentDraftBridge.js`
  - `client/src/utils/policyIntentWritePreflight.js`
- Roadmap:
  `docs/architecture/policy-builder-intent-model-roadmap.md`
- This implementation record:
  `docs/architecture/policy-builder-phase-1r-draft-state-boundary.md`

## Implemented Outcome

Phase 1R.3 defines draft field categories:

| Category | Meaning |
| --- | --- |
| Declared intent edit | Editable operator-intent projection, still server-validated before persistence. |
| Compatibility payload metadata | Legacy bridge metadata required for existing policy compatibility. |
| UI-only transient state | Browser state that must never serialize. |
| Server projection display | Read-only data from server projections or diagnostics. |
| Save allow-list field | Explicit fields allowed in policy save payloads. |

Allow-listed draft commands:

| Command | Notes |
| --- | --- |
| Sync from selected presets | Rebuilds draft projection from selected preset input. |
| Build selected presets from draft | Serializes bridge output without mutating current state. |
| Apply draft to selected presets | Applies bridge output to selected presets. |
| Add signal | Adds one allow-listed signal value. |
| Remove signal value | Removes one allow-listed signal value. |
| Set signal config | Sets one signal config through known value/metadata keys. |
| Set signal metadata | Sets metadata override keys through bridge ownership. |
| Set signal removal | Sets removed base-signal markers through bridge ownership. |
| Clear signal config | Clears one signal type without dropping unsupported custom fields. |

Tracked draft-state operations:

| Operation | Boundary Decision |
| --- | --- |
| Load or reset policy | May update form, selected presets, and UI expansion defaults; no durable authority. |
| Set form field | May update normalized allow-listed form fields. |
| Toggle preset selection | Compatibility selection only; draft remains a projection. |
| Set preset weight | Legacy starter-template metadata until native storage replaces it. |
| Toggle preset expansion | UI-only state that must never serialize. |
| Draft signal command | Declared-intent projection command routed through `usePolicyIntentDraft`. |
| Legacy custom signal alias | Temporary bridge alias for old component events. |
| Build save payload | Allow-listed compatibility payload builder; server validation remains required. |

The contract now exposes:

- `listDraftStateOperationRecords()`
- `getDraftStateOperationRecord(id)`
- `validateDraftStateOperation(operation)`
- `buildDraftStateBoundaryAudit(operations)`

The audit fails on unknown operations, unknown or disallowed commands, durable
authority claims, UI-only state persistence, server-projection persistence, and
unsafe save payloads.

Save payload allow-list:

```text
library_id, name, description, enabled, priority, sort_order,
auto_classify_threshold, prompt_threshold, require_ai_validation,
trust_patterns, trust_rag, trust_history, preset_weight, profile_weight,
pattern_weight, rag_weight, history_weight, combination_mode, presets,
policyIntentDraft
```

Prohibited save payload examples:

```text
libraryProfile, libraryProfileFreshness, libraryProfileRefreshResult,
availableGenreOptions, suggestedPresets, allPresets, combinedSignals,
impactPreview, replayPreview, searchQuery, selectedCategory,
expandedPresetIds, tmdbLivePreviewOptIn, presetMigrationNotice
```

## Phase 1R.3 Checklist Result

| Phase 0R Checklist Item | Result |
| --- | --- |
| Source of truth identified | Draft state is client projection; server validation and future native storage own durable authority. |
| Authority level identified | Draft state can express declared-intent edits but has no durable policy, evidence, learning, or migration authority. |
| Learning side effect identified | No learning side effects are added by this task. |
| Rollback or migration impact identified | Legacy bridge fields are identified as compatibility metadata until Phase 8R native intent storage. |
| Operator-facing language validated | No product copy changes were introduced; custom-signal terminology is marked as bridge/internal. |

## Follow-Up

The next Phase 1R task is **1R.4 Reference Data Boundary**. It should separate
static options, configured libraries, starter templates, observed profile
suggestions, routing/mapping status, and migration notices.
