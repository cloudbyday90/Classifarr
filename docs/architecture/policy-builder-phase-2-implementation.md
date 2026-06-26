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

## Research Inputs

- [Vue Composables](https://vuejs.org/guide/reusability/composables.html):
  Vue recommends extracting reusable stateful logic into composables and
  keeping concerns isolated as components grow.
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
- Keep the current `customSignals` save contract until native intent storage
  exists.
- Treat draft serialization as an allow-listed transformation, not a generic
  object merge.
- Preserve unknown legacy fields so existing policies do not silently lose
  behavior.
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

Targeted test command:

```bash
npm --prefix client run test -- policyIntentDraftBridge.test.js policyIntentModel.test.js
```

## Remaining Phase 2 Work

Next Phase 2 slice:

1. Add `usePolicyIntentDraft` as a reactive composable around the pure bridge.
2. Wire `PolicyBuilderModal.vue` to keep the draft synchronized with selected
   presets.
3. Route `PolicyIntentEditor.vue` edits through draft commands instead of direct
   `customSignals` mutation.
4. Keep save output identical by serializing the draft through
   `applyPolicyIntentDraftToSelectedPresets`.
5. Add modal-level regression tests proving unchanged policies save the same
   payload before and after draft wiring.
