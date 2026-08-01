# Policy Compatibility Component Deletion Dependency Audit

**Status:** Complete

**Roadmap task:** Phase 3R, Task 3R.10.4, updated by Task 3R.10.5

**Decision date:** 2026-08-01

## Decision

The compatibility components remain deletion targets after the native-storage
cutover, but their executable dependencies are not uniform. This audit records
each direct runtime and test dependency before any removal manifest is written.
It finds no direct route-entry reference in `client/src/router/index.js`.

The initial inventory had thirteen dependencies, including two active editor
test scopes that required native rehoming. Task 3R.10.5 completed that work.
The live inventory now has eleven dependencies across the three retiring
components:

| Classification | Count | Outcome |
| --- | ---: | --- |
| Native rehome | 0 | Completed in Task 3R.10.5; active native behavior no longer imports the compatibility editor. |
| Named compatibility retirement | 3 | Retire exact compatibility assertions from shared test files after their existing cutover handoff is satisfied. |
| Removal-manifest candidate | 8 | Add compatibility-only runtime branches, dedicated tests, and migration-feedback assertions to a later authorized removal manifest. |

The key correction was `PolicyIntentEditor.test.js` and
`PolicyIntentEditorParity.test.js`. Their active command, accessibility,
duplicate-prevention, removal, and parity contracts are now owned by native
destination-question, review-trigger, and constraint-control tests.
`PolicyIntentEditor.test.js` retains only its two named context-first
compatibility assertions, while `PolicyIntentEditorParity.test.js` was removed
because it asserted the retired `customSignals` transport. The rehomed tests
assert native intent command plans instead.

Completed preset-migration feedback has no normal-authoring successor. Its
dedicated component and tests, plus the two shared modal feedback assertions,
are removal-manifest candidates. This does not remove the automatic native
reconciliation status.

## Research

Official sources were reviewed on 2026-08-01 and satisfy the requested
current-through-June-2026 baseline.

- NIST's Secure Software Development Framework calls for managing software
  components and tracking the provenance of component data as part of secure
  development. A source-backed dependency inventory provides that evidence
  before a compatibility component is removed. [NIST SSDF
  Project](https://csrc.nist.gov/Projects/ssdf)
- OWASP recommends inventorying infrastructure and related assets during
  decommissioning, then removing stale configuration only after the inventory
  is understood. The same principle applies here: enumerate executable imports
  and test contracts before deleting the component that owns them. [OWASP
  Infrastructure as Code Security Cheat
  Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Infrastructure_as_Code_Security_Cheat_Sheet.html)
- OWASP's legacy-application guidance recommends a granular, documented
  modernization plan. Separating a native rehome from a named retirement and
  from a removal-manifest candidate keeps active behavior from being confused
  with obsolete compatibility presentation. [OWASP Legacy Application
  Management Cheat
  Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Legacy_Application_Management_Cheat_Sheet.html)

## Options Considered

### Delete every test that imports a retiring component

**Pros:** Smallest apparent removal diff.

**Cons:** Deletes active editor command and provenance regression coverage.
It contradicts the retained action in the compatibility regression inventory.
Rejected.

### Keep the compatibility components until every old test can remain unchanged

**Pros:** Avoids near-term test movement.

**Cons:** Preserves a legacy component as the owner of native product behavior
and makes compatibility UI permanent. Rejected.

### Classify each executable dependency before removal

**Pros:** Keeps native behavior protected, permits precise assertion retirement
inside shared test files, and leaves removal only to an authorized manifest.

**Cons:** Adds a small source-backed audit that must be updated intentionally
when an import or named test changes. Adopted.

## Final Recommendation Stack

1. Keep the completed native contract rehomes at their owning destination and
   constraint controls; do not restore legacy `customSignals` parity.
2. Retire only the three already-declared compatibility assertions by named
   scope; keep the shared test files and their unrelated native coverage.
3. Add the eight compatibility-only branches and test scopes to the later
   removal manifest, including the modal migration-feedback assertions.
4. Keep route-entry scanning and source-fragment checks in the audit so a new
   direct route or import fails closed.
5. Do not authorize, move, rewrite, or delete a component from this audit.

## Implementation

- `policyCompatibilityComponentDeletionDependencyInventory.mjs` owns the
  immutable ESM dependency records and route-entry scope.
- `policyCompatibilityComponentDeletionDependencyValidation.mjs` owns
  component-boundary, active-regression, named-handoff, and side-effect
  validation.
- `policyCompatibilityComponentDeletionDependencies.mjs` is the small
  orchestration facade for source auditing, route auditing, and the final
  read-only result.
- `server/src/__tests__/services/policyCompatibilityComponentDeletionDependencies.test.mjs`
  reads the real client sources and rejects source drift, route references,
  active-regression removal candidates, and any attempted side effect.
- `policyAuthoringWorkflowCompletionAudit.mjs` includes this audit as a required
  policy-authoring server contract.

## Security Outcome

- An active retained regression cannot be silently classified as a deletion
  candidate.
- A named compatibility retirement must remain tied to its declared ownership
  scope and existing native-storage handoff.
- The audit rejects retiring components that re-enter normal authoring, gain
  raw legacy-payload mutation authority, or lose their delete-after-native-
  storage disposition.
- Route-entry, component, test-file, and named test-scope drift all fail
  closed. Native behavior remains independently verified at the component
  boundaries that now own it.
- The service has no filesystem-write, deletion, storage, route-execution, or
  policy-execution capability.

## Next Step

**Phase 3R, Task 3R.10.6: Compatibility Retirement Manifest Reconciliation**
is complete. The eleven remaining records now have one read-only reconciliation
entry each, including their exact component artifact, native-storage gate set,
native workflow successor tests, and test-file disposition. See [Policy
Compatibility Retirement Manifest
Reconciliation](policy-compatibility-retirement-manifest-reconciliation.md).

Proceed to **Phase 3R, Task 3R.10.7: Compatibility Retirement
Execution-Manifest Binding**. Bind these read-only entries to the existing
authorized removal-execution path only after the declared native-storage
conditions are proven. Do not delete a component or alter storage in that
task.
