# Policy Compatibility Retirement Manifest Reconciliation

**Status:** Complete

**Roadmap task:** Phase 3R, Task 3R.10.6

**Decision date:** 2026-08-01

## Decision

The compatibility retirement manifest is an immutable, read-only reconciliation
of the eleven remaining executable dependencies. It is not an execution
manifest, does not authorize deletion, and cannot change storage, source files,
or tests.

Each entry records the retiring component artifact, its `delete_after_native_storage`
disposition, the complete native-storage gate set, native workflow successor
tests, and the exact treatment of its source:

| Entry type | Count | Reconciled disposition |
| --- | ---: | --- |
| Named compatibility retirement | 3 | Remove only named assertions from a retained shared test file. |
| Runtime removal-manifest candidate | 3 | Remove the runtime reference with its retiring component. |
| Dedicated-test removal-manifest candidate | 4 | Delete the dedicated bridge test file with its compatibility surface. |
| Shared-test removal-manifest candidate | 1 | Remove the named completed-migration assertion while retaining unrelated modal coverage. |

Every entry requires native intent storage to be authoritative and preserves all
seven existing deletion gates: native intent schema, lossless conversion,
rollback snapshot, native read/write parity, legacy write shutdown, backup and
restore verification, and regression coverage. It also carries the existing
handoff evidence for native workflow tests, native-storage coverage, authorized
removal completion, final reference scanning, and focused plus full validation.

## Research

Official sources were reviewed on 2026-08-01 against the requested
current-through-June-2026 baseline.

- NIST's SSDF treats secure development as an outcome-based set of practices
  that can be integrated with an organization's delivery process. A
  source-backed, independently verifiable retirement record makes the later
  deletion decision auditable rather than implicit. [NIST Secure Software
  Development Framework](https://csrc.nist.gov/Projects/ssdf)
- OWASP recommends keeping an inventory of legacy applications and their
  configuration, then using a granular modernization plan that states the
  security case and migration steps. Mapping every import and test scope before
  removal follows that guidance. [OWASP Legacy Application Management Cheat
  Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Legacy_Application_Management_Cheat_Sheet.html)

## Options Considered

### Delete the remaining compatibility references directly

**Pros:** Small immediate diff.

**Cons:** Cannot prove that a shared test keeps its unrelated native coverage,
or that native storage and successor tests meet the existing cutover gates.
Rejected.

### Create a second execution system for this task

**Pros:** Keeps Phase 3R self-contained.

**Cons:** Duplicates the existing authorization and execution machinery from
the later compatibility-removal work, creating divergent destructive paths.
Rejected.

### Reconcile exact dependencies to existing cutover evidence

**Pros:** Preserves one authoritative execution path, makes all eleven actions
explicit, fails closed on inventory or handoff drift, and leaves deletion for a
later authorized task.

**Cons:** Adds a small inventory adapter and validation contract that must be
kept aligned with future compatibility imports and named tests. Adopted.

## Final Recommendation Stack

1. Keep one read-only entry per dependency, with no inferred bulk removal.
2. Require the completed source-backed dependency audit before the
   reconciliation is ready.
3. Gate every entry on native intent storage authority and all existing
   native-storage deletion gates.
4. Preserve native workflow successors and all later deletion evidence in each
   entry, including the exact shared-test disposition.
5. Bind the result to the existing authorized execution-manifest path only in
   the next task; do not introduce a second remover or change storage.

## Implementation

- `policyCompatibilityRetirementManifestInventory.mjs` derives each immutable
  entry from the existing component-dependency, bridge-artifact, test-ownership,
  and cutover-handoff inventories.
- `policyCompatibilityRetirementManifestReconciliation.mjs` validates
  one-to-one coverage, complete gate and evidence sets, component boundaries,
  named test ownership, and read-only behavior.
- `server/src/__tests__/services/policyCompatibilityRetirementManifestReconciliation.test.mjs`
  reads the real dependency sources through the prerequisite audit, verifies
  all eleven actions, and rejects named-scope drift or any attempted write,
  deletion, or storage mutation.
- `policyAuthoringWorkflowCompletionAudit.mjs` now treats this reconciliation
  as a required policy-authoring server contract.

## Security Outcome

- No removal candidate can bypass the required native-storage gate set.
- Shared test files cannot be treated as deletable without their exact source
  handoff; named assertions are recorded separately from the file itself.
- Existing component artifacts must remain outside normal authoring and cannot
  have raw legacy-payload mutation authority.
- A missing, stale, or deletion-authorizing dependency audit blocks the
  reconciliation.
- The service has no filesystem-write, deletion, route-execution, policy-
  execution, execution-manifest, or storage-mutation capability.

## Next Step

Proceed to **Phase 3R, Task 3R.10.7: Compatibility Retirement
Execution-Manifest Binding**. Bind the exact eleven-entry reconciliation to
the existing authorized execution-manifest path after the native-storage gate
evidence is proven. The binding remains read-only and does not remove files or
change storage.
