# Policy Builder Phase 1R Test Boundary Reset

Status: implemented as the sixth and final Phase 1R client-boundary contract.

## Scope

Phase 1R.6 makes tests protect the re-imagined policy-builder architecture
instead of freezing old UI internals.

This slice does not change UI behavior, policy saves, database schema,
classification scoring, or migration execution. It adds a server-owned ESM
test-boundary contract that categorizes the current policy-builder test surface
and verifies the Phase 1R rules needed before Phase 2R continues.

## Research Inputs

Official sources reviewed as of June 2026:

- Vue Testing:
  <https://vuejs.org/guide/scaling-up/testing.html>
  - Tests should focus on behavior, confidence, and integration boundaries,
    not implementation details that make refactoring expensive.
- Vue Composables:
  <https://vuejs.org/guide/reusability/composables.html>
  - Reusable state and side-effect logic should be isolated enough to test
    without depending on component layout.
- Vue Component `v-model`:
  <https://vuejs.org/guide/components/v-model.html>
  - Component writes should flow through explicit events and owned state
    boundaries.
- OWASP Mass Assignment Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html>
  - Save payload tests should enforce allow-listed fields instead of accepting
    raw object assignment.
- OWASP Input Validation Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html>
  - Tests should prove invalid, unknown, or over-broad inputs fail closed.
- NIST Secure Software Development Framework, SP 800-218:
  <https://csrc.nist.gov/publications/detail/sp/800-218/final>
  - Verification should be traceable to design responsibilities and risk.

## Recommendations

1. Treat boundary contracts as the architectural regression layer for Phase 1R.
2. Keep product UI tests as behavior coverage, not layout snapshots.
3. Rewrite old policy-builder tests around Phase 0R vocabulary, draft/bridge
   ownership, reference-data authority, and future evidence/readiness cutlines.
4. Delete diagnostic preview tests after Phase 6R decides whether those surfaces
   become engine evidence, maintainer tooling, or removed UI.
5. Make required Phase 1R rules executable:
   - modal does not generate evidence,
   - draft commands are allow-listed,
   - reference options and observed evidence are distinct,
   - legacy payload mutation stays in bridge code,
   - UI-only state is not serialized,
   - transitional layout snapshots are not introduced.

## Pros And Cons

### Pros

- Gives Phase 2R a concrete regression gate before draft bridge refactors.
- Prevents tests from forcing the old diagnostic-heavy modal shape to remain.
- Ties UI test cleanup to the same authority boundaries used by the code.
- Makes security-relevant payload rules executable and fail-closed.
- Keeps future deletion candidates visible without deleting behavior coverage
  prematurely.

### Cons

- Existing client tests still need follow-up rewrites as later phases replace
  UI surfaces.
- Diagnostic preview tests remain temporarily until Phase 6R makes a product
  decision.
- The reset contract inventories representative policy-builder tests rather
  than every classification or policy-engine test in the repository.
- Native intent storage tests still wait for Phase 8R.

## Final Stack

- Test-boundary reset contract:
  `server/src/services/policyBuilderTestBoundaryReset.mjs`
- Unit coverage:
  `server/src/__tests__/services/policyBuilderTestBoundaryReset.test.mjs`
- Boundary contracts used as executable evidence:
  - `server/src/services/policyBuilderModalOrchestrationContract.mjs`
  - `server/src/services/policyBuilderDraftStateBoundary.mjs`
  - `server/src/services/policyBuilderReferenceDataBoundary.mjs`
  - `server/src/services/policyBuilderLegacyCompatibilityBoundary.mjs`
- Roadmap:
  `docs/architecture/policy-builder-intent-model-roadmap.md`
- This implementation record:
  `docs/architecture/policy-builder-phase-1r-test-boundary-reset.md`

## Implemented Outcome

Phase 1R.6 classifies the current policy-builder test surface:

| Category | Current Decision |
| --- | --- |
| Keep as behavior regression | Keep modal behavior coverage without snapshot layout assertions. |
| Rewrite around Phase 0R vocabulary | Rewrite intent editor and section tests around destination intent language. |
| Rewrite around draft/bridge boundaries | Keep bridge parity and draft command coverage, but avoid raw storage-shape assertions where possible. |
| Rewrite around future evidence/readiness contracts | Split reference options from future server-owned evidence/readiness semantics. |
| Delete when abandoned diagnostic UI is removed | Keep impact/replay preview tests only until Phase 6R decides whether those surfaces remain. |
| Phase 1R boundary contract | Keep server-owned boundary tests as the architectural regression layer. |

The executable boundary rules now verify:

| Rule | Evidence |
| --- | --- |
| Modal does not generate evidence | Modal orchestration contract rejects evidence generation responsibility. |
| Draft commands are allow-listed | Draft state contract allows known commands and rejects unknown raw-write commands. |
| Reference options and observed evidence are distinct | Reference-data contract classifies preset options and library profile options with different authority. |
| Legacy payload mutation stays in bridge code | Legacy compatibility contract allows bridge mutation and blocks product component raw writes. |
| UI-only state is not serialized | Draft save boundary rejects UI-only and server-projection fields. |
| Transitional layout snapshots are not introduced | Listed policy-builder tests are not marked as layout freezes and do not use Jest snapshot assertions. |

## Phase 1R.6 Checklist Result

| Phase 0R Checklist Item | Result |
| --- | --- |
| Source of truth identified | Phase 1R boundary contracts are the architectural regression source of truth. |
| Authority level identified | Tests are classified as behavior regression, vocabulary rewrite, draft/bridge boundary, evidence/readiness future work, diagnostic deletion candidate, or boundary contract. |
| Learning side effect identified | No learning side effects are added by this task. |
| Rollback or migration impact identified | Diagnostic UI tests are deletion candidates after Phase 6R; native intent storage tests wait for Phase 8R. |
| Operator-facing language validated | Tests that freeze old legacy-first product language are marked for Phase 0R vocabulary rewrite. |

## Follow-Up

Phase 1R is now ready for a completion audit. If the audit passes, the next
implementation phase is **Phase 2R: Intent Draft Bridge As Compatibility
Boundary**, starting with the first Phase 2R task in the roadmap.
