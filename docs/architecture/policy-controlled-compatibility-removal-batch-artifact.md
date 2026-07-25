# Policy Controlled Compatibility Removal Batch Artifact

## Intent

The controlled compatibility removal batch artifact creates a machine-readable,
reviewable batch from a ready, fingerprinted compatibility deletion
execution-plan artifact, a revalidated collector artifact, a separately bound
database-owned recovery artifact, operator approval/stance evidence, selected
approved manifest paths, and reviewer metadata.

This component prepares a bounded batch for a later apply step. It does not
delete files, archive files, remove routes, remove tests, mutate storage, write
manifests, or run Git commands.

## Official-Source Research

- Git worktree documentation distinguishes clean worktrees from worktrees with
  untracked or modified files. The artifact consumes explicit clean-worktree
  evidence instead of running Git or assuming the checkout is safe.
- NIST SSDF recommends integrating risk-based secure development practices into
  the SDLC. The artifact keeps destructive compatibility removal scoped,
  reviewed, and separately gated before apply.
- OWASP API9:2023 Improper Inventory Management warns that unmanaged or stale
  surfaces expand attack surface. The artifact only selects paths from the
  approved manifest so cleanup stays tied to inventory.
- Node.js file-system APIs support ESM and local tooling reads/writes. The
  generator uses bounded synchronous JSON I/O because it is a short-lived local
  evidence command, not request-path runtime code.
- SLSA verification guidance recommends evaluating an artifact against its
  expected inputs and rejecting unexpected external parameters. The public
  exporter therefore proves that preflight evidence bound to another
  execution-plan artifact cannot produce a review batch.
- NIST SSDF recommends integrating secure development practices with the SDLC.
  The public-command test reaches controlled-apply confirmation checks with a
  valid reviewed batch while preserving the separate, explicit apply decision.

Sources:

- Git worktree documentation:
  <https://git-scm.com/docs/git-worktree>
- NIST Secure Software Development Framework:
  <https://csrc.nist.gov/projects/ssdf>
- OWASP API9:2023 Improper Inventory Management:
  <https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/>
- Node.js file system API:
  <https://nodejs.org/api/fs.html>
- SLSA artifact verification:
  <https://slsa.dev/spec/v1.2/verifying-artifacts>
- NIST SP 800-218:
  <https://csrc.nist.gov/pubs/sp/800/218/final>

## Recommendations

### Consume A Bound Execution Plan, Collector Artifact, Recovery Artifact, And Operator Evidence

The generator should require the generated v2 compatibility deletion
execution-plan artifact, a fingerprint-valid collector artifact bound to its
exact fingerprint, a database-owned recovery artifact, and separately
timestamped operator approval/stance evidence before
producing a review batch. It must not translate caller-supplied readiness,
worktree, or manifest booleans into trusted gate evidence.

Pros:

- prevents ad hoc path removal,
- prevents stale, altered, duplicate, or detached collector evidence from
  being accepted,
- preserves the separation between machine observations, database recovery,
  and human approval evidence,
- keeps operator approval close to the removal batch.

Cons:

- operators or CI must preserve the execution-plan artifact, collector
  artifact, and operator evidence together.

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

The generator should write the nested controlled compatibility removal batch
JSON and optionally write a wrapper artifact, but should not execute removal.

Pros:

- keeps destructive apply separate,
- gives reviewers a small batch to inspect,
- supports one-path or small-batch removal loops.

Cons:

- cleanup still requires controlled apply and post-removal verification.

### Expose Durable Product-Domain Names

The service, script, version, runner, and tests should use controlled
compatibility removal batch terminology instead of roadmap phase terminology.

Pros:

- keeps production and CI contracts meaningful after roadmap phases are retired,
- makes the artifact discoverable from its product purpose,
- reduces future naming debt.

Cons:

- requires coordinated updates across validation, requirement audit, roadmap,
  docs, and package scripts.

### Verify The Public Exporter And Review-Consumer Chain

The public Node command should be tested with the JSON files that an operator
or CI job supplies. A ready invocation must preserve the approved review
artifact and execution context in the nested removal batch. The controlled
apply layer must accept that review through its integrity checks, but stop at
the separate confirmation step without invoking an apply adapter.

Blocked input must write neither output by default. A mismatched preflight
fingerprint is blocked, and a bounded blocked diagnostic may be written only
when `--allow-blocked` is explicitly supplied.

Pros:

- proves the CLI preserves artifact, gate, and reviewer bindings into the
  downstream consumer,
- prevents a detached preflight record from authorizing a removal review,
- proves the test does not apply or delete a compatibility path.

Cons:

- process-level checks are slower than direct service tests,
- fixture input must evolve with the reviewed-batch contract.

## Final Recommendation Stack

Use this stack for controlled compatibility removal batch generation:

1. Require a ready, fingerprint-valid compatibility deletion execution-plan
   artifact JSON file.
2. Require a fingerprint-valid `preflightEvidenceArtifact` that binds only
   checkout, manifest, and runtime-reference observations to that artifact.
3. Require fingerprint-valid `recoveryEvidence` that binds the existing
   database-owned backup/restore verification to that artifact.
4. Require separately timestamped `operatorEvidence` that contains only
   operator approval and final rollback/support stances.
5. Build the compatibility deletion execution gate through
   `policyCompatibilityDeletionExecutionGate.mjs`.
6. Build the reviewed removal batch through
   `policyControlledCompatibilityPathRemoval.mjs`.
7. Refuse ready output unless both gate and batch validate.
8. Write the nested removal-batch JSON for controlled apply tooling.
9. Optionally write the wrapper artifact for audit trails.
10. Verify the public exporter preserves review integrity and refuses blocked
   output unless diagnostic export is explicitly enabled.
11. Expose durable controlled compatibility removal batch service, script,
   runner, version, test, and documentation names.

## Implementation Outcome

Implemented:

- Renamed the service to
  `server/src/services/policyControlledCompatibilityRemovalBatchArtifact.mjs`.
- Renamed the generator to
  `scripts/generate-policy-controlled-compatibility-removal-batch-artifact.mjs`.
- Renamed the focused test suite to
  `server/src/__tests__/services/policyControlledCompatibilityRemovalBatchArtifact.test.mjs`.
- Added the root runner `npm run policy:controlled-compatibility-removal-batch`.
- Replaced the phase-coded payload version with
  `policy.controlled_compatibility_removal_batch_artifact.v3`, which requires a
  fingerprint-valid execution-plan artifact, revalidated collector artifact,
  database-owned recovery artifact, and separately bound operator evidence.
- Updated storage-closure validation and requirement-audit evidence references
  to require the durable controlled compatibility removal batch contract.
- Preserved execution-plan gating, execution-gate gating, manifest-bound path
  selection, blocked-batch diagnostics, side-effect rejection, nested batch
  output, and optional wrapper-artifact output.
- Added a process-level generator suite at
  `server/src/__tests__/scripts/generatePolicyControlledCompatibilityRemovalBatchArtifact.test.mjs`.
  It proves the public command preserves the review artifact and execution
  context into controlled-apply confirmation checks, writes no output for a
  cross-plan collector artifact by default, and writes a bounded blocked
  diagnostic only with `--allow-blocked`.

Example:

```bash
npm run --silent policy:controlled-compatibility-removal-batch -- \
  --execution-plan-artifact .tmp/policy-storage/execution-plan-artifact.json \
  --input .tmp/policy-storage/removal-batch-input.json \
  --output .tmp/policy-storage/removal-batch.json \
  --artifact-output .tmp/policy-storage/removal-batch-artifact.json
```

## Next Step

Proceed with a stale phase-coded verifier audit for the remaining policy builder
impact and replay migration verifier services.
