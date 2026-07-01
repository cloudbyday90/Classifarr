# Policy Builder Phase 8R Compatibility Removal Completion Audit

## Intent

Phase 8R.21 proves whether the approved compatibility removal inventory is
actually complete. It is a side-effect-free completion verifier: it does not
delete files, archive code, mutate storage, write manifests, run tests, run Git
commands, or execute source searches.

The component consumes bounded evidence:

- Phase 8R.20 completion authorization,
- the approved Phase 8R.15 compatibility deletion manifest,
- verified Phase 8R.19 removal evidence,
- final import/reference scan evidence,
- focused and full validation evidence.

If approved manifest paths remain, the audit reports bounded remaining
inventory instead of claiming completion. If completion evidence is stale or
incomplete, the audit blocks with explicit risk IDs.

## Official-Source Research

- Git `grep` documents bounded searches across tracked files, the index, or
  tree objects. Phase 8R.21 consumes final source-search evidence, but it does
  not execute searches itself.
- Git pathspecs define exact path matching for scoped Git operations. Phase
  8R.21 keeps completion evidence tied to exact approved manifest paths rather
  than broad selectors.
- NIST SP 800-128 frames configuration management around controlled change and
  monitoring for system integrity. Phase 8R.21 applies that by verifying the
  end state after controlled removals before the phase exits compatibility
  removal mode.
- NIST SSDF recommends secure development practices through the software
  lifecycle. Phase 8R.21 preserves auditable evidence that old compatibility
  code is removed only after validation and reference checks pass.
- OWASP API9:2023 Improper Inventory Management highlights stale, undocumented,
  or deprecated surfaces as risk. Phase 8R.21 treats legacy compatibility paths
  as inventory that must be proven gone or explicitly reported as remaining.

Sources:

- Git `grep` documentation:
  <https://git-scm.com/docs/git-grep>
- Git glossary pathspec documentation:
  <https://git-scm.com/docs/gitglossary>
- NIST SP 800-128:
  <https://csrc.nist.gov/pubs/sp/800/128/upd1/final>
- NIST Secure Software Development Framework:
  <https://csrc.nist.gov/pubs/sp/800/218/final>
- OWASP API9:2023 Improper Inventory Management:
  <https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/>

## Recommendations

### Treat Completion As A Proof, Not A Search Miss

Do not claim compatibility removal is complete just because no obvious work is
visible. Require affirmative evidence: completed 8R.20 authorization, manifest
coverage, verified removals, final scan evidence, and validation results.

Pros:

- prevents false completion claims,
- keeps the audit tied to explicit manifest inventory,
- makes missing evidence actionable.

Cons:

- requires callers to preserve removal-loop evidence.

### Separate Remaining Inventory From Failure

If approved manifest paths remain, report `remaining_inventory` instead of
collapsing it into a generic failure.

Pros:

- tells operators to continue the 8R.17 through 8R.20 loop,
- avoids treating expected incremental work as corruption,
- keeps completion and continuation distinct.

Cons:

- introduces another non-complete status to handle.

### Require Final Reference Evidence

Even when all paths are marked removed, require a final import/reference scan
covering every approved manifest path with no remaining references.

Pros:

- catches lingering imports after the last batch,
- protects runtime paths from stale compatibility references,
- aligns inventory closure with actual code reachability.

Cons:

- callers must provide current scan evidence.

### Require Focused And Full Validation

Focused checks prove the affected Phase 8R surfaces. Full validation proves
broader platform behavior after the removal loop.

Pros:

- reduces confidence from narrow tests alone,
- catches regressions outside the deleted files,
- creates release-ready completion evidence.

Cons:

- full validation is slower.

## Final Recommendation Stack

Use this stack for Phase 8R.21:

1. Require valid Phase 8R.20 `complete_no_remaining_paths` evidence.
2. Require a valid Phase 8R.15 execution plan with approved manifest entries.
3. Require at least one verified Phase 8R.19 removal verification.
4. Prove every approved manifest path is covered by verified removal evidence.
5. Require final import/reference scan evidence for every manifest path.
6. Block if the final scan reports any remaining reference.
7. Require focused and full validation evidence to pass.
8. Reject file, route, test, storage, manifest, archive, or Git side effects
   inside the audit.

## Implementation Outcome

Implemented:

- Added `policyBuilderPhase8CompatibilityRemovalCompletionAudit.mjs`.
- Added status IDs for:
  - complete,
  - remaining inventory,
  - blocked by authorization evidence,
  - blocked by execution plan,
  - blocked by removal evidence,
  - blocked by final scan,
  - blocked by validation.
- Added risk IDs for incomplete authorization, invalid authorization, invalid
  execution plans, empty manifests, missing or invalid removal verification,
  incomplete path coverage, missing final scan evidence, lingering references,
  missing or failed focused/full validation, side effects, stale risk counts,
  and unknown statuses.
- Added focused tests for complete output, remaining inventory, invalid
  authorization, invalid execution plan, missing/invalid/incomplete removal
  evidence, missing or referenced final scans, validation failures, and mutated
  output validation.

Not implemented in this component:

- no source-search execution,
- no test execution,
- no Git command execution,
- no file deletion,
- no archive writes,
- no manifest writes,
- no storage mutation.

## Next Step

Proceed with **Phase 8R.22 Phase Completion Checkpoint**. That task should
audit the Phase 8R roadmap, service contracts, tests, docs, and changelog
coverage before deciding whether Phase 8R is fully implemented or whether a
remaining component still needs work.
