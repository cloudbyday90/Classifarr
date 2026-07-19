# Policy Controlled Compatibility Path Removal Apply

## Intent

Controlled Compatibility Path Removal Apply applies one reviewed compatibility
path removal batch through an explicit apply adapter. It consumes controlled
compatibility path removal output, requires an explicit execute flag and
operator confirmation, invokes only the injected adapter, and verifies that
every apply result matches the reviewed manifest path and action.

The batch fails closed after the first adapter exception, rejected result, or
forbidden reported side effect. It records the stopped entry and a bounded halt
reason, does not recheck or submit later entries, and preserves any earlier
applied evidence for the dedicated partial-apply verification task. When no
path applied, it directs the caller to resolve the apply blocker instead of
claiming runtime verification is ready. Until that task exists, neither a
partial nor a zero-removal batch can authorize another removal batch.

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
- OWASP A10:2025 advises that exceptional conditions should fail closed rather
  than attempting partial continuation. The adapter loop therefore stops on the
  first rejected execution outcome instead of broadening a partially failed
  batch.
- OWASP's CI/CD guidance recommends explicit flow controls, least privilege,
  artifact integrity validation, and visibility. The adapter boundary combines
  those controls with bounded execution evidence.

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
- OWASP Top 10:2025 A10, Mishandling of Exceptional Conditions:
  <https://owasp.org/Top10/2025/A10_2025-Mishandling_of_Exceptional_Conditions/>
- OWASP CI/CD Security Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/CI_CD_Security_Cheat_Sheet.html>

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

### Contain Adapter Failures And Rejected Results

Treat an adapter exception, `applied=false`, path/action mismatch, or forbidden
reported side effect as a batch stop, not an invitation to continue to later
entries. Emit the stopping path and a small fixed halt-reason vocabulary.

Pros:

- limits a failed batch to the smallest possible executed prefix,
- prevents later removals after adapter behavior has become untrustworthy,
- gives automation a deterministic next action for partial or zero-removal
  outcomes.

Cons:

- an adapter fault requires a newly reviewed batch after remediation,
- partial success still requires the existing runtime verification before any
  later removal is considered.

## Final Recommendation Stack

Use this stack for controlled compatibility path removal apply:

1. Validate the fingerprinted review artifact and replay its execution context.
2. Rebuild the execution gate from the review's recorded preflight evidence.
3. Require explicit operator apply confirmation.
4. Recheck each selected entry against the live checkout immediately before it
   reaches the injected `applyEntry(entry)` adapter.
5. Stop at the first adapter exception, rejected result, archive side effect,
   storage mutation, or Git-mutation side effect; do not submit later entries.
6. Emit the halted entry, fixed halt reason, and only the evidence for entries
   already applied.
7. Add a bounded partial-apply verifier before permitting runtime verification
   after partial success; route zero-removal outcomes to blocker resolution.

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
  - `POLICY_CONTROLLED_COMPATIBILITY_PATH_REMOVAL_APPLY_HALT_REASON_IDS`,
  - `applyPolicyControlledCompatibilityPathRemoval`,
  - `validatePolicyControlledCompatibilityPathRemovalApply`.
- Updated the contract version to
  `policy.controlled_compatibility_path_removal_apply.v4`.
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
- Added fail-closed adapter containment. An adapter exception, invalid result,
  or forbidden reported side effect stops the reviewed batch before another
  entry is rechecked or submitted. Apply output includes a validated halt
  reason and the next step distinguishes partial removal verification from
  zero-removal blocker resolution.
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
- no automatic route rewiring,
- no partial-apply runtime-verification eligibility (reserved for Task 8R.19.2).

## Next Step

Proceed with **8R.19.2 Partial-Apply Runtime Verification Eligibility**. It
must verify only the exact prefix that applied after a halted batch while
retaining the completed-batch contract and forbidding next-batch authorization
or completion from partial evidence.
