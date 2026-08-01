# Policy Native-Storage Cutover Test Handoff Audit

**Status:** Complete

**Roadmap task:** Phase 3R, Task 3R.10.1

**Decision date:** 2026-08-01

## Decision

Compatibility-maintenance regression coverage is temporary. It must retire
with the preset-attachment bridge when native intent storage completes its
verified cutover, but its removal cannot create a gap in the normal native
workflow.

This task adds an immutable, server-side ESM handoff registry. It maps every
retained compatibility test scope to:

1. Its source-test retirement disposition.
2. Named native workflow assertions that replace the product behavior.
3. Required native-storage test coverage.
4. Every existing native-storage deletion gate.
5. The further authorization, reference-scan, and validation evidence required
   before a later deletion task may execute.

The registry is an audit, not an executor. It always reports
`deletionAuthorized: false`; it neither deletes nor rewrites a test, component,
route, policy, or database record.

## Research

Official sources were reviewed on 2026-08-01 and satisfy the requested
current-through-June-2026 research baseline.

- Vue identifies component tests as the integration boundary for rendered
  behavior, props, events, and user interaction. It recommends testing public
  interfaces and behavior rather than implementation details. The native
  successors below therefore name observable workflow assertions instead of
  component internals. [Vue testing guide](https://vuejs.org/guide/scaling-up/testing.html)
- Vitest recommends writing against a contract's inputs, outputs, side effects,
  and error behavior, with focused names that identify the behavior that
  failed. The handoff uses exact test-name fragments so a renamed or removed
  regression assertion fails the audit. [Vitest testing in
  practice](https://main.vitest.dev/guide/learn/testing-in-practice)
- NIST SSDF recommends integrating secure software-development practices into
  the SDLC to reduce released vulnerabilities and mitigate their impact. The
  audit makes compatibility retirement reviewable and requires evidence before
  destructive work. [NIST SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final)

## Handoff Inventory

| Compatibility scope | Source disposition | Native workflow successor | Native-storage evidence |
| --- | --- | --- | --- |
| `compatibility_maintenance_surface` | Delete `PolicyCompatibilityMaintenanceSurface.test.js` with its bridge | `PolicyBuilderWorkflowShell.test.js`: destination-first questions and observed suggestions | Native runtime read path; legacy write blocking |
| `compatibility_maintenance_editor` | Remove named compatibility assertions; retain the shared test file | `PolicyBuilderDestinationQuestions.test.js`: server-projected selectable evidence and stale-profile withholding | Native runtime read path; legacy write blocking |
| `compatibility_maintenance_modal` | Remove named compatibility assertions; retain the shared modal test file | `PolicyBuilderModal.test.js`: accepted-evidence native creation and server-owned saved-policy handoff | Explicit conversion; native runtime read path; legacy write blocking |
| `compatibility_migration_notice` | Delete `PolicyPresetMigrationNotice.test.js` with its bridge | `PolicyNativeIntentReconciliation.test.js`: automatic reconciliation status without conversion controls | Explicit conversion; deletion-gate tests |

The two shared source files intentionally remain. Their compatibility assertions
retire, but unrelated native workflow assertions in the same files are still
the active product contract. A file-level deletion rule would incorrectly erase
native coverage or force duplicate test fixtures.

## Required Deletion Evidence

The handoff inventory is ready only when each scope has a native successor,
its declared native-storage coverage is proven by the native-storage reset
contract, and every referenced compatibility component retains all deletion
gates. That is necessary but not sufficient for deletion.

Before any later task removes a compatibility component or its named test
scope, it must provide all of the following current evidence:

1. Named native workflow regression assertions remain present.
2. The native-storage test-reset contract is valid and ready, with explicit
   coverage evidence for every mapped coverage ID.
3. The complete legacy-bridge deletion gate set is satisfied for every retiring
   component.
4. An authorized compatibility-removal completion artifact proves the approved
   execution plan is complete.
5. A final import/reference scan covers each approved path and finds no
   remaining references.
6. Focused and full validation both pass against the approved removal plan.

The last three evidence types are deliberately unresolved in this task. They
are execution evidence and belong to the next integration audit, not a static
test-ownership inventory.

## Options Considered

### Delete all compatibility test files at storage cutover

**Pros:** Simple apparent cleanup.

**Cons:** `PolicyIntentEditor.test.js` and `PolicyBuilderModal.test.js` also
contain distinct native workflow coverage. File deletion would either remove
active regression protection or require duplicate fixtures. Rejected.

### Keep compatibility tests indefinitely

**Pros:** No immediate migration risk.

**Cons:** It makes the bridge appear permanent, blocks deletion, and keeps
legacy interaction details in the product contract. Rejected.

### Map named retirement scopes to native successors and evidence

**Pros:** Preserves native behavioral coverage, supports mixed-responsibility
test files, makes the actual retirement boundary auditable, and prevents an
inventory-only audit from silently authorizing destructive work. Adopted.

**Cons:** The immutable registry and source audit need updates when test names
or intended native successors change.

## Final Recommendation Stack

1. Keep compatibility-maintenance and native-workflow test ownership separate.
2. Retire compatibility assertions by named scope, not by file, when a file
   still protects a native product behavior.
3. Require named native successors and native-storage coverage evidence for
   every retiring scope.
4. Keep full bridge deletion gates on every referenced compatibility component.
5. Treat authorized removal completion, final reference scanning, and focused
   plus full validation as distinct execution evidence.
6. Do not permit the test handoff audit itself to authorize or perform
   deletion.

## Implementation

- `server/src/services/policyNativeStorageCutoverTestHandoff.mjs` defines the
  immutable scope-to-successor inventory, native-storage coverage checks,
  bridge-gate checks, source-test assertion audit, and side-effect rejection.
- `server/src/__tests__/services/policyNativeStorageCutoverTestHandoff.test.mjs`
  verifies the complete map, real source assertion names, missing-coverage and
  drift failures, and the no-deletion boundary.
- `policyAuthoringWorkflowCompletionAudit.mjs` now includes the handoff as a
  required server contract so active authoring completion evidence cannot omit
  the cutover test boundary.

## Security Outcome

- Compatibility regression tests cannot silently become permanent native
  workflow authority.
- Native workflow coverage cannot be removed merely because a compatibility
  bridge has a deletion disposition.
- A later deletion task must prove authorization, no remaining references, and
  focused plus full validation; an inventory cannot be mistaken for approval.
- The audit is deterministic, side-effect-free, and uses no policy or raw
  legacy-payload mutation path.

## Next Step

Proceed to **Phase 3R, Task 3R.10.2: Native-Storage Cutover Deletion-Evidence
Integration Audit**. It should connect this handoff inventory to the existing
compatibility-removal completion artifact and enforce current execution,
reference-scan, and validation evidence before any destructive cutover action
is allowed.
