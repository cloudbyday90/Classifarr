# Policy Builder Phase 8R Next Compatibility Removal Batch Authorization Artifact Exporter

## Intent

Phase 8R.30 generates a machine-readable Phase 8R.20 next compatibility removal
batch authorization artifact from:

- verified Phase 8R.19 post-removal runtime verification JSON,
- a ready Phase 8R.15 execution-plan JSON with approved manifest entries,
- requested remaining manifest paths,
- authorizing operator and reason.

This component does not delete files, write manifests, mutate storage, run tests,
run source scans, or run Git commands. It authorizes only the next bounded batch
or records that no approved manifest paths remain.

## Official-Source Research

- Git `grep` documents bounded source searching across tracked files, index, or
  tree objects. Phase 8R.30 consumes verification evidence from the prior stage
  instead of running a fresh scan implicitly.
- Git glossary pathspec documentation defines exact path and constrained path
  selection concepts. The exporter authorizes only exact approved manifest
  paths instead of free-form deletion selectors.
- NIST SP 800-128 frames configuration management as controlled change with
  integrity monitoring. The exporter keeps compatibility cleanup iterative:
  verify the previous removal, calculate remaining inventory, and authorize one
  small next change.
- OWASP API9:2023 Improper Inventory Management treats stale or unmanaged
  surfaces as a security risk. This exporter keeps cleanup tied to the approved
  compatibility inventory and blocks unknown or already removed paths.

Sources:

- Git `grep` documentation:
  <https://git-scm.com/docs/git-grep>
- Git glossary pathspec documentation:
  <https://git-scm.com/docs/gitglossary>
- NIST SP 800-128:
  <https://csrc.nist.gov/pubs/sp/800/128/upd1/final>
- OWASP API9:2023 Improper Inventory Management:
  <https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/>

## Recommendations

### Consume Verified 8R.19 Evidence

The exporter should require verified post-removal runtime evidence before
authorizing another batch.

Pros:

- prevents compounding a broken removal,
- keeps each batch gated by concrete runtime and reference evidence,
- makes failed verification visible before new authorization.

Cons:

- next-batch authorization cannot run until verification JSON is available.

### Authorize Only Remaining Manifest Paths

The exporter should compute remaining inventory from the original approved
manifest minus verified applied paths, then reject unknown or already removed
paths.

Pros:

- prevents out-of-manifest deletion,
- prevents duplicate removal attempts,
- keeps cleanup tied to approved compatibility inventory.

Cons:

- the execution-plan artifact must remain available until cleanup completes.

### Emit Either Next Batch Or Completion State

If remaining paths exist, require a small requested batch and authorization
metadata. If no paths remain, emit completion evidence instead of forcing an
empty batch.

Pros:

- supports iterative removal loops,
- makes completion explicit,
- keeps final audit input machine-readable.

Cons:

- operators must distinguish next-batch authorization from completion
  authorization.

## Final Recommendation Stack

Use this stack for Phase 8R next-batch authorization:

1. Require Phase 8R.19 verification JSON with `verified=true` and valid output.
2. Require Phase 8R.15 execution-plan JSON with ready approved manifest entries.
3. Compute remaining manifest inventory from verified applied paths.
4. Block unknown, already removed, empty, or overly broad requested batches.
5. Require `authorizationReason` and `authorizedBy` while remaining paths exist.
6. Emit ready next-batch authorization or complete-no-remaining-paths evidence.
7. Reject file deletion, archive, route/test removal, storage mutation, manifest
   writes, and Git side effects.

## Implementation Outcome

Implemented:

- Added
  `policyBuilderPhase8NextCompatibilityRemovalBatchAuthorizationArtifact.mjs`.
- Added `generate-policy-builder-phase-8r-next-batch-authorization.mjs`.
- Added root npm script `policy:phase8r:next-batch-authorization`.
- Added focused tests for:
  - ready next-batch authorization artifact generation,
  - complete-no-remaining-paths artifact generation,
  - blocked invalid requested paths,
  - forbidden side-effect rejection,
  - artifact validation invariants.
- Added the next-batch authorization artifact suite and this design doc to the
  fixed Phase 8R validation evidence command set.

Example:

```bash
npm run --silent policy:phase8r:next-batch-authorization -- \
  --post-removal-verification .tmp/phase8r/post-removal-verification.json \
  --execution-plan .tmp/phase8r/execution-plan.json \
  --input .tmp/phase8r/next-batch-authorization-input.json \
  --output .tmp/phase8r/next-batch-authorization.json \
  --artifact-output .tmp/phase8r/next-batch-authorization-artifact.json
```

## Next Step

Use the generated Phase 8R.20 authorization JSON as input for Phase 8R.31
completion-audit artifact export. That exporter should produce the Phase 8R.21
audit JSON from authorization, manifest, remaining path, reference scan, and
validation evidence.
