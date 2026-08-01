# Policy Compatibility Retirement Execution-Manifest Binding

**Status:** Complete

**Roadmap task:** Phase 3R, Task 3R.10.7

**Decision date:** 2026-08-01

## Decision

The retirement reconciliation now binds to the existing compatibility-removal
execution-plan contract through an observational target audit. The binding does
not write or approve an execution manifest. It only proves whether a supplied,
already approved execution plan can represent every exact retirement action.

The eleven dependency records reduce to ten execution targets because the three
direct stubs in `PolicyCompatibilityMaintenanceSurface.test.js` share one
dedicated test-file removal target:

| Target action | Count | Treatment |
| --- | ---: | --- |
| Replace retained runtime code path | 1 | Remove the legacy-edit branch from `PolicyBuilderModal.vue` without deleting the modal. |
| Delete compatibility component | 3 | Retire the maintenance surface, editor, and migration notice after native-storage gates pass. |
| Remove dedicated compatibility test file | 2 | Retire dedicated surface and migration-notice test files with their bridge. |
| Remove named shared-test scope | 4 | Retire only declared compatibility assertions from `PolicyIntentEditor.test.js` and `PolicyBuilderModal.test.js`. |

The first three actions can be represented by the existing file-oriented
execution-plan actions. The fourth cannot: its action requires an exact list of
test-name fragments and must not be converted into whole-file deletion. The
binding therefore correctly returns `blocked_by_manifest_coverage` for the
current plan, despite the reconciliation itself being ready.

## Research

Official sources were reviewed on 2026-08-01 against the requested
current-through-June-2026 baseline.

- NIST's SSDF recommends integrating secure practices into the delivery
  lifecycle so security evidence and verification accompany change decisions.
  Here, the binding verifies exact target coverage before a later execution
  gate can act. [NIST SP 800-218 Secure Software Development
  Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
- OWASP recommends a granular, documented modernization plan that explains the
  business and security rationale for each staged change. Treating an assertion
  retirement as distinct from deleting its test file follows that guidance.
  [OWASP Legacy Application Management Cheat
  Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Legacy_Application_Management_Cheat_Sheet.html)
- NIST configuration-change guidance includes change control and verification
  of controls. A binding that refuses to flatten a shared test file into a
  deletion target preserves that verification boundary. [NIST SP
  800-171r3, Configuration Change Control](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/800-171r3/NIST.SP.800-171r3.html)

## Options Considered

### Treat every shared test file as a removable test file

**Pros:** The existing file-oriented manifest could represent it immediately.

**Cons:** Deletes unrelated native regression coverage and lets an execution
plan misstate the intended operation. Rejected.

### Add a separate retirement executor

**Pros:** Could model named test scopes without modifying the existing plan.

**Cons:** Creates a second destructive path with separate approval, fingerprint,
and recovery semantics. Rejected.

### Bind exact targets and block unsupported manifest actions

**Pros:** Reuses the existing execution path, preserves exact source and test
scope ownership, and makes the model gap explicit before authorization.

**Cons:** The next task must add a bounded named-scope manifest entry model.
Adopted.

## Final Recommendation Stack

1. Treat the read-only reconciliation as the only source for compatibility
   retirement targets.
2. Require a valid, approved, side-effect-free execution plan before checking
   target coverage.
3. Match file operations by exact path and action, and shared test changes by
   exact path, action, and named test fragments.
4. Block unsupported named-scope targets rather than converting them to whole
   test-file deletion.
5. Extend the existing fingerprinted execution-manifest model in the next task;
   do not create another executor or authorize removal here.

## Implementation

- `policyCompatibilityRetirementExecutionManifestTargets.mjs` derives and
  deduplicates exact execution targets from the read-only reconciliation.
- `policyCompatibilityRetirementExecutionManifestBinding.mjs` validates the
  reconciliation and a supplied approved execution plan, then reports exact
  coverage gaps and unsupported action types.
- `server/src/__tests__/services/policyCompatibilityRetirementExecutionManifestBinding.test.mjs`
  reads the real dependency sources, proves all eleven records remain covered,
  verifies the ten-target reduction, and rejects missing reconciliation or any
  attempted side effect.
- `policyAuthoringWorkflowCompletionAudit.mjs` includes this binding as a
  required policy-authoring server contract.

## Security Outcome

- A shared native test cannot be deleted merely because it contains a retiring
  compatibility assertion.
- Every target remains linked to one or more source-backed dependency IDs.
- The binding requires a ready, approved, validated, side-effect-free execution
  plan but does not treat that plan as deletion approval.
- Unsupported action types fail closed before any later execution gate.
- The binding has no filesystem-write, manifest-write, deletion, policy-
  execution, route-execution, or storage-mutation capability.

## Next Step

**Phase 3R, Task 3R.10.9: Compatibility Retirement Candidate Plan Projection**
is complete. It derives exact unapproved targets and named scopes from the
source-backed reconciliation, retaining native workflow successor evidence and
performing no mutation. See [Policy Compatibility Retirement Candidate Plan
Projection](policy-compatibility-retirement-candidate-plan-projection.md).

Proceed to **Phase 3R, Task 3R.10.10: Compatibility Retirement Candidate Plan
Assembly Gate**. Correlate the unapproved candidates to deletion-gate
categories without approving, persisting, or executing a manifest.
