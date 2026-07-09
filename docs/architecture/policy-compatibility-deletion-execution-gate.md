# Policy Compatibility Deletion Execution Gate

## Intent

Policy compatibility deletion execution gate is the final pre-execution gate
before compatibility path deletion can move to a separate controlled deletion
step. It does not delete files, archive files, remove routes, remove tests,
mutate storage, write manifests, or run Git commands.

The gate verifies:

- compatibility deletion execution plan is ready and valid,
- worktree cleanliness has been confirmed,
- backup and restore evidence is verified and fresh,
- operator approval exists and names the approving actor,
- rollback or post-window recovery stance is final,
- support stance for converted native policies is final,
- manifest is fresh and still matches the current execution plan.

## Official-Source Research

- Git `status` documentation defines how to inspect worktree state. This gate
  treats clean-worktree confirmation as a required precondition, but the
  contract itself does not run Git commands.
- NIST SSDF recommends integrating secure software practices into the SDLC and
  following change-management discipline for software updates. This gate
  applies that by requiring explicit operator approval and a valid execution
  plan before deletion.
- OWASP API9:2023 Improper Inventory Management highlights risk from stale or
  deprecated surfaces. This gate keeps deletion tied to a current manifest so
  stale compatibility paths are not removed ad hoc.
- NIST SP 800-34 provides contingency-planning and recovery guidance. This gate
  requires fresh backup/restore evidence and final recovery stance before
  allowing deletion execution to proceed.

Sources:

- Git `status` documentation:
  <https://git-scm.com/docs/git-status>
- NIST Secure Software Development Framework:
  <https://csrc.nist.gov/pubs/sp/800/218/final>
- OWASP API9:2023 Improper Inventory Management:
  <https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/>
- NIST SP 800-34 Rev. 1:
  <https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final>

## Recommendations

### Keep The Gate Non-Destructive

The execution gate should approve or block a later controlled deletion step. It
should not perform deletion itself.

Pros:

- keeps destructive changes reviewable,
- gives tests a stable preflight contract,
- prevents hidden file, route, or storage mutation during evaluation.

Cons:

- deletion still requires a later execution step.

### Require Worktree And Manifest Freshness

Deletion should not proceed from a stale manifest or dirty worktree. The gate
requires callers to provide those confirmations immediately before execution.

Pros:

- prevents deleting from an outdated plan,
- reduces risk of mixing unrelated work with compatibility removal,
- makes the final execution step easier to audit.

Cons:

- the service depends on external preflight evidence, not direct Git execution.

### Require Recovery And Human Approval

The final gate requires fresh backup/restore evidence, operator approval, final
rollback or post-window recovery stance, and final support stance.

Pros:

- keeps recovery proof immediately ahead of deletion,
- requires a named approver,
- makes support behavior explicit before compatibility paths disappear.

Cons:

- more conservative than direct automated cleanup.

## Final Recommendation Stack

Use this stack:

1. `policyCompatibilityDeletionExecutionPlan.mjs` creates the
   exact manifest.
2. `policyCompatibilityDeletionExecutionGate.mjs` validates
   final worktree, recovery, approval, support, and manifest freshness signals.
3. A later controlled deletion component may consume a ready gate output, but
   only that later step should perform file removal.

## Implementation Outcome

Implemented:

- Added `policyCompatibilityDeletionExecutionGate.mjs`.
- Added gate status IDs for:
  - ready for controlled deletion,
  - blocked by execution plan,
  - blocked by worktree,
  - blocked by recovery evidence,
  - blocked by approval,
  - blocked by manifest freshness.
- Added risk IDs for execution-plan readiness, worktree cleanliness, recovery
  evidence, operator approval, final support stances, manifest freshness, and
  forbidden side effects.
- Added focused tests for ready gate output, execution-plan blocker, worktree
  blocker, recovery blocker, approval blocker, manifest freshness blocker, and
  side-effect validation.

Not implemented in this component:

- no file deletion,
- no route removal,
- no test removal,
- no Git command execution,
- no manifest write,
- no storage mutation.

## Next Step

Proceed with **Controlled Compatibility Path Removal**. That task should be the
first component allowed to remove compatibility paths, and only after it
consumes a ready compatibility deletion execution-gate output and performs a
narrow, reviewable deletion scope.
