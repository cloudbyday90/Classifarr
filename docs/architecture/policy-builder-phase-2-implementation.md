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
4. Leave advanced legacy template controls on their existing direct
   `customSignals` path until the draft explicitly owns those fields.

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

- The UI still manipulates `customSignals` until the next Phase 2 slice wires
  draft state into the modal.
- Native intent persistence is intentionally deferred to the storage migration
  phase.
- Some mixed legacy shapes remain constrained by what `customSignals` can
  express.
- Dual paths exist temporarily: intent helper edits now go through the draft,
  while advanced legacy template details still mutate `customSignals` directly.

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
- `setSignalConfig`,
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

## Remaining Phase 2 Work

Next Phase 2 slice:

1. Keep save output identical by serializing the draft through
   `applyPolicyIntentDraftToSelectedPresets`.
2. Move advanced template strict/removal controls into draft ownership only when
   equivalent draft entries and round-trip tests exist.
