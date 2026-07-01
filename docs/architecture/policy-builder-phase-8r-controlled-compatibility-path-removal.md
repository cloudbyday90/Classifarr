# Policy Builder Phase 8R Controlled Compatibility Path Removal

## Intent

Phase 8R.17 creates the first controlled compatibility path removal batch after
the deletion execution gate passes. It does not delete files, archive files,
remove routes, remove tests, mutate storage, write manifests, or run Git
commands.

The component intentionally separates three concerns:

- Phase 8R.15 owns the approved removal manifest.
- Phase 8R.16 owns final preflight approval.
- Phase 8R.17 owns a narrow, reviewable batch selection from the approved
  manifest.

Current implementation evidence shows several manifest paths still have live
imports. Because of that, Phase 8R.17 prepares and validates the removal batch
but keeps destructive application for a later apply step.

## Official-Source Research

- Git `status` documents how to inspect differences in the worktree, index, and
  untracked files. Phase 8R.17 consumes the clean-worktree proof from Phase
  8R.16 instead of running Git itself.
- NIST SSDF recommends integrating secure software practices into the software
  development life cycle. Phase 8R.17 applies that by keeping removal scoped,
  explicit, validated, and separately reviewable before destructive changes.
- OWASP API9:2023 Improper Inventory Management highlights risk from stale or
  deprecated application surfaces and emphasizes updated inventories. Phase
  8R.17 only selects paths from the current approved manifest.
- NIST SP 800-34 Rev. 1 provides contingency planning and recovery guidance.
  Phase 8R.17 relies on the backup/restore and recovery evidence required by
  earlier deletion gates before it can prepare a review batch.

Sources:

- Git `status` documentation:
  <https://git-scm.com/docs/git-status>
- NIST Secure Software Development Framework:
  <https://csrc.nist.gov/projects/ssdf>
- OWASP API9:2023 Improper Inventory Management:
  <https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/>
- NIST SP 800-34 Rev. 1:
  <https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final>

## Recommendations

### Keep 8R.17 As A Removal Batch Contract

The service should not delete files directly while candidate paths still have
live imports. It should build a reviewed batch that a later apply step can use.

Pros:

- prevents accidental removal of live code,
- gives the next task an exact scope,
- keeps destructive work separately reviewable.

Cons:

- requires another step before compatibility code actually disappears.

### Require Approved Manifest Paths

Only paths already listed in the Phase 8R.15 manifest may enter a removal batch.

Pros:

- prevents ad hoc deletion,
- ties removal to replacement evidence,
- preserves the compatibility inventory.

Cons:

- newly discovered paths must be added through the manifest first.

### Keep The Batch Narrow

The first removal batch should be small enough to review manually. The service
defaults to three paths per batch and blocks broader selections.

Pros:

- reduces blast radius,
- makes test failures easier to isolate,
- supports incremental removal of still-live compatibility paths.

Cons:

- full cleanup requires multiple batches.

## Final Recommendation Stack

Use this stack for Phase 8R.17:

1. Use Phase 8R.15 execution plan as the source of approved manifest entries.
2. Use Phase 8R.16 execution gate as the final preflight proof.
3. Select a small batch of manifest paths with a review reason and reviewer.
4. Produce a side-effect-free removal batch for the later apply step.

## Implementation Outcome

Implemented:

- Added `policyBuilderPhase8ControlledCompatibilityPathRemoval.mjs`.
- Added status IDs for:
  - ready for removal review,
  - blocked by execution plan,
  - blocked by execution gate,
  - blocked by selection,
  - blocked by scope,
  - blocked by approval.
- Added risk IDs for non-ready execution plans, non-ready execution gates,
  empty selections, unknown paths, too-broad batches, missing review metadata,
  stale risk counts, and forbidden side effects.
- Added focused tests for ready removal review output, execution-plan blocker,
  execution-gate blocker, empty/unknown selections, batch-size blocker, missing
  review metadata, and side-effect validation.

Not implemented in this component:

- no file deletion,
- no route removal,
- no test removal,
- no Git command execution,
- no manifest write,
- no storage mutation.

## Next Step

Proceed with **Phase 8R.18 Controlled Compatibility Path Removal Apply**. That
task should consume a ready Phase 8R.17 batch, remove or replace only that
reviewed scope, update affected imports/tests, and prove the platform still
passes focused and full validation.
