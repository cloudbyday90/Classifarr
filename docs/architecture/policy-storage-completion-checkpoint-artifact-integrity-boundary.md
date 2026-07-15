# Policy Storage Completion Checkpoint Artifact Integrity Boundary

## Intent

The policy storage final closure readout is an operator-facing completion
decision. It must not trust a caller-supplied object simply because the object
claims `complete: true` or contains a nested complete checkpoint.

This boundary makes the policy storage completion-checkpoint artifact a
verifiable handoff contract. The final readout accepts the artifact only when
it is current, fingerprint-valid, and exactly replayable from its retained
component, roadmap, completion-audit, validation, changelog, and side-effect
inputs.

## Official-Source Research

- SLSA's artifact-verification guidance requires comparing provenance and
  expected values rather than trusting an artifact assertion. The boundary
  applies that principle by binding the whole checkpoint artifact and
  recomputing it from retained inputs.
- NIST SSDF calls for protecting software and tracking security-relevant
  development information. Retaining bounded evidence inputs makes the final
  closure decision reviewable and reproducible.
- OWASP input-validation guidance recommends server-side allowlisting. The
  verifier accepts only the current artifact version, a versioned SHA-256
  fingerprint, and the explicit replay input shape.

Sources:

- SLSA, [Verifying artifacts](https://slsa.dev/spec/v1.2/verifying-artifacts)
- NIST, [Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
- OWASP, [Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)

## Options Considered

### Trust The Nested Checkpoint Status

Pros:

- smallest implementation,
- no additional artifact data.

Cons:

- a caller can forge a complete wrapper around a complete-looking checkpoint,
- there is no way to determine whether summaries still reflect their evidence,
- final closure becomes a trust boundary without verification.

### Fingerprint Only The Wrapper

Pros:

- detects accidental post-generation changes,
- has a small deterministic implementation.

Cons:

- a producer or caller can recompute a valid fingerprint for inconsistent
  derived values,
- it does not demonstrate that the nested checkpoint was derived from the
  declared evidence.

### Fingerprint And Replay From Retained Inputs

Pros:

- detects post-generation changes and self-consistent but forged summaries,
- lets the final readout use a freshly recomputed artifact,
- keeps evidence collection outside the readout while retaining a bounded,
  auditable handoff contract,
- fails closed for legacy wrappers that cannot prove their derivation.

Cons:

- artifact JSON is larger because it retains its inputs,
- a checkpoint contract change requires an intentional artifact version change.

## Final Recommendation Stack

1. Retain the exact checkpoint inputs in the artifact wrapper.
2. Bind all deterministic artifact fields with a versioned SHA-256 fingerprint.
3. Validate fingerprint shape, algorithm, version, digest, and bounded
   provenance before the final readout reasons about the artifact.
4. Rebuild the checkpoint artifact from retained inputs and require exact
   deterministic equality.
5. Use the replayed artifact, never the caller-supplied wrapper, when integrity
   validation succeeds.
6. Treat missing, historical, malformed, altered, non-replayable, or
   replay-divergent artifacts as `blocked_by_artifact_validation`.
7. Keep file writing and all mutations outside the integrity service and final
   readout.

## Contract

`policyStorageCompletionCheckpointArtifact.mjs` version 4 retains the bounded
input evidence and emits `artifactFingerprint`. The fingerprint projection
includes the artifact's derived checkpoint, summaries, risk list, side effects,
execution policy, and semantic next step, but excludes the fingerprint wrapper
itself.

`policyStorageCompletionCheckpointArtifactIntegrity.mjs` first validates the
version 4 wrapper, then requires all retained evidence inputs, and finally
rebuilds the artifact with the original generation timestamp. Any difference is
an integrity failure.

The final closure readout exposes only bounded integrity outcome metadata:

- `ok`,
- `issueCount`,
- `artifactFingerprint`.

It does not expose raw evidence or validation command output in its operator
summary.

## Migration Rule

This contract intentionally supersedes the unreleased version 3 checkpoint
wrapper. Version 3 does not retain enough data for deterministic replay and is
therefore not accepted by the final closure readout. No compatibility fallback
is provided: a checkpoint artifact must be regenerated from its current source
evidence before it can support a storage-closure claim.

## Implementation Outcome

Implemented:

- versioned SHA-256 checkpoint-artifact fingerprinting with provenance,
- server-side fingerprint validation,
- retained evidence inputs required for replay,
- deterministic replay verification before final closure evaluation,
- fail-closed artifact-validation status for any integrity failure,
- focused service tests for valid, altered, re-fingerprinted divergent, and
  non-replayable artifacts,
- public final-readout CLI coverage for coherent, altered, and explicitly
  allowed blocked checkpoint artifacts,
- fixed focused validation coverage for both public checkpoint and final
  readout generators.
