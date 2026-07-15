# Policy Next Compatibility Removal Batch Authorization Artifact Exporter

## Intent

The next-batch authorization artifact exporter generates a machine-readable
policy next compatibility removal batch authorization artifact from:

- a fingerprint-valid post-removal runtime evidence artifact,
- a ready, fingerprint-valid compatibility deletion execution-plan artifact,
- replay-verified checkout path-state evidence bound to that exact execution
  plan artifact,
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
- SLSA's artifact verification guidance requires consumers to compare an
  artifact and its provenance against expected values and recommends
  defense-in-depth verification at more than one boundary. The public exporter
  therefore rechecks the runtime artifact, execution-plan artifact, and
  replayed path-state evidence instead of treating a JSON file as trusted.
- OWASP input-validation guidance recommends server-side allowlists. The
  exporter authorizes only paths in the retained approved manifest, and its
  process test proves that unknown and previously removed paths cannot cause
  output writes by default.

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
- SLSA Verifying Artifacts:
  <https://slsa.dev/spec/v1.2/verifying-artifacts>
- OWASP Input Validation Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html>

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

### Authorize Only Snapshot-Proven Remaining Manifest Paths

The exporter should derive removed and remaining inventory from the verified
checkout snapshot, require runtime applied paths to exactly equal the
snapshot's removed paths, and reject unknown or already removed requested
paths.

Pros:

- prevents another runtime artifact or checkout snapshot from silently
  redefining deletion state,
- prevents out-of-manifest deletion,
- prevents duplicate removal attempts,
- keeps cleanup tied to approved compatibility inventory.

Cons:

- both the execution-plan artifact and a current snapshot must remain available
  until cleanup completes.

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

### Verify the Public Artifact Chain

The command-level boundary should be tested with the genuine versioned runtime
evidence artifact, execution-plan wrapper, and replayed path-state evidence.
The test should assert that a coherent chain writes the nested authorization and
its wrapper together, while unknown paths, another review fingerprint, another
manifest, or an already-removed path fail closed. Blocked diagnostics may be
written only after an explicit operator flag.

Pros:

- proves the CLI preserves service-level provenance and allowlist checks,
- prevents a future argument or serialization change from bypassing no-write
  defaults,
- validates the exact output consumed by the next removal or completion loop.

Cons:

- the test deliberately mirrors a small verified removal context, so fixture
  changes must keep all three artifacts coherent.

## Final Recommendation Stack

Use this stack for next-batch authorization:

1. Require an intact runtime evidence artifact, then regenerate post-removal
   verification from it.
2. Require the input review fingerprint to match the artifact's applied review.
3. Require a ready, fingerprint-valid compatibility deletion execution-plan
   artifact with approved manifest entries.
4. Require replay-verified checkout path-state evidence bound to that exact
   artifact and exact manifest.
5. Derive remaining inventory from the snapshot and require runtime applied
   paths to exactly equal its removed paths.
6. Block unknown, already removed, empty, or overly broad requested batches.
7. Require `authorizationReason` and `authorizedBy` while remaining paths exist.
8. Emit ready next-batch authorization or complete-no-remaining-paths evidence.
9. Reject file deletion, archive, route/test removal, storage mutation, manifest
   writes, and Git side effects.
10. Exercise the public command with a coherent artifact chain and require an
    explicit flag before blocked diagnostics are written.

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
- Added public generator verification that:
  - writes ready nested and wrapper authorization output only from one coherent
    runtime-evidence, execution-plan, and path-state artifact chain,
  - fails closed without writing output for unknown paths, a cross-review
    authorization context, or runtime evidence from another manifest,
  - writes an already-removed-path diagnostic only with `--allow-blocked`.
- Added the next-batch authorization artifact suite and this design doc to the
  fixed policy storage-closure requirement audit and current-evidence inventory.
- The artifact now emits `version =
  policy.next_compatibility_removal_batch_authorization_artifact.v4`, retains
  the consumed runtime evidence, execution-plan artifact, and path-state
  evidence, fingerprints its bounded wrapper payload, and rejects detached
  verification summaries, raw plans, cross-artifact snapshots, and divergent
  snapshot path sets.
  `nextStep.stepId = compatibility_removal_completion_audit`; production output
  does not expose `nextPhase.phaseId`.

Example:

```bash
npm run --silent policy:next-batch-authorization -- \
  --runtime-evidence-artifact .tmp/phase8r/post-removal-runtime-evidence.json \
  --execution-plan-artifact .tmp/phase8r/execution-plan-artifact.json \
  --path-state-evidence .tmp/phase8r/path-state-evidence.json \
  --input .tmp/phase8r/next-batch-authorization-input.json \
  --output .tmp/phase8r/next-batch-authorization.json \
  --artifact-output .tmp/phase8r/next-batch-authorization-artifact.json
```

## Next Step

Use the generated authorization artifact as input for the compatibility removal
completion-audit artifact export. Final storage-closure audit consumers must
also bind it to the expected execution-plan artifact fingerprint.
