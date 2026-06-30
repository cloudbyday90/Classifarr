# Policy Builder Phase 1R Legacy Compatibility Boundary

Status: implemented as the fifth Phase 1R client-boundary contract and
hardened with compatibility ownership and deletion-readiness audits.

## Scope

Phase 1R.5 keeps existing preset-backed policy behavior readable and writable
while preventing legacy storage shape from becoming the new product model.

This slice does not change UI behavior, policy saves, database schema,
classification scoring, migration execution, or native intent storage. It adds
a server-owned ESM boundary contract that classifies the legacy compatibility
artifacts still present in the policy builder and defines which modules may
read, route, serialize, or eventually delete them.

## Research Inputs

Official sources reviewed as of June 2026:

- OWASP Mass Assignment Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html>
  - Objects crossing trust boundaries should use allow-listed fields, not raw
    client payload assignment.
- OWASP Input Validation Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html>
  - Compatibility payloads still need allow-listed structure, bounded size, and
    server-side validation.
- Vue Component `v-model`:
  <https://vuejs.org/guide/components/v-model.html>
  - Component write paths should be explicit events or commands, not hidden
    mutation of parent-owned objects.
- Vue Composables:
  <https://vuejs.org/guide/reusability/composables.html>
  - Reusable state logic should encapsulate side effects and ownership.
- Vue Testing:
  <https://vuejs.org/guide/scaling-up/testing.html>
  - Tests should protect behavior and boundaries instead of freezing incidental
    component internals.
- NIST Secure Software Development Framework, SP 800-218:
  <https://csrc.nist.gov/publications/detail/sp/800-218/final>
  - Secure implementation needs documented responsibilities and verification
    around changes.

## Recommendations

1. Keep raw legacy payload writes inside bridge/serializer code only.
2. Treat product components as command routers and presentation consumers.
3. Keep `customSignals`, removed markers, strict/advisory metadata, and
   fallback projections named as compatibility artifacts, not engine authority.
4. Keep server request validation as the durable allow-list for transitional
   draft and compatibility payloads.
5. Define Phase 8R deletion gates now so the bridge is not normalized into
   permanent architecture.
6. Audit compatibility ownership:
   - every module must have a declared compatibility owner,
   - every artifact must allow that owner,
   - raw writes must remain bridge-only,
   - product-facing modules cannot read raw compatibility payloads,
   - deletion gates must all remain required.

## Pros And Cons

### Pros

- Preserves existing policies without letting legacy storage define future UI
  language.
- Gives tests a concrete rule: raw legacy writes are bridge-only.
- Makes Phase 8R migration and deletion conditions explicit early.
- Keeps product components simpler because they emit commands instead of owning
  serialization.
- Reduces mass-assignment risk by keeping server validation and bridge
  ownership distinct.
- Gives Phase 8R a concrete deletion-readiness evaluator instead of relying on
  narrative migration notes.

### Cons

- Existing code still carries legacy terms until later refactors rename product
  surfaces.
- `usePolicyBuilderState` still assembles compatibility save payloads, so it
  remains a bridge caller until native storage exists.
- The bridge cannot be deleted until Phase 8R conversion, rollback, parity, and
  regression gates are complete.
- This task adds a contract and tests, not the native intent storage migration.
- The audit validates ownership and gates, not runtime conversion correctness;
  Phase 8R still owns conversion, rollback, and parity execution.

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
  - `client/src/components/policies/PolicyStarterTemplateMechanics.vue`
  - `client/src/components/policies/PolicyStarterTemplateDetails.vue`
  - `server/src/services/policyIntentRequestValidator.mjs`
- Roadmap:
  `docs/architecture/policy-builder-intent-model-roadmap.md`
- This implementation record:
  `docs/architecture/policy-builder-phase-1r-legacy-compatibility-boundary.md`

## Implemented Outcome

Phase 1R.5 defines six compatibility artifacts:

| Artifact | Product Language | Phase 8R Disposition |
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
| `PolicyStarterTemplateMechanics.vue` | Product command and presentation component | Not allowed |
| `PolicyStarterTemplateDetails.vue` | Product command and presentation component | Not allowed |
| `policyIntentRequestValidator.mjs` | Server allow-list validation | Not allowed |

The contract rejects product-component raw compatibility reads and writes.
Product components may route commands, and the draft bridge remains the only
declared raw legacy payload mutation owner.

## Hardening Outcome

Phase 1R.5 now exposes:

- `validateLegacyCompatibilityModuleRecord(record)`
- `buildLegacyCompatibilityBoundaryAudit(options)`
- `evaluateLegacyCompatibilityDeletionReadiness(completedGateIds)`

The boundary audit fails on:

- unknown compatibility modules,
- unknown compatibility artifacts,
- disallowed artifact owners,
- raw mutation outside the draft bridge,
- product-facing raw payload access,
- missing Phase 8R deletion gates,
- deletion gates that are not marked required.

The deletion-readiness evaluator returns the required gate list, completed
gates, missing gates, and whether raw legacy bridge removal is safe. The bridge
is not ready for removal until every Phase 8R deletion gate is complete:

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

## Phase 1R.5 Checklist Result

| Phase 0R Checklist Item | Result |
| --- | --- |
| Source of truth identified | Legacy compatibility artifacts are transitional storage compatibility, not product authority. |
| Authority level identified | Bridge serialization, draft command routing, presentation, and server validation ownership are separate. |
| Learning side effect identified | No learning side effects are added by this task. |
| Rollback or migration impact identified | Phase 8R deletion gates require native schema, lossless conversion, rollback snapshots, parity, write shutdown, backup/restore verification, and regression coverage. |
| Operator-facing language validated | Product-facing modules should use starter-template and intent language, not raw preset/custom-signal terminology. |

## Follow-Up

The next Phase 1R task is **1R.6 Test Boundary Reset**. It should classify the
current policy-builder tests by architectural boundary and add tests that fail
when modal, draft, reference-data, legacy-bridge, or UI-only serialization
rules are violated.
