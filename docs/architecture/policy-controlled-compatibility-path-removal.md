# Policy Controlled Compatibility Path Removal

## Intent

Controlled Compatibility Path Removal creates a small, reviewable compatibility
path removal batch after one evidence-bound execution-plan artifact and its
final execution gate pass. It does not delete files, archive files, remove
routes, remove tests, mutate storage, write manifests, or run Git commands.

The component separates three concerns:

- the execution-plan artifact owns the approved removal manifest and its
  deterministic fingerprint,
- compatibility deletion execution gating owns final preflight approval bound to
  that artifact,
- controlled compatibility path removal owns narrow batch selection from the
  artifact-owned approved manifest.

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
- SLSA's artifact-verification guidance requires consumers to compare an
  artifact against its provenance subject digest and reject unexpected values.
  The removal boundary applies the same consumer-side integrity model by
  validating the supplied artifact fingerprint and requiring the gate's nested
  artifact fingerprint to match it before selecting manifest paths.

Sources:

- NIST Secure Software Development Framework SP 800-218:
  <https://csrc.nist.gov/pubs/sp/800/218/final>
- OWASP API9:2023 Improper Inventory Management:
  <https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/>
- NIST SP 800-34 Rev. 1:
  <https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final>
- OWASP Logging Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>
- SLSA Build: Verifying artifacts:
  <https://slsa.dev/spec/v1.2/verifying-artifacts>

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

### Bind The Gate To The Selection Artifact

The review builder accepts `executionPlanArtifact`, not a raw execution plan.
It validates that artifact and its fingerprint, validates the artifact embedded
in the execution gate, and requires both fingerprints to match before it reads
manifest entries.

Pros:

- prevents a ready gate from authorizing a different or altered manifest,
- makes the selected paths traceable to one immutable approval context,
- keeps selection side-effect-free while rejecting stale caller composition.

Cons:

- callers must carry the versioned artifact through to the review boundary,
- regenerated artifacts require a matching regenerated gate and preflight
  evidence.

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

1. Use one fingerprint-valid execution-plan artifact as the approved manifest
   source.
2. Require a ready execution gate whose embedded artifact has the same
   fingerprint.
3. Select a small artifact-manifest-backed batch with a review reason and
   reviewer.
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
  `policy.controlled_compatibility_path_removal.v2`.
- Replaced independent raw execution-plan and execution-gate inputs with the
  evidence-bound `executionPlanArtifact` plus gate pair.
- Validates the selected artifact fingerprint, the gate's embedded artifact,
  and their equality before manifest selection. A ready gate from a different
  artifact or manifest is blocked.
- Replaced runtime `nextPhase.phaseId` with semantic `nextStep.stepId`.
- Preserved status IDs for ready removal review and blockers from execution
  artifact, execution gate, selection, scope, and approval.
- Added bounded risks for missing, invalid, and mismatched gate artifacts while
  preserving risks for empty selections, unknown paths, too-broad batches,
  missing review metadata, stale risk counts, and forbidden side effects.

Not implemented in this component:

- no file deletion,
- no route removal,
- no test removal,
- no Git command execution,
- no manifest write,
- no storage mutation.

## Next Step

Proceed with **8R.18.1 Review Artifact Integrity**. The apply boundary must
revalidate that its reviewed batch still carries the same artifact and gate
context before it invokes an adapter.
