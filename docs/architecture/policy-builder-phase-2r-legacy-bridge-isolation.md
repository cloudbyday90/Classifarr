# Policy Builder Phase 2R Legacy Bridge Isolation

Status: implemented as the second Phase 2R draft/bridge contract.

## Scope

Phase 2R.2 keeps legacy compatibility working while preventing legacy storage
shape from owning the product model.

This slice does not change UI behavior, save payloads, database schema,
classification scoring, native intent storage, or bridge runtime behavior. It
adds a server-owned ESM bridge isolation contract that inventories
deserialization, serialization, no-op preservation, migration-only metadata, and
Phase 8R deletion responsibilities for the current legacy-compatible draft
bridge.

## Research Inputs

Official sources reviewed as of June 2026:

- OWASP Mass Assignment Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html>
  - Data crossing write boundaries should use allow-listed transfer fields, not
    unrestricted object assignment.
- OWASP Input Validation Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html>
  - Compatibility payloads need explicit validation and fail-closed handling of
    unexpected structure.
- Vue Component Events:
  <https://vuejs.org/guide/components/events.html>
  - Product components should send explicit events instead of mutating
    parent-owned state or storage payloads directly.
- Vue Props:
  <https://vuejs.org/guide/components/props.html>
  - Parent-owned data should flow down as props; bridge writes should stay in
    owned state/serializer boundaries.
- NIST Secure Software Development Framework, SP 800-218:
  <https://csrc.nist.gov/publications/detail/sp/800-218/final>
  - Compatibility code should have documented responsibilities, verification,
    and replacement criteria.

## Recommendations

1. Keep selected-preset deserialization and `customSignals` projection inside
   `policyIntentDraftBridge.js`.
2. Keep draft-to-legacy serialization allow-listed and bridge-owned.
3. Preserve unsupported legacy payload blocks on no-op saves until Phase 8R
   conversion and rollback gates are complete.
4. Preserve weights, removed markers, strict/advisory metadata, and fallback
   metadata only through bridge or bridge-caller ownership.
5. Treat product components as command emitters and presentation consumers, not
   raw legacy payload readers/writers.
6. Require Phase 8R native schema, lossless conversion, rollback snapshots,
   parity, write shutdown, backup/restore verification, and regression coverage
   before deleting the bridge.

## Pros And Cons

### Pros

- Makes bridge ownership explicit before more draft command work continues.
- Protects no-op legacy save behavior independently of UI layout.
- Keeps unsupported legacy blocks from being dropped during transitional saves.
- Gives Phase 8R concrete deletion gates instead of letting the bridge become
  permanent architecture.
- Keeps product components aligned with the Phase 2R draft contract.

### Cons

- Runtime behavior is unchanged, so client bridge code still carries legacy
  names until later tasks adapt commands and view projections.
- `usePolicyBuilderState.js` remains a bridge caller for save payload assembly.
- Product tests still mention `customSignals` where they assert legacy save
  compatibility.
- Native intent storage still waits for Phase 8R.

## Final Stack

- Bridge isolation contract:
  `server/src/services/policyBuilderPhase2LegacyBridgeIsolation.mjs`
- Unit coverage:
  `server/src/__tests__/services/policyBuilderPhase2LegacyBridgeIsolation.test.mjs`
- Current bridge implementation:
  `client/src/utils/policyIntentDraftBridge.js`
- Current bridge callers:
  - `client/src/composables/usePolicyIntentDraft.js`
  - `client/src/composables/usePolicyBuilderState.js`
- Compatibility boundary inherited from Phase 1R:
  `server/src/services/policyBuilderLegacyCompatibilityBoundary.mjs`
- Roadmap:
  `docs/architecture/policy-builder-intent-model-roadmap.md`
- This implementation record:
  `docs/architecture/policy-builder-phase-2r-legacy-bridge-isolation.md`

## Implemented Outcome

Phase 2R.2 classifies bridge responsibilities:

| Responsibility | Stage | Owner |
| --- | --- | --- |
| Deserialize selected presets | Deserializer | Draft bridge |
| Project `customSignals` to draft | Deserializer | Draft bridge |
| Serialize draft to `customSignals` | Serializer | Draft bridge |
| Preserve unsupported legacy blocks | No-op preservation | Draft bridge |
| Preserve preset weights | No-op preservation | Policy builder state caller |
| Preserve removed markers | No-op preservation | Draft bridge |
| Preserve strict/advisory metadata | No-op preservation | Draft bridge |
| Preserve compatibility fallback | No-op preservation | Draft bridge |
| Migration-only metadata | Migration metadata | Draft bridge |
| Delete after native storage | Deletion gate | Native storage replacement |

The contract defines serialized allow-list keys:

- `require_all`
- `require_any`
- `include`
- `prefer`
- `exclude`
- `mode`
- `max`
- `min`
- `min_minutes`
- `max_minutes`
- `semantics`
- `constraint_mode`
- `constraint`
- `runtime_mode`
- `runtime`
- `strict`
- `removed`

It also documents unsupported legacy keys that must be preserved when present:

- `source_note`
- `custom_score`
- `provider_hint`
- `legacy_rule_id`

Phase 2R.2 inherits the Phase 1R rule that product components cannot read or
write raw legacy payloads directly. Raw legacy mutation remains bridge-only.

## Phase 2R.2 Checklist Result

| Phase 0R Checklist Item | Result |
| --- | --- |
| Source of truth identified | `policyIntentDraftBridge.js` owns deserialization, serializer writes, no-op preservation, and compatibility fallback metadata. |
| Authority level identified | Product components are command/presentation consumers; the bridge is compatibility serializer, not durable policy authority. |
| Learning side effect identified | No learning side effects are added by this task. |
| Rollback or migration impact identified | Bridge deletion requires all Phase 8R legacy compatibility deletion gates. |
| Operator-facing language validated | Product surfaces remain shielded from raw legacy storage language; bridge internals keep compatibility names only. |

## Follow-Up

The next Phase 2R task is **2R.3 Draft Command Boundary**. It should make
operator edits narrow, typed, product-language commands and validate command
payloads before they touch draft state.
