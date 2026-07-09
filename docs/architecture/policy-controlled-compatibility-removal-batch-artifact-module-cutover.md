# Policy Controlled Compatibility Removal Batch Artifact Module Cutover

## Intent

This cutover removes temporary phase-coded naming from the controlled removal
batch artifact while preserving the existing reviewed-batch behavior.

The renamed module remains a read-only artifact generator. It accepts an
approved compatibility deletion execution plan and explicit gate/review
evidence, then emits the nested removal batch consumed by controlled apply
tooling.

## Official-Source Research

- Git worktree documentation distinguishes clean worktrees from changed or
  untracked worktrees. The artifact continues to consume explicit clean-worktree
  evidence rather than performing hidden Git checks.
- NIST SSDF supports risk-based secure development practices with traceable
  evidence. Durable product-domain names keep the artifact understandable after
  roadmap phases are complete.
- OWASP API9:2023 Improper Inventory Management warns that unmanaged surfaces
  expand attack surface. The artifact keeps selected paths tied to an approved
  compatibility inventory.
- Node.js ESM `node:fs` APIs remain the supported local tooling surface. The
  generator stays a bounded command, so synchronous JSON reads and writes are
  acceptable.

Sources:

- Git worktree documentation:
  <https://git-scm.com/docs/git-worktree>
- NIST Secure Software Development Framework:
  <https://csrc.nist.gov/projects/ssdf>
- OWASP API9:2023 Improper Inventory Management:
  <https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/>
- Node.js file system API:
  <https://nodejs.org/api/fs.html>

## Recommendations

### Rename The Public Contract

Use `policyControlledCompatibilityRemovalBatchArtifact` for the service,
focused tests, builder export, validator export, and package-script runner.

Pros:

- aligns the artifact with controlled compatibility removal instead of roadmap
  chronology,
- keeps imports discoverable by product intent,
- avoids phase labels in production/evidence contracts.

Cons:

- requires coordinated reference updates across validation, docs, tests, and
  runners.

### Keep Behavior Stable

The cutover should not change execution-plan gating, execution-gate gating,
selected-path validation, blocked-batch diagnostics, side-effect rejection, or
artifact writing behavior.

Pros:

- keeps review focused on contract naming,
- preserves existing removal safety,
- avoids changing storage-closure semantics during a naming cutover.

Cons:

- deeper batch-size or path-selection improvements remain separate future work.

### Preserve Read-Only Execution

The generator should continue to emit JSON only. It should not delete files,
archive files, mutate storage, write manifests, remove routes/tests, or run Git.

Pros:

- keeps artifact generation safe in local and CI runs,
- supports repeatable verification,
- keeps destructive compatibility removal in explicit controlled-apply steps.

Cons:

- operators still need the controlled-apply flow to apply approved manifest
  changes.

## Final Recommendation Stack

1. Rename the controlled removal batch service, test, script, runner, payload
   version, builder export, and validator export to controlled compatibility
   removal terminology.
2. Update closure requirement and validation evidence maps to require the new
   paths.
3. Update roadmap, design records, handoff docs, and changelog references.
4. Preserve the existing read-only artifact behavior and focused tests.
5. Validate both direct command help and package runner help.

## Implementation Outcome

Implemented:

- `policyControlledCompatibilityRemovalBatchArtifact.mjs`
- `policyControlledCompatibilityRemovalBatchArtifact.test.mjs`
- `generate-policy-controlled-compatibility-removal-batch-artifact.mjs`
- `policy:controlled-compatibility-removal-batch`
- `policy.controlled_compatibility_removal_batch_artifact.v1`
- validation-evidence markdown coverage for this cutover record

The cutover keeps reviewed-batch generation product-domain named and leaves the
remaining policy builder migration verifier names as the next stale phase-coded
surface to audit.

## Next Step

Proceed with a stale phase-coded verifier audit for the impact and replay
migration verifier services.
