# Policy Builder Phase 2 Implementation

Status: in progress
Scope: intent draft bridge, legacy-compatible save contract

## Goal

Phase 2 moves the policy builder toward an intent-first internal model without
changing database storage, API payloads, or classification scoring behavior.

The first implemented component is a reversible draft bridge:

1. Read selected legacy presets and their `customSignals`.
2. Project the editable pieces into intent buckets:
   - `identity_signals`
   - `compatibility_signals`
   - `strict_constraints`
   - `boosters`
   - `exclusions`
3. Preserve source metadata and unsupported legacy fields.
4. Serialize the draft back to the current preset-backed `customSignals`
   payload.

This gives later UI work a product model to edit while keeping rollback simple.

The second implemented component wraps that bridge in a reactive composable and
uses it inside the policy builder state layer:

1. Keep `intentDraft` synchronized with selected presets.
2. Route intent helper commands through draft operations.
3. Apply the draft before building the legacy save payload.
4. Move advanced legacy template controls onto draft commands as each field
   gains equivalent round-trip coverage.

The third implemented component moves the intent editor read model onto the
draft boundary:

1. Normalize draft buckets into the existing editor entry shape.
2. Pass `intentDraft` from `PolicyBuilderModal.vue` into
   `PolicyIntentEditor.vue`.
3. Let the editor render draft state first, while retaining the legacy selected
   preset projection as a fallback.
4. Keep the editor's existing event contract unchanged so writes still flow
   through `usePolicyIntentDraft` via `usePolicyBuilderState`.

The fourth implemented component moves the editor write boundary onto draft
command terminology:

1. Emit draft-scoped edit events from `PolicyIntentEditor.vue`.
2. Validate emitted payloads before Vue dispatches them.
3. Route those draft commands through `PolicyBuilderModal.vue` into
   `usePolicyIntentDraft`.
4. Keep the legacy save payload identical by continuing to serialize through
   `applyPolicyIntentDraftToSelectedPresets`.

The fifth implemented component adds modal-level no-op save parity coverage:

1. Open existing legacy policies through the full policy-builder modal.
2. Save without making intent edits.
3. Assert legacy `customSignals` and API-shaped `custom_signals` payloads are
   preserved after draft bridge serialization.
4. Cover metadata-only legacy fields, removed markers, unsupported custom
   blocks, explicit weights, and snake_case API input.

The sixth implemented component moves the first advanced template control into
draft ownership:

1. Add draft-level signal metadata overrides for metadata-only fields such as
   `language.strict`.
2. Route the language strict/advisory modal toggle through
   `usePolicyIntentDraft` instead of direct `customSignals` mutation.
3. Remove stale metadata when an override is changed back to the base template
   value.
4. Preserve unrelated legacy fields and signal values during metadata updates.
5. Avoid inventing identity/compatibility `semantics` metadata from bucket
   placement alone; only explicit metadata is serialized.

The seventh implemented component moves base-signal removal markers into draft
ownership:

1. Add draft-level `signalRemovalOverrides` projected from
   `customSignals.removed`.
2. Serialize removal markers from the draft instead of preserving stale legacy
   nested arrays.
3. Route advanced-template mark/restore controls through `usePolicyIntentDraft`
   via `usePolicyBuilderState`.
4. Keep the template helper read-only for removal state.
5. Clean empty removal markers when an operator restores a base signal.

The eighth implemented component moves custom added signal values into draft
ownership:

1. Add a draft-level `removeSignalValue` command that removes one
   allow-listed signal value and marks a signal type cleared when the final
   draft-managed value is removed.
2. Route advanced-template add/remove controls for ratings, genres, languages,
   and keywords through `usePolicyIntentDraft` via `usePolicyBuilderState`.
3. Keep keyword input as UI-local transient state while using the draft command
   path for the saved value.
4. Reduce `usePolicyBuilderTemplateSignals` to read/format helpers for this
   area instead of legacy `customSignals` mutation.
5. Preserve unsupported legacy fields while clearing stale draft-managed fields
   when an added custom value is removed.

The ninth implemented component extracts advanced starter-template details from
the modal:

1. Move the ratings, genre, keyword, language, removal-marker, and strict-mode
   detail panel into `PolicyStarterTemplateDetails.vue`.
2. Keep the component read/model focused: it renders base/custom signal state
   and emits explicit add/remove/strict/removal payloads.
3. Keep draft mutation and save-payload ownership in `PolicyBuilderModal.vue`
   and `usePolicyBuilderState`.
4. Add direct component coverage for rendered signal state and event payloads.
5. Preserve the current modal save behavior through existing modal regression
   tests.

The tenth implemented component extracts the selected starter-template shell
from the modal:

1. Move selected starter-template rows, runtime badges, details expansion,
   weight input, and remove controls into `PolicySelectedStarterTemplates.vue`.
2. Keep details rendering delegated to `PolicyStarterTemplateDetails.vue`.
3. Replace nested `v-model` mutation of selected preset weights with an
   explicit `setPresetWeight` state command.
4. Bound preset weight updates to the supported UI range before save payload
   construction.
5. Keep draft-backed add/remove/removal/strict events flowing upward through
   explicit component events.

## Research Inputs

- [Vue Composables](https://vuejs.org/guide/reusability/composables.html):
  Vue recommends extracting reusable stateful logic into composables and
  keeping concerns isolated as components grow.
- [Vue Watchers](https://vuejs.org/guide/essentials/watchers.html):
  reactive side effects should be explicit and tied to the state they observe,
  which fits synchronizing a draft from selected preset changes.
- [Vue Props](https://vuejs.org/guide/components/props.html) and
  [Component Events](https://vuejs.org/guide/components/events.html):
  parent-owned state should flow down through props and user actions should flow
  back through explicit events. This matches passing `intentDraft` into the
  editor while keeping edit commands as emitted events. It also supports naming
  those events after the parent-owned draft command rather than the legacy
  storage shape.
- [Vue Computed Properties](https://vuejs.org/guide/essentials/computed.html):
  derived view state should be declarative and cached instead of hand-mutated.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html):
  security-sensitive structured inputs should use positive validation and
  explicit expected fields.
- [OWASP Mass Assignment Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html):
  server-facing payload construction should avoid broad object passthrough and
  only serialize intended fields.

## Recommendation Stack

Recommended approach:

- Use a pure utility bridge before a reactive composable.
- Put reactive synchronization and edit commands in `usePolicyIntentDraft`.
- Put draft-to-editor projection in a small pure adapter instead of embedding
  normalization logic inside the component.
- Keep the current `customSignals` save contract until native intent storage
  exists.
- Name component edit events after draft commands, not legacy custom-signal
  implementation details.
- Prove modal-level no-op save parity before moving more controls into draft
  ownership.
- Move advanced controls into draft ownership one narrow metadata/control type
  at a time, with explicit round-trip coverage for clearing back to template
  defaults.
- Keep legacy mutation helpers out of the template helper once a control has a
  draft command path.
- Keep UI event parsing at the modal edge and store only normalized,
  draft-command payloads in the state layer.
- Extract dense UI panels once their write paths are represented as explicit
  events instead of direct parent-state mutation.
- Treat draft serialization as an allow-listed transformation, not a generic
  object merge.
- Preserve unknown legacy fields so existing policies do not silently lose
  behavior.
- Only rewrite signal types that are explicitly draft-managed or explicitly
  cleared. Metadata-only legacy edits, such as current advanced template strict
  toggles, must remain intact until the draft model owns them.
- Add tests for no-op round trips, controlled draft edits, and immutability
  before wiring the modal to the draft.

Pros:

- Low behavioral risk.
- Easy to test independently from the modal.
- Keeps existing policies and presets compatible.
- Establishes a clean boundary for the later intent-first UI.

Cons:

- Some advanced legacy details still read from the compatibility
  `customSignals` projection until native intent storage exists.
- Native intent persistence is intentionally deferred to the storage migration
  phase.
- Some mixed legacy shapes remain constrained by what `customSignals` can
  express.
- Dual representations exist temporarily: the UI edits the draft, while the
  saved compatibility payload remains `customSignals`.

Rejected for this slice:

- Direct database migration to native intent tables. That belongs after parity
  validation.
- Full UI rewrite. The current save path needs a reversible bridge first.
- Generic JSON editor behavior. That would keep exposing implementation
  details to users.

## Implemented Component

File: `client/src/utils/policyIntentDraftBridge.js`

Exports:

- `POLICY_INTENT_DRAFT_SCHEMA_VERSION`
- `buildPolicyIntentDraft(selectedPresets)`
- `applyPolicyIntentDraftToSelectedPresets(selectedPresets, draft)`

The bridge builds a draft with:

- schema version,
- migration state,
- preset source metadata,
- legacy custom-signal snapshot,
- runtime semantics passthrough,
- intent buckets,
- summary counts.

Serialization rules:

- Start from preserved legacy `customSignals`.
- Remove only allow-listed draft-managed signal fields.
- Rebuild those fields from the draft buckets.
- Preserve unsupported custom fields and `removed` markers.
- Return `null` when no custom signals remain.

File: `client/src/composables/usePolicyIntentDraft.js`

Exports:

- `usePolicyIntentDraft(selectedPresets)`

The composable owns:

- `intentDraft`,
- `syncFromSelectedPresets`,
- `buildSelectedPresetsFromDraft`,
- `applyDraftToSelectedPresets`,
- `addSignal`,
- `removeSignalValue`,
- `setSignalConfig`,
- `setSignalMetadata`,
- `setSignalRemoval`,
- `clearSignalConfig`.

`buildSelectedPresetsFromDraft` is the read-only serializer used by
`buildSavePayload`; `applyDraftToSelectedPresets` is reserved for edit commands
that intentionally update selected preset state. `usePolicyBuilderState` now
uses this composable for the existing
`addIntentSignal`, `setIntentSignalConfig`, `clearIntentSignalConfig`, and
`buildSavePayload` paths. The public modal API remains unchanged.

File: `client/src/utils/policyIntentDraftView.js`

Exports:

- `buildPolicyIntentViewFromDraft(intentDraft)`

This adapter converts draft buckets into the same view shape previously
returned by `buildPolicyIntentView`, including `role`, `preset_id`,
`preset_name`, `signal_type`, `values`, `semantics`, and `constraint_mode`.

`PolicyIntentEditor.vue` now prefers this draft view when `intentDraft` is
provided and falls back to the legacy selected-preset projection otherwise. Its
write events are now draft-command scoped:

- `draft-add-signal`
- `draft-set-signal-config`
- `draft-clear-signal-config`

The event payload shape remains intentionally narrow and preset-scoped so the
modal can route commands to `usePolicyIntentDraft` without exposing raw
`customSignals` editing as the public component contract.

## Security Notes

- The bridge is intentionally allow-list based.
- Draft serialization does not blindly copy arbitrary top-level draft fields into
  the save payload.
- The browser-side utility does not handle secrets.
- Server-side validation still remains authoritative for actual policy saves.

## Validation

Added tests in
`client/src/__tests__/utils/policyIntentDraftBridge.test.js` covering:

- empty draft shape,
- legacy custom-signal projection,
- no-op round-trip compatibility,
- controlled allow-listed draft edits,
- input immutability.

Added tests in
`client/src/__tests__/composables/usePolicyIntentDraft.test.js` covering:

- selected-preset synchronization,
- draft-backed add commands,
- set/append signal config commands,
- clearing draft-managed signals while preserving unsupported fields,
- read-only draft serialization,
- safe no-op behavior for missing presets.

Added tests in
`client/src/__tests__/utils/policyIntentDraftView.test.js` covering:

- draft-to-editor entry normalization,
- empty draft fallback view shape.

Updated modal regression coverage to prove `PolicyIntentEditor.vue` renders
entries from draft state, not only from selected preset/custom-signal
projection.

Added tests in `client/src/__tests__/PolicyIntentEditor.test.js` covering:

- draft add-signal command emission,
- draft signal config command emission,
- draft clear command emission,
- removal of the legacy editor event names from the public event surface.

Added modal-level parity tests in
`client/src/__tests__/PolicyBuilderModal.test.js` covering:

- unchanged legacy `customSignals` with identity, hard-limit, metadata-only,
  removed-marker, and unsupported custom blocks,
- unchanged API-shaped `custom_signals` input,
- preset weight preservation through draft-backed save.

Added metadata-ownership tests covering:

- metadata-only signal override projection and no-op round trip,
- clearing metadata-only overrides while preserving unsupported fields,
- setting and clearing `language.strict` through `usePolicyIntentDraft`,
- preserving signal values when strict metadata returns to the base template
  value,
- policy-builder state exposure for draft-backed metadata updates.

Added removal-marker ownership tests covering:

- projection and no-op round trip of `customSignals.removed`,
- cleanup of empty restored removal markers,
- draft-backed mark and restore commands,
- policy-builder state exposure for removal commands,
- modal-level mark and restore behavior through the draft-backed API.

Added custom-signal ownership tests covering:

- draft-backed add and remove commands,
- duplicate add normalization,
- clearing the final draft-managed value back to `null`,
- false returns for missing value removals,
- policy-builder state exposure for custom add/remove commands,
- modal-level custom add/remove behavior through the draft-backed API,
- read-only template helper behavior for controls now owned by the draft.

Added starter-template details extraction tests covering:

- base/custom signal rendering,
- removed-marker visual state,
- language/runtime presentation,
- select-driven custom signal payloads,
- normalized keyword payloads,
- custom signal removal payloads,
- base signal removal payloads,
- strict-mode payloads.

Added selected-template shell tests covering:

- selected template count and row rendering,
- runtime badge/details rendering,
- toggle/remove event payloads,
- bounded weight update event payloads,
- pass-through detail event payloads,
- state-level preset weight bounds and invalid input handling.

Regression found and fixed:

- Advanced template strict toggles can be metadata-only legacy custom signals.
  The serializer originally stripped those fields because they were known draft
  metadata keys, even when no draft entry managed that signal type. The bridge
  now rewrites only draft-managed or explicitly cleared signal types.

Targeted test command:

```bash
npm --prefix client run test -- policyIntentDraftBridge.test.js policyIntentModel.test.js
```

Expanded focused validation:

```bash
npm --prefix client run test -- usePolicyIntentDraft.test.js usePolicyBuilderState.test.js policyIntentDraftBridge.test.js PolicyBuilderModal.test.js
```

Draft view validation:

```bash
npm --prefix client run test -- policyIntentDraftView.test.js usePolicyIntentDraft.test.js PolicyBuilderModal.test.js policyIntentDraftBridge.test.js
```

Draft event boundary validation:

```bash
npm --prefix client run test -- PolicyIntentEditor.test.js PolicyBuilderModal.test.js usePolicyIntentDraft.test.js policyIntentDraftView.test.js policyIntentDraftBridge.test.js
```

Modal save parity validation:

```bash
npm --prefix client run test -- PolicyBuilderModal.test.js usePolicyIntentDraft.test.js policyIntentDraftBridge.test.js PolicyIntentEditor.test.js
```

Metadata ownership validation:

```bash
npm --prefix client run test -- policyIntentDraftBridge.test.js usePolicyIntentDraft.test.js usePolicyBuilderState.test.js usePolicyBuilderTemplateSignals.test.js PolicyBuilderModal.test.js
```

## Remaining Phase 2 Work

Next Phase 2 slice:

1. Keep save output identical by serializing the draft through
   `applyPolicyIntentDraftToSelectedPresets`.
2. Move any remaining advanced-template write paths into draft ownership only
   when equivalent draft entries and round-trip tests exist.
3. Continue shrinking `PolicyBuilderModal.vue` by extracting remaining dense
   sections that already communicate through explicit props and events.
