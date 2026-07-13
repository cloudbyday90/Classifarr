# Policy Builder Legacy Compatibility Boundary

Status: implemented and hardened with compatibility ownership and
compatibility-removal readiness audits.

## Scope

This document records the durable policy-builder legacy compatibility boundary.
It keeps existing preset-backed policy behavior readable and writable while
preventing the legacy storage shape from becoming the new product model.

This slice does not change UI behavior, policy saves, database schema,
classification scoring, migration execution, or native intent storage. It
removes phase-worded runtime fields from the compatibility boundary, classifies
the legacy artifacts still present in the policy builder, and defines which
modules may read, route, serialize, or eventually delete them.

## Official Guidance Reviewed

Official sources reviewed as of June 2026:

- OWASP Mass Assignment Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html>
  - Objects crossing trust boundaries should use allow-listed fields and DTO
    boundaries instead of raw client payload assignment.
- OWASP Input Validation Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html>
  - Compatibility payloads still need allow-listed structure, bounded size, and
    server-side validation.
- Vue Component `v-model`:
  <https://vuejs.org/guide/components/v-model>
  - Component write paths should be explicit prop/event or command flows, not
    hidden mutation of parent-owned objects.
- Vue Composables:
  <https://vuejs.org/guide/reusability/composables>
  - Reusable state logic should encapsulate side effects and ownership.
- Vue Testing:
  <https://vuejs.org/guide/scaling-up/testing>
  - Tests should protect behavior and boundaries instead of freezing incidental
    component internals.
- NIST Secure Software Development Framework, SP 800-218:
  <https://csrc.nist.gov/pubs/sp/800/218/final>
  - Secure implementation needs documented responsibilities and verification
    around changes.

## Recommendations

1. Keep raw legacy payload writes inside bridge and serializer code only.
2. Treat product components as command routers and presentation consumers.
3. Keep `customSignals`, removed markers, strict/advisory metadata, and
   fallback projections named as compatibility artifacts, not engine authority.
4. Keep server request validation as the durable allow-list for transitional
   draft and compatibility payloads.
5. Define native-storage deletion gates now so the bridge is not normalized into
   permanent architecture.
6. Audit compatibility ownership:
   - every module must have a declared compatibility owner,
   - every artifact must allow that owner,
   - raw writes must remain bridge-only,
   - product-facing modules cannot read raw compatibility payloads,
   - deletion gates must all remain required.

## Pros And Cons

Pros:

- Preserves existing policies without letting legacy storage define future UI
  language.
- Gives tests a concrete rule: raw legacy writes are bridge-only.
- Makes native-storage migration and deletion conditions explicit early.
- Keeps product components simpler because they emit commands instead of owning
  serialization.
- Reduces mass-assignment risk by keeping server validation and bridge
  ownership distinct.
- Gives compatibility removal a concrete readiness evaluator instead of relying
  on narrative migration notes.

Cons:

- Existing code still carries legacy terms until later refactors rename product
  surfaces.
- `usePolicyBuilderState` still assembles compatibility save payloads, so it
  remains a bridge caller until native storage exists.
- The bridge cannot be deleted until conversion, rollback, parity, and
  regression gates are complete.
- This task updates the contract and tests, not the native intent storage
  migration.
- The audit validates ownership and gates, not runtime conversion correctness;
  native-storage work still owns conversion, rollback, and parity execution.

## Final Stack

- Legacy compatibility boundary contract:
  `server/src/services/policyBuilderLegacyCompatibilityBoundary.mjs`
- Unit coverage:
  `server/src/__tests__/services/policyBuilderLegacyCompatibilityBoundary.test.mjs`
- Current bridge and callers:
  - `client/src/utils/policyIntentDraftBridge.js`
  - `client/src/composables/usePolicyIntentDraft.js`
  - `client/src/composables/usePolicyBuilderState.js`
  - `client/src/composables/usePolicyBuilderTemplateSignals.js`
  - `client/src/composables/usePolicyBuilderCombinedSignals.js`
  - `client/src/components/policies/PolicyStarterTemplateDetails.vue`
  - `server/src/services/policyIntentRequestValidator.mjs`
- Roadmap:
  `docs/architecture/policy-builder-intent-model-roadmap.md`

## Implemented Outcome

The boundary defines six compatibility artifacts:

| Artifact | Product Language | Native Storage Disposition |
| --- | --- | --- |
| Preset attachments | Starter templates | Replace with native template links or native intent references. |
| Starter-template weights | Template influence | Replace with native influence settings or remove when templates become seed-only. |
| `customSignals` / `custom_signals` | Declared intent signals | Delete after native intent storage is read/write authoritative. |
| Removed markers | Ignored template signal | Replace with native ignored-template-signal state or delete if no longer needed. |
| Strict/advisory metadata | Hard limit or helpful hint behavior | Replace with native constraint semantics. |
| Compatibility fallback projection | Compatibility bridge projection | Delete after conversion, rollback, and native read/write parity are complete. |

Current ownership rules:

| Module | Role | Raw Legacy Writes |
| --- | --- | --- |
| `policyIntentDraftBridge.js` | Bridge serializer | Allowed |
| `usePolicyIntentDraft.js` | Draft command router | Not allowed |
| `usePolicyBuilderState.js` | Save payload coordinator and bridge caller | Not allowed |
| `usePolicyBuilderTemplateSignals.js` | Template signal presentation helper | Not allowed |
| `usePolicyBuilderCombinedSignals.js` | Read-only summary projection | Not allowed |
| `PolicyStarterTemplateDetails.vue` | Product command and presentation component | Not allowed |
| `policyIntentRequestValidator.mjs` | Server allow-list validation | Not allowed |

The contract rejects product-component raw compatibility reads and writes.
Product components may route commands, and the draft bridge remains the only
declared raw legacy payload mutation owner.

## Hardening Outcome

The boundary exposes:

- `validateLegacyCompatibilityModuleRecord(record)`
- `buildLegacyCompatibilityBoundaryAudit(options)`
- `evaluateLegacyCompatibilityDeletionReadiness(completedGateIds)`

The boundary audit fails on:

- unknown compatibility modules,
- unknown compatibility artifacts,
- disallowed artifact owners,
- raw mutation outside the draft bridge,
- product-facing raw payload access,
- missing compatibility-removal deletion gates,
- deletion gates that are not marked required.

The deletion-readiness evaluator returns the required gate list, completed
gates, missing gates, and whether raw legacy bridge removal is safe. The bridge
is not ready for removal until every compatibility-removal deletion gate is
complete:

```text
native intent schema
lossless conversion
rollback snapshot
native read/write parity
legacy write shutdown
backup/restore verification
regression coverage
```

`usePolicyBuilderCombinedSignals` is explicitly allowed to read `customSignals`
as a read-only presentation projection. It is still not allowed to mutate raw
legacy payloads.

## Follow-Up

The next high-value task is the test-boundary reset cutover: classify current
policy-builder tests by architectural boundary without phase-worded production
or active implementation records, and keep modal, draft, reference-data,
legacy-bridge, and UI-only serialization rules covered.
