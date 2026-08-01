# Policy Native Workflow Test Rehoming Audit

**Status:** Complete

**Roadmap task:** Phase 3R, Task 3R.10.3

**Decision date:** 2026-08-01

## Decision

`PolicyIntentEditor.vue` is a compatibility component scheduled for deletion
after the native-storage cutover. Its test file remains necessary for the
compatibility-maintenance boundary until that later cutover, but it must not
remain the evidence owner for normal policy authoring.

This task moves the two active completion records to their native component
contracts:

| Active workflow record | Native test owner | Named contract |
| --- | --- | --- |
| `policy_authoring_destination_sections` | `PolicyBuilderDestinationQuestions.test.js` | Server-projected signal selection appears only for selectable, current observed evidence. |
| `policy_authoring_review_triggers` | `PolicyIntentReviewTriggerControl.test.js` | Each selected review condition emits one explicit typed local value, while duplicates remain disabled with a reason. |

The audit is side-effect-free. It does not move files, delete the editor,
modify policy storage, invoke routes, or authorize a cutover. It proves that
no active authoring completion record retains the editor test as its owner and
that the named native successor assertions exist.

## Research

Official sources were reviewed on 2026-08-01 and satisfy the requested
current-through-June-2026 baseline.

- Vue recommends testing a component through its public interface and behavior
  instead of implementation details. The active records therefore point to the
  native destination-question and review-trigger components, rather than the
  compatibility editor that happens to compose older controls. [Vue Testing
  Guide](https://vuejs.org/guide/scaling-up/testing.html)
- Vitest recommends identifying the contract first and testing inputs,
  outputs, side effects, and errors that callers observe. Named successor
  assertions make the ownership evidence resilient to an internal refactor.
  [Vitest: Testing in
  Practice](https://vitest.dev/guide/learn/testing-in-practice)
- OWASP recommends a clear legacy inventory and granular documented change
  plan. Retaining the editor only as an explicitly bounded compatibility test
  owner, while removing it from normal-workflow evidence, makes the remaining
  deletion dependency visible and reviewable. [OWASP Legacy Application
  Management Cheat
  Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Legacy_Application_Management_Cheat_Sheet.html)

## Options Considered

### Retain the editor test as the active authoring evidence

**Pros:** No ownership-record update.

**Cons:** A normal-workflow completion gate would depend on a component marked
for deletion. It would also make a future editor removal look like a loss of
native behavior coverage. Rejected.

### Delete or move the editor test now

**Pros:** Removes an apparent dependency immediately.

**Cons:** The file still owns compatibility-maintenance assertions and is a
shared test boundary. Early deletion or broad file movement would weaken the
legacy bridge before the native-storage removal evidence exists. Rejected.

### Rehome active completion records to native component tests and audit them

**Pros:** Keeps normal-workflow ownership at the component that supplies the
observable behavior, preserves the compatibility test until its cutover gate,
and fails closed if completion metadata or named native assertions drift.

**Cons:** Test-name fragments are a deliberate contract that must change with
an intentional test rename. Adopted.

## Final Recommendation Stack

1. Keep the named compatibility-maintenance scope in
   `PolicyIntentEditor.test.js` until the approved native-storage cutover
   process retires it; separately rehome its remaining active command scopes
   before the editor is deleted.
2. Make `PolicyBuilderDestinationQuestions.test.js` the normal-workflow owner
   for observed destination-signal availability and stale-profile withholding.
3. Make `PolicyIntentReviewTriggerControl.test.js` the normal-workflow owner
   for explicit typed review-condition selection and duplicate disablement.
4. Use a small ESM audit to bind completion-record test paths, retiring-editor
   bridge metadata, and executable successor assertion names.
5. Keep the audit non-authorizing and side-effect-free; dependency inventory
   and removal-manifest work remain separate tasks.

## Implementation

- `server/src/services/policyNativeWorkflowTestRehoming.mjs` declares the two
  rehomes and validates active record ownership, the registered
  compatibility-test boundary, component bridge boundaries, and native source
  assertions.
- `server/src/__tests__/services/policyNativeWorkflowTestRehoming.test.mjs`
  reads the real native test files and covers completion-record drift, bridge
  boundary drift, absent assertions, missing source text, and attempted side
  effects.
- `policyAuthoringWorkflowCompletionAudit.mjs` now points destination sections
  and review triggers at their native test owners and includes the audit as a
  required server contract.

## Security Outcome

- Normal authoring cannot silently regain a dependency on a retiring editor
  test through a completion-record change.
- A rehome cannot point at an arbitrary legacy test path; the existing
  compatibility-maintenance inventory must bind that path to the retiring
  editor component.
- The audit rejects a component artifact that is no longer
  `delete_after_native_storage`, is admitted to normal authoring, or gains raw
  legacy-payload mutation authority.
- Missing or renamed native assertions fail the audit instead of creating a
  false completion claim.
- The audit has no deletion, file-move, source-rewrite, storage, routing, or
  policy-execution capability.

## Next Step

The completed follow-on audit is **Phase 3R, Task 3R.10.4: Compatibility
Component Deletion Dependency Audit**. Its next task is **3R.10.5 Compatibility
Native Contract Rehoming**: move the active editor command and parity scopes to
native control tests before any compatibility component is deleted.
