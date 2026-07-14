# Policy Next Compatibility Removal Batch Authorization Artifact Exporter

## Intent

The next-batch authorization artifact exporter generates a machine-readable
policy next compatibility removal batch authorization artifact from:

- a fingerprint-valid post-removal runtime evidence artifact,
- a ready compatibility deletion execution-plan JSON with approved manifest
  entries,
- requested remaining manifest paths,
- authorizing operator and reason.

This component does not delete files, write manifests, mutate storage, run tests,
run source scans, or run Git commands. It authorizes only the next bounded batch
or records that no approved manifest paths remain.

## Official-Source Research

- NIST SP 800-128 frames configuration management as controlled change with
  integrity monitoring. The exporter keeps compatibility cleanup iterative:
  verify the previous removal, calculate remaining inventory, and authorize one
  small next change.
- NIST SSDF recommends evidence-producing secure development practices. The
  exporter keeps deletion authorization reviewable and machine-readable without
  executing the deletion itself.
- OWASP Logging guidance calls for event records with enough context to support
  operational and security review. The artifact records authorizer, reason,
  selected paths, remaining inventory, risk status, and side-effect summary.
- Git `mv` documents explicit tracked renames. The exporter cutover keeps the
  CLI and module names aligned with durable policy-domain behavior.
- OWASP API9:2023 Improper Inventory Management treats stale or unmanaged
  surfaces as a security risk. This exporter keeps cleanup tied to the approved
  compatibility inventory and blocks unknown or already removed paths.

Sources:

- NIST SP 800-128:
  <https://csrc.nist.gov/pubs/sp/800/128/upd1/final>
- NIST Secure Software Development Framework:
  <https://csrc.nist.gov/projects/ssdf>
- OWASP Logging Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>
- Git `mv` documentation:
  <https://git-scm.com/docs/git-mv>
- OWASP API9:2023 Improper Inventory Management:
  <https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/>

## Recommendations

### Consume Artifact-Bound Post-Removal Evidence

The exporter should require the standalone, fingerprint-valid post-removal
runtime evidence artifact and re-run verification from it before authorizing
another batch. The input context must repeat the artifact's applied
removal-review fingerprint.

Pros:

- detects altered or cross-batch evidence,
- prevents compounding a broken removal,
- keeps each batch gated by concrete runtime and reference evidence,
- makes failed verification visible before new authorization.

Cons:

- next-batch authorization cannot run until runtime evidence artifact output is
  available.

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

Use this stack for next-batch authorization:

1. Require an intact runtime evidence artifact, then regenerate post-removal
   verification from it.
2. Require the input review fingerprint to match the artifact's applied review.
3. Require compatibility deletion execution-plan JSON with ready approved
   manifest entries.
4. Block applied paths outside the current manifest before calculating remaining
   inventory.
5. Block unknown, already removed, empty, or overly broad requested batches.
6. Require `authorizationReason` and `authorizedBy` while remaining paths exist.
7. Emit ready next-batch authorization or complete-no-remaining-paths evidence.
8. Reject file deletion, archive, route/test removal, storage mutation, manifest
   writes, and Git side effects.

## Implementation Outcome

Implemented:

- Added
  `policyNextCompatibilityRemovalBatchAuthorizationArtifact.mjs`.
- Added `generate-policy-next-batch-authorization.mjs`.
- Added root npm script `policy:next-batch-authorization`.
- Added focused tests for:
  - ready next-batch authorization artifact generation,
  - complete-no-remaining-paths artifact generation,
  - blocked invalid requested paths,
  - forbidden side-effect rejection,
  - artifact validation invariants.
- Added the next-batch authorization artifact suite and this design doc to the
  fixed policy storage closure validation evidence command set.
- The artifact now emits `version =
  policy.next_compatibility_removal_batch_authorization_artifact.v2`, retains
  the consumed runtime evidence artifact, and rejects detached verification
  summaries.
  `nextStep.stepId = compatibility_removal_completion_audit`; production output
  does not expose `nextPhase.phaseId`.

Example:

```bash
npm run --silent policy:next-batch-authorization -- \
  --runtime-evidence-artifact .tmp/phase8r/post-removal-runtime-evidence.json \
  --execution-plan .tmp/phase8r/execution-plan.json \
  --input .tmp/phase8r/next-batch-authorization-input.json \
  --output .tmp/phase8r/next-batch-authorization.json \
  --artifact-output .tmp/phase8r/next-batch-authorization-artifact.json
```

## Next Step

Use the generated authorization JSON as input for the compatibility removal
completion-audit artifact export. When that audit reports no remaining
approved manifest paths, proceed to **Completion Checkpoint module naming
cutover** so checkpoint contracts consume semantic completion-audit evidence.
