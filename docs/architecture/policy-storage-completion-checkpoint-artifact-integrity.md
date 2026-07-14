# Policy Storage Completion Checkpoint Artifact Integrity

## Intent

The policy storage completion checkpoint must not treat a detached
compatibility-removal audit object as proof that Phase 8R can close. The
checkpoint now consumes a versioned completion-audit artifact that retains the
authorization artifact, execution plan, and audit input required to reproduce
the audit.

The integrity boundary verifies three things before the checkpoint reads audit
status:

1. The completion-audit artifact has the current schema version and a valid
   SHA-256 fingerprint over its bounded contents.
2. The artifact retains the reviewed next-batch authorization artifact, the
   execution plan, and the final-scan and validation input used to make the
   audit decision.
3. Rebuilding the audit from those retained inputs produces the stored artifact
   exactly.

This is evidence verification only. It does not scan files, write artifacts,
run commands, mutate storage, or execute Git.

## Official-Source Research

- [SLSA verified properties](https://slsa.dev/spec/v1.2/verified-properties)
  describe artifact integrity and provenance properties that can be checked by
  a verifier. The checkpoint applies that model locally: a digest binds the
  bounded evidence and replay verifies the decision derived from it.
- [NIST SP 800-128](https://csrc.nist.gov/pubs/sp/800/128/upd1/final)
  treats security-focused configuration management as controlled change with
  monitoring. The checkpoint uses explicit evidence and validation rather than
  trusting a previous status claim.
- [NIST SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final) recommends
  incorporating secure development practices throughout the lifecycle. Keeping
  verification inputs with the audit makes the closure decision reproducible
  during review and future maintenance.

## Options Considered

### Detached Audit Object

Pass only `completionAuditArtifact.audit` into the checkpoint.

Pros:

- simple synchronous caller contract,
- minimal payload.

Cons:

- does not prove the object came from the artifact,
- loses the authorization, execution-plan, and review context,
- permits stale or altered completion evidence to reach the checkpoint.

### Fingerprint Only

Fingerprint the artifact and check the digest before consuming its nested
audit.

Pros:

- detects ordinary modification,
- preserves a compact verification boundary.

Cons:

- cannot prove that a correctly fingerprinted audit was derived from the
  retained inputs,
- does not catch an internally inconsistent artifact regenerated after an
  unsafe mutation.

### Fingerprint And Deterministic Replay

Fingerprint the bounded artifact and recreate the completion audit from its
retained evidence before the checkpoint consumes it.

Pros:

- detects ordinary mutation and internally inconsistent re-fingerprinted
  evidence,
- preserves the applied authorization and review context through closure,
- gives callers one artifact rather than a loose collection of trusted fields.

Cons:

- makes the checkpoint and its closure consumers asynchronous,
- requires retaining the replay inputs in the artifact.

## Final Recommendation Stack

1. Emit completion-audit artifact version `v3` with its authorization artifact,
   execution plan, normalized audit input, audit output, and SHA-256
   fingerprint.
2. Require the current artifact version and a valid artifact fingerprint.
3. Reject missing replay inputs before evaluating completion status.
4. Replay the completion audit and require exact bounded artifact equality.
5. Pass only the replay-verified audit into the storage completion checkpoint.
6. Pass the full artifact, rather than a detached audit, through the closure
   evidence collector and current closure audit.
7. Keep all verification services side-effect free.

## Implementation Outcome

Implemented:

- Added `policyCompatibilityRemovalCompletionAuditArtifactFingerprint.mjs` to
  create and validate a bounded SHA-256 artifact fingerprint.
- Added `policyCompatibilityRemovalCompletionAuditArtifactIntegrity.mjs` to
  verify artifact schema, fingerprint, retained inputs, and deterministic audit
  replay.
- Upgraded the completion-audit artifact from `v2` to `v3` and retained the
  execution plan and audit input needed for replay.
- Upgraded the storage completion checkpoint and checkpoint artifact to await
  integrity verification before evaluating completion.
- Removed detached `finalRemovalAudit` inputs from the closure evidence runner,
  current-state collector, and associated command-line runner.
- Added tamper, re-fingerprinted replay mismatch, and missing replay-input test
  coverage.

## Next Step

Use the current-state evidence run to verify the full storage closure chain
against a fingerprint-valid completion-audit artifact. The next atomic closure
task is to give the current-state evidence artifact the same fingerprint and
replay integrity boundary.
