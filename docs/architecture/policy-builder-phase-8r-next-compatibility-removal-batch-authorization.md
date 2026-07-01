# Policy Builder Phase 8R Next Compatibility Removal Batch Authorization

## Intent

Phase 8R.20 authorizes only the next narrow compatibility removal batch after a
verified Phase 8R.19 post-removal runtime check. It does not delete files,
archive code, mutate storage, write manifests, run tests, or run Git commands.

The component consumes bounded evidence:

- verified Phase 8R.19 post-removal runtime verification,
- the approved Phase 8R.15 compatibility deletion manifest,
- operator-selected remaining manifest paths,
- the authorizing operator and reason.

The output calculates remaining approved manifest paths, prevents already
removed paths from re-entering a removal batch, and emits a ready batch for the
existing controlled removal flow.

## Official-Source Research

- Git `grep` documents bounded source searches across tracked files, the index,
  or tree objects. Phase 8R.20 does not run source searches directly, but it
  relies on Phase 8R.19 evidence that can be produced by bounded source-search
  commands before the next batch is authorized.
- Git pathspecs define how exact paths and constrained path patterns are
  interpreted. Phase 8R.20 applies that principle by authorizing only exact
  approved manifest paths instead of free-form deletion selectors.
- NIST SP 800-128 frames configuration management as controlled change with
  system integrity monitoring. Phase 8R.20 keeps compatibility removal
  iterative: verify the previous change, calculate remaining inventory, then
  authorize the next small change.
- NIST SSDF recommends secure development practices throughout the SDLC. Phase
  8R.20 makes the deletion pipeline evidence-driven and reviewable before any
  destructive operation can continue.
- OWASP API9:2023 Improper Inventory Management highlights stale, deprecated,
  or undocumented surfaces as a security risk. Phase 8R.20 treats compatibility
  paths as inventory: already removed paths cannot be selected again, and
  unknown paths cannot enter the removal flow.

Sources:

- Git `grep` documentation:
  <https://git-scm.com/docs/git-grep>
- Git glossary pathspec documentation:
  <https://git-scm.com/docs/gitglossary>
- NIST SP 800-128:
  <https://csrc.nist.gov/pubs/sp/800/128/upd1/final>
- NIST Secure Software Development Framework:
  <https://csrc.nist.gov/projects/ssdf>
- OWASP API9:2023 Improper Inventory Management:
  <https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/>

## Recommendations

### Require Verified Post-Removal Evidence

Do not authorize another batch unless Phase 8R.19 verified the previous apply,
runtime checks, import/reference scans, and focused/full validation evidence.

Pros:

- prevents compounding broken removals,
- keeps the batch loop gated by actual verification,
- makes incomplete validation visible before the next batch.

Cons:

- requires callers to pass current verification evidence.

### Authorize From Remaining Manifest Inventory

Calculate remaining paths from the original approved manifest minus verified
applied paths. Treat anything outside that remaining set as blocked.

Pros:

- blocks unknown deletion selectors,
- prevents already removed paths from re-entering a batch,
- keeps scope tied to the approved inventory.

Cons:

- requires the original execution manifest to remain available until removal is
  complete.

### Keep Batch Size Small

Authorize only a bounded number of remaining paths at a time.

Pros:

- limits blast radius,
- preserves review clarity,
- makes post-removal verification easier to interpret.

Cons:

- larger removals take multiple loops through 8R.17 through 8R.20.

### Require Operator Context

When remaining paths exist, require the authorizing operator and reason.

Pros:

- creates accountable removal evidence,
- helps explain why the next batch is safe,
- avoids silent continuation after verification.

Cons:

- adds a small amount of required metadata.

## Final Recommendation Stack

Use this stack for Phase 8R.20:

1. Require Phase 8R.19 `statusId=verified`, `verified=true`, and valid output.
2. Require a valid Phase 8R.15 execution plan with approved manifest entries.
3. Compute remaining manifest paths from `manifest.entries - appliedPaths`.
4. Block empty requested batches while remaining paths exist.
5. Block requested paths that are unknown, already removed, or outside the
   remaining manifest.
6. Block batches wider than the configured maximum batch size.
7. Require `authorizationReason` and `authorizedBy` while remaining paths exist.
8. Emit a side-effect-free authorization payload for the next controlled batch.

## Implementation Outcome

Implemented:

- Added `policyBuilderPhase8NextCompatibilityRemovalBatchAuthorization.mjs`.
- Added status IDs for:
  - ready for next batch,
  - complete with no remaining paths,
  - blocked by post-removal verification,
  - blocked by execution plan,
  - blocked by selection,
  - blocked by scope,
  - blocked by authorization.
- Added risk IDs for stale post-removal verification, invalid execution plans,
  missing manifest entries, empty selections, unknown paths, already removed
  paths, overly broad batches, missing authorization metadata, side effects,
  stale risk counts, and unknown statuses.
- Added focused tests for the ready path, stale verification, invalid execution
  plan, unknown or already removed paths, empty and broad batches, missing
  authorization context, no remaining paths, and mutated output validation.

Not implemented in this component:

- no file deletion,
- no archive creation,
- no manifest writes,
- no storage mutation,
- no Git command execution,
- no test execution.

## Next Step

Proceed with **Phase 8R.21 Compatibility Removal Completion Audit**. That task
should consume verified removal loop evidence and prove whether all approved
compatibility manifest paths are gone or whether a bounded remaining inventory
still needs another 8R.17 through 8R.20 loop.
