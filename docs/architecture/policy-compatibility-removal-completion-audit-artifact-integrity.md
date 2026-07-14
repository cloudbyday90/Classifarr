# Policy Compatibility Removal Completion Audit Artifact Integrity

## Intent

Compatibility-removal completion must not be inferred from separately supplied
authorization and runtime-verification summaries. The completion audit now
accepts one versioned, SHA-256 fingerprint-valid next-batch authorization
artifact, revalidates its embedded post-removal runtime evidence, and replays
the authorization against the current execution manifest.

The audit context must provide the applied removal-review fingerprint. That
fingerprint must match both the runtime evidence provenance and the embedded
authorization context. A missing, modified, cross-review, or cross-manifest
artifact blocks completion before final scan or validation evidence can claim
success.

This boundary is read-only. It does not delete, archive, mutate storage, write
manifests, run source scans or tests, or execute Git commands.

## Official-Source Research

- SLSA describes artifact verification as checking that the artifact and its
  provenance meet explicit expectations, including that the artifact digest
  matches its provenance. The completion audit validates the authorization
  artifact fingerprint before consuming its nested evidence.
- NIST SP 800-128 treats security-focused configuration management as a
  controlled and monitored change process. Replaying authorization against the
  current manifest prevents preflight evidence from silently authorizing a
  changed removal scope.
- NIST SP 800-218 recommends integrating secure development practices into the
  SDLC. Binding the final audit to prior reviewed runtime evidence prevents a
  caller from reconstructing a favorable conclusion from detached fields.

Sources:

- SLSA, [Verifying Artifacts](https://slsa.dev/spec/v1.2/verifying-artifacts)
- NIST, [SP 800-128: Guide for Security-Focused Configuration Management](https://csrc.nist.gov/pubs/sp/800/128/upd1/final)
- NIST, [SP 800-218: Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)

## Options Considered

### Detached Authorization And Verification Summaries

Accept a completion authorization object and a list of `verified` runtime
summaries from the caller.

Pros:

- simple flat input shape,
- no artifact replay.

Cons:

- summaries can be substituted after a reviewed removal,
- the audit cannot prove they belong to the current manifest,
- review context can drift between removal and completion.

### Validate Only The Embedded Runtime Artifact

Validate the raw runtime artifact but trust the wrapper authorization result.

Pros:

- detects changed runtime evidence,
- lower implementation cost.

Cons:

- leaves the wrapper authorization and current manifest relationship
  unverified,
- cannot detect a valid artifact reused for another removal batch.

### Fingerprint And Replay The Authorization Artifact

Fingerprint the complete next-batch authorization artifact, validate its
embedded runtime artifact, bind the applied review fingerprint to audit input,
and regenerate authorization using the current execution manifest.

Pros:

- detects altered outer and nested evidence,
- prevents cross-review and cross-manifest reuse,
- keeps one authoritative evidence chain,
- retains the valid `remaining_inventory` outcome for incremental removal.

Cons:

- callers must retain the authorization artifact,
- replay makes the audit asynchronous.

## Final Recommendation Stack

1. Require a current `policy.next_compatibility_removal_batch_authorization_artifact.v3` artifact.
2. Verify its bounded SHA-256 fingerprint and wrapper invariants.
3. Revalidate the embedded runtime-evidence artifact before using any nested
   authorization state.
4. Require the audit context review fingerprint to match the applied review
   fingerprint in both evidence and authorization context.
5. Replay the authorization against the current execution manifest and reject
   any mismatch.
6. Derive removal coverage only from the replayed artifact chain.
7. Preserve `remaining_inventory` for a valid ready artifact with paths left.
8. Keep all audit and exporter logic side-effect-free.

## Implementation Outcome

Implemented:

- Added a SHA-256 fingerprint projection for next-batch authorization artifacts.
- Moved the outer authorization artifact to `v3` and require its fingerprint to
  validate before it is trusted.
- Added a modular authorization-artifact integrity service that revalidates
  runtime evidence, review context, and a replayed authorization result.
- Moved the completion audit and its wrapper artifact to `v2`.
- Removed detached completion-authorization and post-removal-verification
  inputs from the completion audit contract.
- Updated the exporter to require `--next-batch-authorization-artifact`.
- Added focused tests for intact, altered, cross-review, and cross-manifest
  artifact chains, plus bounded remaining-inventory behavior.

## Next Step

Proceed with **8R.22.1 Completion Checkpoint Artifact Integrity**. The
checkpoint should consume a fingerprint-valid completion-audit artifact instead
of detached completion audit summaries before it can report Phase 8R closure.
