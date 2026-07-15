# Policy Next-Batch Authorization Artifact Integrity

## Intent

Next compatibility-removal batch authorization must not trust a detached
`verified` status summary. It must consume the fingerprint-valid
`policy.post_removal_runtime_evidence_artifact.v1` produced for the exact
previous controlled-removal review, re-run post-removal verification from that
artifact, and bind the authorization context to the same review fingerprint.

The authorization also consumes replay-verified checkout path-state evidence
bound to the exact ready execution-plan artifact retained in the authorization
artifact. It derives the remaining inventory from that snapshot, verifies every
runtime applied path against the approved manifest, and requires the runtime
applied set to match the snapshot's removed-path set exactly. This prevents a
valid artifact from a different removal scope or checkout snapshot from
authorizing another batch.

This boundary remains read-only. It does not remove files, write manifests,
mutate storage, run checks, or execute Git commands.

## Official-Source Research

- SLSA artifact verification requires consumers to validate the artifact
  subject, provenance, and expected values rather than trusting an asserted
  result. The authorization service verifies the runtime artifact digest and
  provenance before it considers the nested runtime result.
- NIST SP 800-128 treats secure configuration management as a controlled,
  monitored change process. The service keeps prior removal evidence and the
  current manifest in one bounded authorization decision.
- NIST SP 800-218 (SSDF) calls for protecting software from tampering and
  maintaining evidence that supports release decisions. Artifact binding keeps
  a caller from replacing verification data after it was produced.

Sources:

- SLSA, [Verifying Artifacts](https://slsa.dev/spec/v1.2/verifying-artifacts)
- NIST, [SP 800-128: Guide for Security-Focused Configuration Management](https://csrc.nist.gov/pubs/sp/800/128/upd1/final)
- NIST, [SP 800-218: Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)

## Options Considered

### Detached Verification Summary

Accept only a `verified=true` post-removal verification object.

Pros:

- simple caller payload,
- no artifact parsing.

Cons:

- an asserted status can be detached from the reviewed removal,
- altered evidence cannot be detected,
- a different removal batch can be represented as the current one.

### Duplicate Raw Evidence In The Authorization Request

Ask the caller to submit apply, scan, check, and validation evidence again.

Pros:

- authorization can independently evaluate every field.

Cons:

- duplicates a prior contract,
- creates multiple sources of truth,
- permits inconsistent reconstruction of a completed verification.

### Verified Runtime Evidence Artifact

Accept the versioned, SHA-256 runtime evidence artifact and an authorization
context containing its applied review fingerprint.

Pros:

- detects missing or altered evidence,
- preserves a single source of truth for prior runtime proof,
- binds the next action to the previous reviewed removal,
- blocks a valid artifact whose applied paths do not belong to the supplied
  manifest.

Cons:

- callers must retain the runtime artifact,
- the contract is asynchronous because it re-runs the side-effect-free
  verifier.

## Final Recommendation Stack

1. Require a versioned, fingerprint-valid runtime evidence artifact.
2. Re-run the post-removal verifier from that artifact; never accept a caller
   supplied verification summary.
3. Require `reviewArtifactFingerprint` in the authorization input and require
   it to equal the fingerprint bound to the runtime artifact's apply evidence.
4. Require every applied path to exist in the current approved execution
   manifest before subtracting it from remaining inventory.
5. Require replay-verified path-state evidence to match the exact approved
   execution-plan artifact and manifest, then calculate remaining inventory
   from that snapshot.
6. Require runtime applied paths to exactly equal the snapshot's removed paths.
7. Retain existing bounded selection, maximum batch size, and authorizer/reason
   rules.
8. Keep the authorization service and exporter side-effect-free.

## Implementation Outcome

Implemented in `policyNextCompatibilityRemovalBatchAuthorization.mjs` and its
artifact exporter:

- authorization contract moved to `v3` and the wrapper artifact to `v4`,
- detached `postRemovalVerification` input was removed,
- authorization now validates the runtime evidence artifact and regenerates
  post-removal verification from it,
- the authorization context must carry the exact applied removal-review
  fingerprint,
- applied paths outside the supplied execution manifest block authorization,
- raw execution plans are no longer an authorization input; the exporter now
  requires `--execution-plan-artifact` and `--path-state-evidence`,
- the wrapper retains the exact plan artifact and replay-verified path-state
  evidence, rejects cross-artifact or divergent snapshots, and derives its
  remaining manifest from the snapshot,
- blocked integrity states expose bounded risk IDs instead of raw evidence,
- the wrapper artifact retains the consumed runtime evidence artifact and binds
  its own bounded payload with a SHA-256 fingerprint,
- `generate-policy-post-removal-verification.mjs` can now write a standalone
  runtime evidence artifact with `--runtime-evidence-output`, and
- `generate-policy-next-batch-authorization.mjs` now requires that standalone
  artifact through `--runtime-evidence-artifact`.

Focused tests cover a valid chain, missing or altered artifact, review-context
mismatch, cross-manifest applied path, failed runtime verification, and bounded
side-effect-free artifact output.

## Next Step

Phase 8R.21.1 should bind the completion audit to a fingerprint-valid
next-batch authorization artifact rather than accepting detached completion
authorization and post-removal summaries.
