# Policy Builder State Extraction

Status: implemented for the next release line.

## Problem

`PolicyBuilderModal.vue` had become the owner of both presentation and deterministic policy-editing behavior:

- form defaults,
- selected starter template state,
- custom signal mutation,
- intent signal mutation,
- validation,
- generated policy names and descriptions,
- save payload construction,
- API fetching,
- modal layout.

That made policy intent work harder to test because every small behavior change required mounting the full modal.

## Official Source Research

Research target: current official guidance available as of May 2026. Reviewed June 12, 2026.

- [Vue Composables](https://vuejs.org/guide/reusability/composables) defines composables as functions that encapsulate and reuse stateful logic through the Composition API. Policy builder form and selected-template state fit this pattern.
- [Vue Testing](https://vuejs.org/guide/scaling-up/testing) recommends unit tests for composables and business logic, with component tests reserved for component interaction. The extracted state module can now be tested without a full modal mount.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) recommends structured validation and allow-lists. Client-side validation remains a UX guard only; server validation still owns policy semantics.
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html) emphasizes consistent API control boundaries. This refactor does not add endpoints or change authorization boundaries.
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/) provides a security verification baseline. Policy state extraction keeps secrets, provider prompts, and classification evidence out of client-side persistence.

## Recommendations

### 1. Extract Deterministic Builder State First

Move form defaults, selected templates, custom signal helpers, intent signal helpers, validation, and save-payload construction into a composable.

Pros:

- Makes policy save behavior independently testable.
- Reduces modal complexity before adding more intent UI.
- Keeps the policy API payload unchanged.

Cons:

- The modal still owns API fetching in this slice.

### 2. Leave Network Loading In The Modal For Now

Do not move library, preset, suggestion, or migration notice fetching in the same change.

Pros:

- Avoids mixing side-effect refactoring with save semantics.
- Keeps existing test mocks stable.
- Makes later extraction easier to review.

Cons:

- `PolicyBuilderModal.vue` still has orchestration work to split later.

### 3. Prove Legacy Preset Round-Trips

Add composable coverage that loads a legacy preset-backed policy and saves unrelated fields without dropping attached presets or `customSignals`.

Pros:

- Protects existing installs.
- Supports the legacy preset bridge plan.
- Reduces risk before the intent draft bridge.

Cons:

- It proves payload shape preservation, not full server-side scoring behavior.

### 4. Keep Server Validation Authoritative

The composable should construct compatible client payloads, but it should not become the semantic policy authority.

Pros:

- Preserves backend validation and normalization.
- Avoids security assumptions in browser state.
- Keeps future server-provided editor schema possible.

Cons:

- Some invalid combinations can still require server rejection or normalization.

## Final Stack

- Added `client/src/composables/usePolicyBuilderState.js`.
- Moved deterministic builder behavior into the composable:
  - form defaults,
  - policy-to-form mapping,
  - policy preset mapping,
  - selected starter template state,
  - custom signal cleanup,
  - intent signal helpers,
  - validation,
  - save payload construction.
- Kept `PolicyBuilderModal.vue` responsible for:
  - modal layout,
  - library/preset/suggestion/migration-notice fetching,
  - save/cancel event orchestration.
- Preserved existing policy save payload shape.
- Added composable tests for defaults, legacy mapping, generated payloads, legacy preset round-trip, and intent helper mutation.

## Implemented Outcome

The policy builder now has a smaller deterministic state boundary:

```text
PolicyBuilderModal.vue
  -> fetches data and renders sections
  -> delegates editable policy state to usePolicyBuilderState()

usePolicyBuilderState.js
  -> owns form state, selected templates, custom signals, validation, and save payloads
```

An existing preset-backed policy can be loaded into the composable, have an unrelated field such as `prompt_threshold` changed, and emit the same preset attachment plus `customSignals` structure on save.

## Security and Privacy Boundaries

- No secrets, API keys, provider prompts, embeddings, or media evidence are stored in the composable.
- Client-side validation only controls UI readiness; server-side policy validation remains authoritative.
- The refactor does not add API routes, database tables, or authorization changes.
- Save payloads continue through the existing policy CRUD endpoints and server normalization.

## Validation

Focused validation:

```bash
npm --prefix client run test -- --run PolicyBuilderModal usePolicyBuilderState policyIntentModel
```

Additional validation should include:

```bash
npm --prefix client run lint
npm --prefix client run build
git diff --check
```

## Follow-Up Design Items

1. Intent draft bridge

   Intent: introduce `usePolicyIntentDraft.js` so the UI edits purpose, hard limits, helpful hints, avoid rules, and review behavior instead of directly manipulating `customSignals`.

   Platform improvement: removes raw preset mechanics from the primary policy authoring model while preserving legacy save compatibility.

2. Policy builder data loading extraction

   Intent: move libraries, templates, suggestions, and migration notices into a separate composable once state semantics are stable.

   Platform improvement: leaves `PolicyBuilderModal.vue` as layout orchestration instead of data and state orchestration.

3. Server-provided editor schema

   Intent: expose allowed signal roles, operators, value catalogs, and constraints from the server.

   Platform improvement: prevents client/server semantic drift as policy intent editing grows.
