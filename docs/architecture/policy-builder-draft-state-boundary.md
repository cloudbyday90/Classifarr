# Policy Builder Draft State Boundary

Status: implemented and hardened with draft-operation and save-allow-list
audits.

## Scope

This document records the durable draft-state boundary for policy-builder client
state. The client draft is an editable projection used for operator input and
legacy-compatible serialization. It is not durable policy authority.

This slice does not change save payload shape, legacy bridge serialization,
policy scoring, database schema, API contracts, or UI behavior. It removes
phase-worded runtime notes from the draft boundary and keeps the active design
record aligned with product-domain naming.

## Official Guidance Reviewed

Official sources reviewed as of June 2026:

- Vue State Management:
  <https://vuejs.org/guide/scaling-up/state-management>
  - Shared state should have clear ownership and mutation paths.
- Vue Composables:
  <https://vuejs.org/guide/reusability/composables>
  - Stateful logic should be encapsulated behind deliberate composable APIs.
- Vue Testing:
  <https://vuejs.org/guide/scaling-up/testing>
  - Tests should verify behavior and boundaries at the correct layer.
- OWASP Input Validation Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html>
  - Allow-list validation defines exactly what is authorized and rejects
    everything else.
- OWASP Mass Assignment Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html>
  - Bindable fields should be allow-listed, sensitive or non-bindable fields
    should be blocked, and DTO-style boundaries should be used.

## Recommendations

1. Treat client draft state as editable projection only:
   - derived from server or compatibility data,
   - editable by explicit commands,
   - validated by the server before save,
   - never durable policy authority.
2. Keep draft commands allow-listed and narrow.
3. Separate draft fields by ownership:
   - declared intent edits,
   - compatibility payload metadata,
   - UI-only transient state,
   - server projection display state,
   - save allow-list fields.
4. Keep save payload serialization explicitly allow-listed.
5. Keep legacy custom-signal aliases and runtime metadata contained by bridge
   ownership until native intent storage replaces them.
6. Audit public draft-state operations so they cannot claim durable authority,
   persist UI-only state, persist server projections, or bypass the save
   allow-list.

## Pros And Cons

Pros:

- Prevents the client draft from becoming source of truth.
- Documents which draft fields are operator intent versus compatibility
  metadata.
- Makes accidental UI-state or server-projection serialization testable.
- Preserves existing saves while preparing for native intent storage.
- Gives later engine and storage work a stable client projection contract.

Cons:

- The current draft still serializes through legacy custom-signal compatibility
  until native intent storage is implemented.
- Some product-facing events still use custom-signal naming until bridge
  ownership work removes or renames them.
- The boundary audit does not replace runtime server validation.

## Final Stack

- Boundary inventory dependency:
  `server/src/services/policyBuilderBoundaryInventory.mjs`
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

## Implemented Outcome

The draft boundary defines field categories:

| Category | Meaning |
| --- | --- |
| Declared intent edit | Editable operator-intent projection, still server-validated before persistence. |
| Compatibility payload metadata | Legacy bridge metadata required for current policy compatibility. |
| UI-only transient state | Browser state that must never serialize. |
| Server projection display | Read-only data from server projections or diagnostics. |
| Save allow-list field | Explicit fields allowed in policy save payloads. |

The contract exposes:

- `listDraftStateFieldRecords()`
- `getDraftStateFieldRecord(fieldPath)`
- `classifyDraftStateField(fieldPath)`
- `listDraftCommandRecords()`
- `getDraftCommandRecord(commandId)`
- `isDraftCommandAllowed(commandId)`
- `listDraftStateOperationRecords()`
- `getDraftStateOperationRecord(operationId)`
- `validateDraftStateOperation(operation)`
- `buildDraftStateBoundaryAudit(operations)`
- `validatePolicyBuilderSavePayloadBoundary(payload)`
- `buildDraftBoundarySummary()`

The audit fails on:

- unknown operations,
- unknown or disallowed draft commands,
- operations that claim durable policy authority,
- UI-only state persistence,
- server-projection persistence,
- unsafe save payloads.

## Follow-Up

The next high-value task is the reference-data boundary cutover: separate static
options, observed library profile suggestions, and evidence-backed projections
so client reference data does not become evidence or learning authority.
