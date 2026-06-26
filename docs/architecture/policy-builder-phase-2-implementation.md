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

## Research Inputs

- [Vue Composables](https://vuejs.org/guide/reusability/composables.html):
  Vue recommends extracting reusable stateful logic into composables and
  keeping concerns isolated as components grow.
- [Vue Watchers](https://vuejs.org/guide/essentials/watchers.html):
  reactive side effects should be explicit and tied to the state they observe,
  which fits synchronizing a draft from selected preset changes.
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
- Keep the current `customSignals` save contract until native intent storage
  exists.
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

## Remaining Phase 2 Work

Next Phase 2 slice:

1. Pass the draft read model into `PolicyIntentEditor.vue` so the editor renders
   from `intentDraft` instead of rebuilding from selected presets.
2. Route `PolicyIntentEditor.vue` edits through draft commands instead of direct
   `customSignals` mutation.
3. Keep save output identical by serializing the draft through
   `applyPolicyIntentDraftToSelectedPresets`.
4. Add modal-level regression tests proving unchanged policies save the same
   payload before and after draft wiring.
5. Move advanced template strict/removal controls into draft ownership only when
   equivalent draft entries and round-trip tests exist.
