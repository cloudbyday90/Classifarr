# Policy Builder Test Boundary Reset

Status: implemented as the policy-builder architectural test-boundary contract.

## Scope

This document records the durable policy-builder test-boundary reset. Its role
is to make tests protect the re-imagined policy-builder architecture instead of
freezing old UI internals.

This slice does not change UI behavior, policy saves, database schema,
classification scoring, or migration execution. It keeps a server-owned ESM
test-boundary contract that categorizes the current policy-builder test surface
and verifies the boundary rules required before draft, bridge, and engine work
continues.

## Official Guidance Reviewed

Official sources reviewed as of June 2026:

- Vue Testing:
  <https://vuejs.org/guide/scaling-up/testing>
  - Tests should focus on behavior, confidence, and integration boundaries, not
    implementation details that make refactoring expensive.
- Vue Composables:
  <https://vuejs.org/guide/reusability/composables>
  - Reusable state and side-effect logic should be isolated enough to test
    without depending on component layout.
- Vue Component `v-model`:
  <https://vuejs.org/guide/components/v-model>
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
  <https://csrc.nist.gov/pubs/sp/800/218/final>
  - Verification should be traceable to design responsibilities and risk.

## Recommendations

1. Treat boundary contracts as the architectural regression layer.
2. Keep product UI tests as behavior coverage, not layout snapshots.
3. Rewrite old policy-builder tests around product vocabulary, draft and bridge
   ownership, reference-data authority, and server-owned evidence/readiness
   boundaries.
4. Delete diagnostic preview tests after engine cutline review decides whether
   those surfaces become engine evidence, maintainer tooling, or removed UI.
5. Make required boundary rules executable:
   - modal does not generate evidence,
   - draft commands are allow-listed,
   - reference options and observed evidence are distinct,
   - legacy payload mutation stays in bridge code,
   - UI-only state is not serialized,
   - transitional layout snapshots are not introduced.

## Pros And Cons

Pros:

- Gives draft and bridge refactors a concrete regression gate.
- Prevents tests from forcing the old diagnostic-heavy modal shape to remain.
- Ties UI test cleanup to the same authority boundaries used by the code.
- Makes security-relevant payload rules executable and fail-closed.
- Keeps future deletion candidates visible without deleting behavior coverage
  prematurely.

Cons:

- Existing client tests still need follow-up rewrites as later surfaces are
  replaced.
- Diagnostic preview tests remain temporarily until engine cutline review makes
  a product decision.
- The reset contract inventories representative policy-builder tests rather
  than every classification or policy-engine test in the repository.
- Native intent storage tests still wait for native-storage implementation.
- The deletion-readiness rule proves compatibility-removal gates are enforced,
  but it does not migrate storage or remove legacy compatibility code.

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

## Implemented Outcome

The test-boundary contract classifies the current policy-builder test surface:

| Category | Current Decision |
| --- | --- |
| Keep as behavior regression | Keep modal behavior coverage without snapshot layout assertions. |
| Rewrite around product vocabulary | Rewrite intent editor and section tests around destination intent language. |
| Rewrite around draft/bridge boundaries | Keep bridge parity and draft command coverage, but avoid raw storage-shape assertions where possible. |
| Rewrite around future evidence/readiness contracts | Split reference options from future server-owned evidence/readiness semantics. |
| Delete when abandoned diagnostic UI is removed | Keep impact/replay preview tests only until engine cutline review decides whether those surfaces remain. |
| Boundary contract | Keep server-owned boundary tests as the architectural regression layer. |

The executable boundary rules now verify:

| Rule | Evidence |
| --- | --- |
| Modal does not generate evidence | Modal orchestration contract rejects evidence generation responsibility. |
| Draft commands are allow-listed | Draft state contract allows known commands and rejects unknown raw-write commands. |
| Reference options and observed evidence are distinct | Reference-data contract classifies preset options and library profile options with different authority. |
| Legacy payload mutation stays in bridge code | Legacy compatibility contract allows bridge mutation and blocks product component raw writes. |
| Legacy compatibility ownership audit is clean | Legacy compatibility contract validates module ownership, allowed artifact handlers, raw mutation rights, and product-facing raw access. |
| Legacy deletion requires completed gates | Legacy compatibility deletion readiness remains blocked until every compatibility-removal gate is complete. |
| UI-only state is not serialized | Draft save boundary rejects UI-only and server-projection fields. |
| Transitional layout snapshots are not introduced | Listed policy-builder tests are not marked as layout freezes and do not use Jest snapshot assertions. |

## Follow-Up

The next high-value task is the client-boundary completion audit cutover: update
the active completion record and any executable completion checks so they
reference durable boundary names while preserving the proof that modal, draft,
reference-data, legacy-bridge, and test-boundary contracts pass together.
