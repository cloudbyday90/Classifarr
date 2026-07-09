# Policy Builder Phase 8R Controlled Removal Batch Artifact Exporter

## Intent

Phase 8R.27 generates a machine-readable Phase 8R.17 controlled removal batch
artifact from:

- a ready Phase 8R.15 execution-plan JSON,
- explicit Phase 8R.16 execution-gate evidence,
- a narrow list of selected manifest paths,
- review reason and reviewer metadata.

This component creates the reviewable batch for a later apply step. It does not
delete files, archive files, remove routes, remove tests, mutate storage, write
manifests, or run Git commands.

## Official-Source Research

- Git `status` documents that worktree, index, and untracked state must be
  inspected before committing changes. This component consumes explicit
  clean-worktree evidence instead of running Git or assuming the checkout is
  safe.
- NIST SSDF recommends integrating secure development practices into the SDLC.
  This component keeps destructive compatibility removal scoped, reviewed, and
  separately gated before apply.
- OWASP API9:2023 Improper Inventory Management warns that stale or unmanaged
  surfaces expand attack surface. This component only selects paths from the
  approved manifest so cleanup stays tied to the inventory.
- Node.js file-system APIs support ESM and local tooling reads/writes. The
  exporter uses bounded synchronous JSON I/O because it is a short-lived local
  evidence generator, not request-path runtime code.

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

### Consume Execution-Plan And Gate Evidence

The exporter should require the generated Phase 8R.15 execution plan and
explicit Phase 8R.16 gate evidence before producing a review batch.

Pros:

- prevents ad hoc path removal,
- preserves clean-worktree and recovery evidence boundaries,
- keeps operator approval close to the removal batch.

Cons:

- operators or CI must preserve the execution-plan and gate-input artifacts.

### Select Only Approved Manifest Paths

Selected paths must exist in the execution-plan manifest and each selected entry
must already have replacement evidence.

Pros:

- prevents out-of-band deletion,
- keeps replacement evidence attached to every selected path,
- makes unknown selections fail before apply.

Cons:

- newly discovered compatibility paths must be added to the manifest first.

### Keep Batch Output Reviewable

The exporter should write the nested Phase 8R.17 batch JSON and optionally write
a wrapper artifact, but should not execute removal.

Pros:

- keeps destructive apply separate,
- gives reviewers a small batch to inspect,
- supports one-path or small-batch removal loops.

Cons:

- cleanup still requires Phase 8R.18 apply and Phase 8R.19 verification.

## Final Recommendation Stack

Use this stack for Phase 8R controlled removal batch generation:

1. Require a ready Phase 8R.15 execution-plan JSON file.
2. Require explicit input evidence for worktree, backup/restore freshness,
   operator approval, final rollback/support stance, manifest freshness, and
   selected paths.
3. Build the Phase 8R.16 execution gate through
   `policyCompatibilityDeletionExecutionGate.mjs`.
4. Build the Phase 8R.17 removal batch through
   `policyControlledCompatibilityPathRemoval.mjs`.
5. Refuse ready output unless both gate and batch validate.
6. Write the nested removal-batch JSON for Phase 8R.18 apply tooling.
7. Optionally write the wrapper artifact for audit trails.

## Implementation Outcome

Implemented:

- Added `policyBuilderPhase8ControlledRemovalBatchArtifact.mjs`.
- Added `generate-policy-builder-phase-8r-removal-batch.mjs`.
- Added root npm script `policy:phase8r:removal-batch`.
- Added focused tests for:
  - ready removal batch artifact generation,
  - blocked execution-gate evidence,
  - blocked out-of-manifest selections,
  - side-effect rejection,
  - artifact validation invariants.
- Added the controlled-removal batch artifact suite and this design doc to the
  fixed Phase 8R validation evidence command set.

Example:

```bash
npm run --silent policy:phase8r:removal-batch -- \
  --execution-plan .tmp/phase8r/execution-plan.json \
  --input .tmp/phase8r/removal-batch-input.json \
  --output .tmp/phase8r/removal-batch.json \
  --artifact-output .tmp/phase8r/removal-batch-artifact.json
```

## Next Step

Use the generated Phase 8R.17 removal-batch JSON as the input for a separate
Phase 8R.18 apply artifact. The apply step should be the first component that
can remove or replace files, and it must remain bounded to the reviewed batch.
