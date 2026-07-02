# Policy Builder Phase 8R Controlled Removal Apply Artifact Exporter

## Intent

Phase 8R.28 generates a machine-readable Phase 8R.18 controlled removal apply
artifact from:

- a ready Phase 8R.17 removal-batch JSON,
- explicit apply input evidence,
- operator confirmation with an actor,
- an injected apply adapter.

This component is the first Phase 8R artifact exporter that can remove files,
but only when the caller explicitly passes `--apply-files`. It does not decide
what belongs in the batch, archive paths, mutate storage, or run Git commands.

## Official-Source Research

- Git `status` documents worktree, index, and untracked state as separate
  surfaces. Apply tooling should consume clean-worktree evidence from earlier
  gates and leave Git state changes to the operator.
- NIST SSDF recommends integrating secure development practices into the SDLC.
  This component keeps destructive removal explicit, reviewed, and bounded to a
  small previously approved batch.
- OWASP API9:2023 Improper Inventory Management warns that unmanaged stale
  surfaces expand attack surface. This component removes only inventory-backed
  compatibility paths from the approved batch.
- Node.js file-system APIs provide stable ESM-compatible local filesystem
  operations. The CLI uses bounded `node:fs` deletion only for repo-relative
  files in short-lived local tooling.

Sources:

- Git `status` documentation:
  <https://git-scm.com/docs/git-status>
- NIST Secure Software Development Framework:
  <https://csrc.nist.gov/projects/ssdf>
- OWASP API9:2023 Improper Inventory Management:
  <https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/>
- Node.js file system API:
  <https://nodejs.org/api/fs.html>

## Recommendations

### Require Reviewed Batch Evidence

The apply exporter should refuse to run from raw path lists. It should consume a
ready Phase 8R.17 removal batch so path selection, manifest membership, review
reason, and reviewer metadata remain upstream concerns.

Pros:

- prevents ad hoc deletion,
- preserves review metadata,
- keeps apply evidence tied to the exact selected batch.

Cons:

- operators must preserve the removal-batch artifact between steps.

### Require Explicit Apply Confirmation

Apply input should include `executeApply: true` and
`operatorConfirmation.confirmed: true` with `confirmedBy`.

Pros:

- separates preview/export from destructive execution,
- makes the actor visible in audit output,
- prevents accidental deletion from default command invocation.

Cons:

- local apply runs require one more JSON input file.

### Keep Filesystem Mutation Adapter-Bound

The service should not perform file I/O directly. The CLI should provide a
bounded adapter that deletes only repo-relative files when `--apply-files` is
present.

Pros:

- keeps the reusable service deterministic and testable,
- supports future adapters without changing the apply contract,
- prevents traversal outside the repository.

Cons:

- replacement-style code-path removals need a later adapter instead of being
  silently treated as file deletion.

## Final Recommendation Stack

Use this stack for Phase 8R controlled removal apply:

1. Require a ready Phase 8R.17 removal-batch JSON file.
2. Require explicit apply input JSON with `executeApply: true`,
   `operatorConfirmation.confirmed: true`, and `confirmedBy`.
3. Run the existing Phase 8R.18 apply contract through an injected adapter.
4. Let the CLI adapter delete only repo-relative file paths when
   `--apply-files` is present.
5. Reject archive, storage, and Git-command side effects.
6. Write the nested apply-result JSON for Phase 8R.19 runtime verification.
7. Optionally write a wrapper artifact for audit trails.

## Implementation Outcome

Implemented:

- Added `policyBuilderPhase8ControlledRemovalApplyArtifact.mjs`.
- Added `generate-policy-builder-phase-8r-removal-apply.mjs`.
- Added root npm script `policy:phase8r:removal-apply`.
- Added focused tests for:
  - successful apply artifact generation through an injected adapter,
  - blocked apply when explicit execution is missing,
  - forbidden side-effect rejection,
  - artifact validation invariants.
- Added the controlled-removal apply artifact suite and this design doc to the
  fixed Phase 8R validation evidence command set.

Example:

```bash
npm run --silent policy:phase8r:removal-apply -- \
  --removal-batch .tmp/phase8r/removal-batch.json \
  --input .tmp/phase8r/removal-apply-input.json \
  --output .tmp/phase8r/removal-apply.json \
  --artifact-output .tmp/phase8r/removal-apply-artifact.json \
  --apply-files
```

## Next Step

Use the generated Phase 8R.18 apply-result JSON as the input for Phase 8R.19
post-removal runtime verification. That verifier should prove removed paths are
not imported, focused runtime checks pass, and no additional removal batch is
authorized until validation succeeds.
