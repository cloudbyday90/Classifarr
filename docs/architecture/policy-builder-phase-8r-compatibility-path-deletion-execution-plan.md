# Policy Builder Phase 8R Compatibility Path Deletion Execution Plan

## Intent

Phase 8R.15 creates an explicit, reviewable compatibility deletion execution
manifest. It still does not delete files, remove routes, remove tests, archive
code, write manifests, or mutate storage.

The purpose is to convert readiness into a concrete manifest:

- exact file or code path,
- deletion category,
- intended action,
- replacement evidence,
- rollback stance,
- support stance,
- approval state,
- execution prerequisites.

Actual deletion remains a later execution-gate task.

## Official-Source Research

- NIST SSDF recommends integrating secure development practices into the SDLC
  and following change-management discipline for software updates. Phase 8R.15
  treats compatibility deletion as a planned change with explicit evidence,
  approval, and a later execution gate.
- OWASP API9:2023 Improper Inventory Management highlights the risk of stale,
  deprecated, or undocumented surfaces. Phase 8R.15 turns the compatibility
  inventory into an actionable deletion manifest rather than leaving stale
  paths implicit.
- CISA Secure by Design guidance discourages unsafe legacy features and
  emphasizes clear upgrade paths. Phase 8R.15 continues the re-imagined model by
  planning removal of replaced compatibility paths instead of hiding them.
- NIST SP 800-34 emphasizes contingency planning and recovery validation.
  Phase 8R.15 requires rollback or post-window recovery stance before deletion
  execution can advance.

Sources:

- NIST Secure Software Development Framework:
  <https://csrc.nist.gov/projects/ssdf>
- OWASP API9:2023 Improper Inventory Management:
  <https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/>
- CISA Secure by Design:
  <https://www.cisa.gov/securebydesign>
- NIST SP 800-34 Rev. 1:
  <https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final>

## Recommendations

### Generate A Manifest, Not A Delete Operation

Phase 8R.15 should produce a manifest from the Phase 8R.7 deletion categories
and Phase 8R.14 readiness output. It must not execute deletion.

Pros:

- creates exact review material,
- keeps destructive work out of planning,
- gives tests a concrete contract to validate.

Cons:

- deletion still requires another gate,
- replacement evidence must be supplied for every path.

### Require Replacement Evidence Per Path Or Category

Every manifest entry must have replacement evidence. Evidence can be attached
by exact path or deletion category.

Pros:

- prevents partial cleanup without parity proof,
- supports category-level evidence where many files share the same replacement,
- makes missing replacement work visible before deletion.

Cons:

- broad categories need careful evidence wording,
- missing evidence blocks the whole execution plan.

### Require Approval And Recovery Stance

The execution plan must include:

- rollback or post-window recovery stance,
- support stance for converted native policies,
- explicit manifest approval.

Pros:

- prevents accidental destructive execution,
- gives support teams a known post-deletion stance,
- aligns deletion planning with backup/restore and rollback proof.

Cons:

- approval is intentionally required even when readiness passed.

## Final Recommendation Stack

Use this stack for Phase 8R.15:

1. `policyCompatibilityDeletionReadiness.mjs` proves deletion
   readiness.
2. `policyCompatibilityDeletionGates.mjs` supplies compatibility
   categories and paths.
3. `policyBuilderPhase8CompatibilityPathDeletionExecutionPlan.mjs` builds a
   side-effect-free manifest with action IDs, replacement evidence, rollback
   stance, support stance, and approval state.
4. A later Phase 8R execution gate should verify the worktree, backup, operator
   approval, and manifest freshness immediately before deletion.

## Implementation Outcome

Implemented:

- Added `policyBuilderPhase8CompatibilityPathDeletionExecutionPlan.mjs`.
- Added manifest action IDs for:
  - delete file,
  - replace code path,
  - remove test.
- Added validation risk IDs for readiness, manifest evidence, approval,
  rollback/support stance, and forbidden side effects.
- Built manifest entries from Phase 8R.7 deletion categories and exact paths.
- Required replacement evidence per path or category.
- Required rollback stance, support stance, and explicit approval.
- Added tests for ready manifest output, readiness blocking, missing evidence,
  missing approval/stance, and side-effect validation.

Not implemented in this component:

- no file deletion,
- no route removal,
- no test removal,
- no manifest write,
- no storage mutation.

## Next Step

Proceed with **Phase 8R.16 Compatibility Path Deletion Execution Gate**. That
task should verify clean worktree state, fresh backup/restore evidence,
operator approval, manifest freshness, and final rollback/support stance
immediately before allowing any compatibility path deletion.
