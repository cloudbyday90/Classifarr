# Policy Compatibility Retirement Candidate Plan Assembly Gate

**Status:** Complete (v2 reconciled taxonomy)

**Roadmap task:** Phase 3R, Task 3R.10.10

**Decision date:** 2026-08-01

## Decision

Candidate-plan assembly is a separate, read-only validation gate. It accepts a
ready candidate projection, the source-backed candidate taxonomy, and the
existing deletion-gate model. It revalidates all three server-side and emits
exactly one category correlation record for each candidate target.

A correlation is valid only when one candidate-taxonomy category contains the
complete exact candidate identity and owns the candidate action. This includes
kind, action, path, retiring component, dependency IDs, source fragments, and
test-name fragments. A shared-test file path alone can never authorize removal
of a named scope.

The gate does not require `readyToDelete`; that release condition belongs to
the later execution-plan evidence boundary. It does require structural gate
model validity. It cannot approve or persist a manifest, change storage, or
modify source.

## Official-Source Research

- OWASP recommends deriving security-relevant values server-side and enforcing
  each workflow transition against its current server-owned state. The assembly
  gate recomputes candidate and gate-model validity rather than trusting an
  input's claimed validation or a UI sequence.
- OWASP's secure code-review guidance calls out state-transition validation,
  authorization at each workflow step, and workflow-bypass opportunities. The
  gate separates category correlation from deletion approval and execution.
- NIST SSDF recommends secure practices across the delivery lifecycle. The
  resulting small, testable validation component leaves an auditable control
  boundary between source-backed provenance and later release authority.

Sources:

- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
- [OWASP Secure Code Review Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secure_Code_Review_Cheat_Sheet.html)
- [NIST SP 800-218 Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)

## Options Considered

### Infer Categories From Labels Or Broad Component Names

Pros:

- maps more targets immediately,
- needs no exact path comparison.

Cons:

- category labels are not authorization data,
- can assign a retained test to a component-deletion category,
- cannot distinguish `remove_named_test_scope` from whole-file `remove_test`.

### Treat Candidate Projection As An Approved Manifest

Pros:

- removes an intermediate validation component.

Cons:

- conflates source provenance, category taxonomy, approval, and execution,
- permits workflow-step bypasses,
- incorrectly treats the deletion-gate model's current release state as an
  execution request.

### Use Exact Action-Aware Correlation

Pros:

- requires exactly one matching category and action per target,
- preserves named-test-scope ownership and blocks whole-file substitutions,
- makes missing taxonomy explicit instead of guessing,
- leaves release readiness, approval, persistence, and execution outside this
  component.

Cons:

- the current taxonomy is revealed as incomplete and blocks assembly,
- requires a following category-taxonomy reconciliation task.

## Final Recommendation Stack

1. Revalidate candidate and gate-model contracts server-side at assembly time.
2. Match code by exact source or component path; match all test targets only by
   their exact test source path.
3. Require exactly one category and its centrally owned expected action.
4. Treat missing, duplicate, ambiguous, and action-mismatched mappings as
   blocking findings.
5. Do not use `readyToDelete` as approval and do not add manifest or execution
   behavior to this component.
6. Require the source-backed taxonomy before assembling a later plan artifact.

## Implementation Outcome

Implemented modular ESM services:

- `policyCompatibilityDeletionCategoryAction.mjs` is the single owner of
  category-to-action semantics used by both the existing execution plan and the
  assembly gate.
- `policyCompatibilityRetirementCandidatePlanAssemblyGate.mjs` v2 now binds
  every candidate to an exact source-backed taxonomy target and validates its
  own non-authority and no-side-effect boundaries.

The initial broad release-gate taxonomy intentionally blocked assembly. Phase
3R.10.11 resolved that mismatch with a distinct source-backed candidate
taxonomy: all ten candidates now map exactly, including four retained-file
named scopes. Release readiness remains false by default and is not altered by
this result.

## Security Outcome

- Category actions are centrally owned and cannot be inferred from labels or
  overridden by a mapping input.
- A shared native test scope cannot be represented as a stale whole-file test
  deletion.
- A structurally invalid candidate or gate model blocks before any mapping is
  emitted.
- `readyToDelete` is displayed as context only and does not grant any authority.
- The service has no I/O or mutation capability; requested side effects fail
  closed.

## Next Step

**Phase 3R, Task 3R.10.11: Compatibility Deletion-Category Taxonomy
Reconciliation** is complete. See [Policy Compatibility Retirement Candidate
Taxonomy Reconciliation](policy-compatibility-retirement-candidate-taxonomy-reconciliation.md).

Proceed to **Phase 3R, Task 3R.10.12: Compatibility Retirement Assembly
Handoff Audit**. Audit the read-only handoff to existing release-readiness,
approved artifact, and execution gates without creating a manifest, approving
removal, or executing a change.

## Research Date

Official sources were reviewed on 2026-08-01 against the requested
current-through-June-2026 baseline.
