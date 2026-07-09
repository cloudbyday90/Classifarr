# Policy Controlled Compatibility Path Removal

## Intent

Controlled Compatibility Path Removal creates a small, reviewable compatibility
path removal batch after the compatibility deletion execution plan and final
execution gate pass. It does not delete files, archive files, remove routes,
remove tests, mutate storage, write manifests, or run Git commands.

The component separates three concerns:

- compatibility deletion execution planning owns the approved removal manifest,
- compatibility deletion execution gating owns final preflight approval,
- controlled compatibility path removal owns narrow batch selection from the
  approved manifest.

Current implementation evidence shows several manifest paths still have live
imports. Because of that, this component prepares and validates the removal
batch but keeps destructive application for a separate apply step.

## Official-Source Research

- NIST SSDF SP 800-218 recommends secure development practices integrated into
  the software development life cycle and a common vocabulary for secure
  software work. This component applies that by using a stable policy contract
  name, bounded validation, and a side-effect-free review boundary.
- OWASP API9:2023 Improper Inventory Management highlights the risk of stale or
  deprecated surfaces without current inventories or retirement plans. This
  component only accepts paths from the approved deletion manifest.
- NIST SP 800-34 Rev. 1 provides contingency planning guidance and emphasizes
  evaluating recovery and operational requirements. This component relies on
  upstream backup, restore, rollback, and operator approval evidence before a
  removal batch can be considered ready.
- OWASP Logging Cheat Sheet guidance recommends recording actionable event
  context and avoiding unsafe or excessive detail. This contract keeps review
  metadata explicit while leaving destructive action evidence for the apply
  boundary.

Sources:

- NIST Secure Software Development Framework SP 800-218:
  <https://csrc.nist.gov/pubs/sp/800/218/final>
- OWASP API9:2023 Improper Inventory Management:
  <https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/>
- NIST SP 800-34 Rev. 1:
  <https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final>
- OWASP Logging Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>

## Recommendations

### Keep Removal Batch Selection Side-Effect-Free

The service should only decide whether a small removal batch is ready for
operator review. Actual file removal belongs to the apply component.

Pros:

- prevents accidental deletion of live code,
- gives the apply boundary an exact scope,
- keeps destructive work separately reviewable.

Cons:

- requires another component before compatibility code disappears.

### Require Approved Manifest Paths

Only paths listed in the compatibility deletion execution manifest may enter a
removal batch.

Pros:

- prevents ad hoc deletion,
- ties removal to replacement evidence,
- preserves the compatibility inventory.

Cons:

- newly discovered paths must flow through the manifest first.

### Keep The Batch Narrow

Removal batches should stay small enough to inspect manually. The contract
defaults to three paths per batch and blocks broader selections.

Pros:

- reduces blast radius,
- makes test failures easier to isolate,
- supports incremental removal of still-live compatibility paths.

Cons:

- full cleanup requires multiple batches.

## Final Recommendation Stack

Use this stack for controlled compatibility path removal:

1. Use the compatibility deletion execution plan as the approved manifest
   source.
2. Use the compatibility deletion execution gate as final preflight proof.
3. Select a small manifest-backed batch with a review reason and reviewer.
4. Emit a side-effect-free removal batch and semantic `nextStep` for the apply
   boundary.

## Implementation Outcome

Implemented:

- Renamed the production contract to
  `policyControlledCompatibilityPathRemoval.mjs`.
- Renamed the focused test suite to
  `policyControlledCompatibilityPathRemoval.test.mjs`.
- Replaced phase-coded contract exports with:
  - `POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_VERSION`,
  - `POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_STATUS_IDS`,
  - `POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_RISK_IDS`,
  - `buildPolicyControlledCompatibilityPathRemoval`,
  - `validatePolicyControlledCompatibilityPathRemoval`.
- Updated the contract version to
  `policy.controlled_compatibility_path_removal.v1`.
- Replaced runtime `nextPhase.phaseId` with semantic `nextStep.stepId`.
- Preserved status IDs for ready removal review and blockers from execution
  plan, execution gate, selection, scope, and approval.
- Preserved risk IDs for non-ready dependencies, empty selections, unknown
  paths, too-broad batches, missing review metadata, stale risk counts, and
  forbidden side effects.

Not implemented in this component:

- no file deletion,
- no route removal,
- no test removal,
- no Git command execution,
- no manifest write,
- no storage mutation.

## Next Step

Proceed with **Controlled Compatibility Path Removal Apply module naming
cutover**. That task should consume the ready controlled removal batch through
the durable contract, then remove the remaining apply-specific phase-coded
service/test/doc names without changing deletion behavior.
