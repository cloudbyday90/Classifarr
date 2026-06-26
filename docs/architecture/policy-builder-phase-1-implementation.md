# Policy Builder Phase 1 Implementation

Status: implemented. The form/save state, reference-data, advanced
template-signal helper, and combined-signal presentation slices are implemented.

## Scope

Phase 1 reduces `PolicyBuilderModal.vue` by moving stateful logic into tested
composables while preserving user behavior, API payload shape, policy scoring,
and legacy preset compatibility.

This slice extracted reference data and async side effects:

- media-server library loading,
- attachable starter-template loading,
- suggested starter-template loading,
- preset migration notice parsing/dismissal,
- starter-template filtering,
- starter-template usage labels,
- available genre/rating option derivation.

This continuation extracted advanced starter-template signal helpers:

- base signal lookup,
- language signal presentation,
- runtime semantics badges and summaries,
- strict/advisory language toggles,
- removed base-signal markers,
- custom keyword entry normalization.

This completion extracted combined-signal presentation:

- base and custom signal aggregation,
- removed base-signal filtering,
- source attribution,
- deterministic sorting,
- empty presentation shape.

## Research Inputs

- Vue Composables: Vue recommends extracting stateful logic into `use*`
  composables, returning refs so destructuring keeps reactivity, and accepting
  refs/getters for reactive inputs.
  <https://vuejs.org/guide/reusability/composables.html>
- Vue Test Utils: the official Vue testing library supports isolated component
  tests and keeps component behavior verifiable while logic moves into smaller
  units.
  <https://test-utils.vuejs.org/guide/>
- Vitest Mocking: injected clients and mocks keep async behavior deterministic
  and avoid network access during unit tests.
  <https://vitest.dev/guide/mocking.html>
- OWASP Input Validation Cheat Sheet: client-side validation and filtering are
  presentation helpers only; authoritative validation stays server-side.
  <https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html>

## Recommendations

1. Keep policy-builder refactors behavior-preserving until the intent draft
   bridge exists.
2. Extract cohesive modal responsibilities into small composables instead of
   one large store.
3. Use dependency injection for API clients and storage so composables are
   directly testable.
4. Keep browser-side filtering advisory; do not move trust or validation
   authority out of the server.
5. Preserve current preset/custom-signal payloads until Phase 8 native intent
   storage has parity and rollback proof.

## Pros and Cons

### Pros

- `PolicyBuilderModal.vue` has fewer async side effects and less filtering
  logic.
- The extracted reference-data logic can be tested without mounting the full
  modal.
- The modal still owns rendering and policy editing, so the refactor stays
  scoped.
- Injected clients make failure paths testable without real API calls.

### Cons

- The modal still contains advanced template signal mutation helpers.
- The modal still mixes display sections, base signal editing, and save actions.
- Internal names still use preset terminology because the API contract is still
  legacy-compatible.

## Final Stack

- Form and save payload state:
  `client/src/composables/usePolicyBuilderState.js`
- Reference data and async side effects:
  `client/src/composables/usePolicyBuilderReferenceData.js`
- Advanced template signal helpers:
  `client/src/composables/usePolicyBuilderTemplateSignals.js`
- Combined signal presentation:
  `client/src/composables/usePolicyBuilderCombinedSignals.js`
- Consumer:
  `client/src/components/policies/PolicyBuilderModal.vue`
- Tests:
  - `client/src/__tests__/composables/usePolicyBuilderState.test.js`
  - `client/src/__tests__/composables/usePolicyBuilderReferenceData.test.js`
  - `client/src/__tests__/composables/usePolicyBuilderTemplateSignals.test.js`
  - `client/src/__tests__/composables/usePolicyBuilderCombinedSignals.test.js`
  - `client/src/__tests__/PolicyBuilderModal.test.js`

## Implemented Outcome

- Added `usePolicyBuilderReferenceData` with injected API, preset, and storage
  dependencies.
- Moved libraries, attachable presets, suggestions, migration notices, category
  tabs, option derivation, filtering, and usage labels out of the modal.
- Kept `PolicyBuilderModal.vue` behavior and template bindings unchanged except
  for wiring them to the composable.
- Added unit tests for:
  - preset migration report parsing and dismissal,
  - initial data loading,
  - filtered starter-template lists,
  - genre/rating option derivation,
  - usage label generation,
  - suggestion loading and error fallback.
- Added `usePolicyBuilderTemplateSignals` for advanced starter-template signal
  helpers.
- Moved base signal lookup, runtime semantics presentation, language formatting,
  strict toggle behavior, removed-signal markers, and keyword addition out of
  the modal.
- Added unit tests for:
  - base signal lookup,
  - language formatting,
  - runtime badges and summaries,
  - strict override toggles,
  - removed-signal marker mutation,
  - normalized keyword addition.
- Added `usePolicyBuilderCombinedSignals` with a pure `buildCombinedSignals`
  function.
- Moved combined signal presentation out of the modal.
- Added unit tests for:
  - empty summary shape,
  - base and custom signal aggregation,
  - source attribution,
  - removed base-signal filtering,
  - reactive updates from selected template changes.

## Phase 1 Completion Boundary

Phase 1 is complete for the current modal decomposition target. The remaining
large work belongs to Phase 2: introduce an intent draft bridge so the UI edits
declared intent concepts instead of raw legacy `customSignals`.
