# Policy Builder Phase 8R Controlled Compatibility Path Removal Apply

## Intent

Phase 8R.18 applies one reviewed compatibility path removal batch through an
explicit apply adapter. It consumes Phase 8R.17 output, requires an explicit
execute flag and operator confirmation, invokes only the injected adapter, and
verifies that every apply result matches the reviewed manifest path and action.

The service does not run Git commands or mutate database storage. It allows only
bounded removal side effects reported by the adapter, and rejects archive,
storage, or Git-command side effects.

## Official-Source Research

- Git `rm` documents that removing tracked files affects the index and, by
  default, the working tree. Phase 8R.18 keeps Git operations outside the
  service boundary so file removal and version-control staging remain explicit.
- NIST SP 800-128 describes security-focused configuration management as part
  of maintaining system integrity. Phase 8R.18 applies that by requiring an
  approved batch, operator confirmation, bounded adapter execution, and result
  parity.
- NIST SSDF recommends integrating secure software development practices into
  the SDLC. Phase 8R.18 keeps destructive compatibility cleanup auditable and
  testable instead of implicit.
- OWASP API9:2023 Improper Inventory Management notes risk from deprecated
  surfaces and stale inventory. Phase 8R.18 removes only paths that came from
  the approved Phase 8R.15 manifest and Phase 8R.17 review batch.

Sources:

- Git `rm` documentation:
  <https://git-scm.com/docs/git-rm>
- NIST SP 800-128:
  <https://csrc.nist.gov/pubs/sp/800/128/upd1/final>
- NIST Secure Software Development Framework:
  <https://csrc.nist.gov/projects/ssdf>
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

A ready Phase 8R.17 batch is not enough by itself. The apply step requires
`executeApply=true` and a named confirming actor.

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

Use this stack for Phase 8R.18:

1. Consume a ready Phase 8R.17 removal review batch.
2. Require explicit operator apply confirmation.
3. Execute each selected entry through an injected `applyEntry(entry)` adapter.
4. Reject mismatched paths, mismatched actions, incomplete results, archive
   side effects, storage mutation, and Git-command side effects.
5. Emit apply evidence for Phase 8R.19 post-removal runtime verification.

## Implementation Outcome

Implemented:

- Added `policyBuilderPhase8ControlledCompatibilityPathRemovalApply.mjs`.
- Added status IDs for:
  - applied,
  - blocked by removal batch,
  - blocked by confirmation,
  - blocked by adapter,
  - blocked by apply result.
- Added risk IDs for non-ready batches, missing confirmation, missing adapter,
  adapter failures, result count mismatch, path mismatch, action mismatch,
  incomplete apply results, unexpected side effects, stale risk counts, and
  unknown statuses.
- Added focused tests for successful adapter apply, removal-batch blocker,
  confirmation blocker, adapter blocker, result-parity blocker, adapter-failure
  blocker, unexpected side-effect blocker, and validation of mutated output.

Not implemented in this component:

- no hardcoded filesystem deletion,
- no Git command execution,
- no database mutation,
- no automatic route rewiring.

## Next Step

Proceed with **Phase 8R.19 Post-Removal Runtime Verification**. That task
should consume Phase 8R.18 apply evidence, verify removed paths are no longer
imported or required, run focused runtime/import checks, and require broader
test validation before additional compatibility batches are applied.
