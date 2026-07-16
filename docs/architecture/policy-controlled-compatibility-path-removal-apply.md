# Policy Controlled Compatibility Path Removal Apply

## Intent

Controlled Compatibility Path Removal Apply applies one reviewed compatibility
path removal batch through an explicit apply adapter. It consumes controlled
compatibility path removal output, requires an explicit execute flag and
operator confirmation, invokes only the injected adapter, and verifies that
every apply result matches the reviewed manifest path and action.

The service does not run Git mutation commands or mutate database storage. It
uses fixed-argument, read-only Git verification immediately before each adapter
call, allows only bounded removal side effects reported by the adapter, and
rejects archive, storage, or Git-mutation side effects.

Before any adapter call, the apply boundary now validates a fingerprinted review
artifact, replays the reviewed batch from its embedded execution-plan artifact
and gate, and rebuilds the gate from its recorded preflight evidence. This
prevents a ready-looking review object from applying a changed manifest,
changed batch, missing context, or stale/altered gate evidence.

The final verifier additionally compares each actionable entry with the exact
preflight checkout revision and manifest observation. A revision change, path
replacement, symlink, non-regular path, tree mismatch, or worktree change
blocks that entry before the adapter receives it.

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
- SLSA Build: Verifying artifacts recommends that an artifact consumer verify
  provenance against the artifact digest and its expected properties before
  use. The adapter is the consumer in this flow, so Classifarr verifies the
  review artifact and replays its source context before invoking it.
- Git `diff --quiet --no-ext-diff` gives the verifier a no-output, no-external
  helper comparison of the path with `HEAD`; Git `ls-tree -z` supplies the
  exact mode, type, object ID, and path required to verify a regular blob.
- Node.js `lstatSync()` exposes file and symlink metadata without following the
  final symlink, supporting a fail-closed path-type check at the apply boundary.

Sources:

- Git `rm` documentation:
  <https://git-scm.com/docs/git-rm>
- NIST SP 800-128:
  <https://csrc.nist.gov/pubs/sp/800/128/upd1/final>
- NIST Secure Software Development Framework SP 800-218:
  <https://csrc.nist.gov/pubs/sp/800/218/final>
- OWASP API9:2023 Improper Inventory Management:
  <https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/>
- SLSA Build: Verifying artifacts:
  <https://slsa.dev/spec/v1.2/verifying-artifacts>
- Git diff options: <https://git-scm.com/docs/diff-options>
- Git ls-tree: <https://git-scm.com/docs/git-ls-tree>
- Node.js file system API: <https://nodejs.org/api/fs.html>

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

### Verify Review Artifact Integrity Before Apply

The apply service accepts a review only when its SHA-256 review artifact still
binds the execution-plan artifact, execution gate, selected entries, review
reason, and reviewer. It reconstructs the gate from the embedded preflight
evidence and replays the removal review before an adapter receives any entry.

Pros:

- blocks changed or detached review context before destructive work begins,
- prevents a stale ready flag from authorizing different entries,
- keeps integrity verification inside the narrow apply boundary.

Cons:

- reviewed batches must carry the complete bounded execution context,
- intentional changes require a new review artifact and confirmation.

### Verify Result Parity

Every adapter result must match the selected path and action and report
`applied=true`.

Pros:

- prevents broad or mismatched removals,
- catches adapter defects,
- gives the post-removal verifier a stable evidence record.

Cons:

- adapters must return structured results.

### Perform A Final Per-Entry Read-Only Recheck

Immediately before an adapter receives an approved entry, require the current
Git revision to match preflight, the live path to be a regular non-symlink file,
the `HEAD` entry to be the expected regular blob, and the path to match `HEAD`.

Pros:

- prevents a post-preflight checkout or path change from reaching the adapter,
- keeps evidence collection separate from apply-time execution,
- exposes a bounded blocked entry rather than a misleading successful batch.

Cons:

- requires a real Git checkout at controlled apply time,
- a later entry can block after a prior narrow entry has applied.

## Final Recommendation Stack

Use this stack for controlled compatibility path removal apply:

1. Validate the fingerprinted review artifact and replay its execution context.
2. Rebuild the execution gate from the review's recorded preflight evidence.
3. Require explicit operator apply confirmation.
4. Recheck each selected entry against the live checkout immediately before it
   reaches the injected `applyEntry(entry)` adapter.
5. Reject mismatched paths, mismatched actions, incomplete results, archive
   side effects, storage mutation, and Git-mutation side effects.
6. Emit apply evidence and semantic `nextStep` for post-removal runtime
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
  `policy.controlled_compatibility_path_removal_apply.v3`.
- Added a modular review-artifact fingerprint that binds the complete reviewed
  execution context and removal batch.
- Revalidates the embedded execution gate from its recorded preflight evidence
  and replays the review before the adapter can receive an entry.
- Added a distinct review-integrity blocker for missing, altered, mismatched, or
  non-replayable review context.
- Added the final read-only pre-apply change detector. It verifies the current
  checkout revision, approved manifest observation, regular non-symlink file,
  `HEAD` regular blob, and `HEAD` content parity before every adapter call.
- Added a distinct `blocked_by_pre_apply_recheck` result with bounded per-entry
  verification summaries and stops a batch before a changed entry reaches the
  adapter.
- Replaced runtime `nextPhase.phaseId` with semantic `nextStep.stepId`.
- Preserved status IDs for applied output and blockers from removal batch,
  confirmation, adapter, and apply result evidence.
- Preserved risk IDs for non-ready batches, missing confirmation, missing
  adapter, adapter failures, result count mismatch, path mismatch, action
  mismatch, incomplete apply results, unexpected side effects, stale risk
  counts, and unknown statuses.

Not implemented in this component:

- no hardcoded filesystem deletion,
- no Git mutation command execution,
- no database mutation,
- no automatic route rewiring.

## Next Step

Proceed with **8R.16.5 Embedded-Runtime Evidence Escalation Rules**. The
runtime verifier must define when retained evidence is insufficient and when a
provenance-bound, read-only embedded runtime probe is required.
