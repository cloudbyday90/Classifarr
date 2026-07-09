# Policy Controlled Compatibility Path Removal Apply

## Intent

Controlled Compatibility Path Removal Apply applies one reviewed compatibility
path removal batch through an explicit apply adapter. It consumes controlled
compatibility path removal output, requires an explicit execute flag and
operator confirmation, invokes only the injected adapter, and verifies that
every apply result matches the reviewed manifest path and action.

The service does not run Git commands or mutate database storage. It allows
only bounded removal side effects reported by the adapter, and rejects archive,
storage, or Git-command side effects.

## Official-Source Research

- Git `rm` documents that removal affects tracked paths in the index and, by
  default, the working tree. The apply service keeps Git operations outside the
  service boundary so version-control staging remains explicit.
- NIST SP 800-128 describes security-focused configuration management as part
  of maintaining system integrity. The apply boundary requires approved batch
  input, operator confirmation, bounded adapter execution, and result parity.
- NIST SSDF SP 800-218 recommends secure development practices integrated into
  the SDLC. The apply boundary keeps destructive compatibility cleanup
  explicit, auditable, and testable.
- OWASP API9:2023 Improper Inventory Management notes risk from deprecated
  surfaces and stale inventory. The apply boundary removes only paths that came
  from the approved manifest-backed review batch.

Sources:

- Git `rm` documentation:
  <https://git-scm.com/docs/git-rm>
- NIST SP 800-128:
  <https://csrc.nist.gov/pubs/sp/800/128/upd1/final>
- NIST Secure Software Development Framework SP 800-218:
  <https://csrc.nist.gov/pubs/sp/800/218/final>
- OWASP API9:2023 Improper Inventory Management:
  <https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/>

## Recommendations

### Use An Explicit Apply Adapter

The apply service should not contain hardcoded filesystem or Git operations. It
should call an injected adapter so the destructive boundary is explicit and
testable.

Pros:

- keeps removal mechanics replaceable,
- makes tests deterministic,
- prevents hidden Git or storage mutation.

Cons:

- production execution needs a separate adapter implementation.

### Require Operator Confirmation

A ready controlled removal batch is not enough by itself. The apply step
requires `executeApply=true` and a named confirming actor.

Pros:

- prevents accidental apply calls,
- preserves an audit trail,
- separates review from execution.

Cons:

- adds one more explicit control before removal.

### Verify Result Parity

Every adapter result must match the selected path and action and report
`applied=true`.

Pros:

- prevents broad or mismatched removals,
- catches adapter defects,
- gives the post-removal verifier a stable evidence record.

Cons:

- adapters must return structured results.

## Final Recommendation Stack

Use this stack for controlled compatibility path removal apply:

1. Consume a ready controlled compatibility path removal batch.
2. Require explicit operator apply confirmation.
3. Execute each selected entry through an injected `applyEntry(entry)` adapter.
4. Reject mismatched paths, mismatched actions, incomplete results, archive
   side effects, storage mutation, and Git-command side effects.
5. Emit apply evidence and semantic `nextStep` for post-removal runtime
   verification.

## Implementation Outcome

Implemented:

- Renamed the production contract to
  `policyControlledCompatibilityPathRemovalApply.mjs`.
- Renamed the focused test suite to
  `policyControlledCompatibilityPathRemovalApply.test.mjs`.
- Replaced phase-coded contract exports with:
  - `POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_VERSION`,
  - `POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_STATUS_IDS`,
  - `POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_RISK_IDS`,
  - `applyPolicyControlledCompatibilityPathRemoval`,
  - `validatePolicyControlledCompatibilityPathRemovalApply`.
- Updated the contract version to
  `policy.controlled_compatibility_path_removal_apply.v1`.
- Replaced runtime `nextPhase.phaseId` with semantic `nextStep.stepId`.
- Preserved status IDs for applied output and blockers from removal batch,
  confirmation, adapter, and apply result evidence.
- Preserved risk IDs for non-ready batches, missing confirmation, missing
  adapter, adapter failures, result count mismatch, path mismatch, action
  mismatch, incomplete apply results, unexpected side effects, stale risk
  counts, and unknown statuses.

Not implemented in this component:

- no hardcoded filesystem deletion,
- no Git command execution,
- no database mutation,
- no automatic route rewiring.

## Next Step

Proceed with **Post-Removal Runtime Verification Artifact module naming
cutover**. That task should consume durable controlled-removal apply evidence
and remove phase-coded names from the runtime verification wrapper without
changing verification behavior.
