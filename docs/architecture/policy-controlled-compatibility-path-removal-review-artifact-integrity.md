# Policy Controlled Compatibility Path Removal Review Artifact Integrity

## Intent

Review Artifact Integrity makes the controlled removal review a verifiable
handoff rather than a collection of independently trusted objects. Before an
adapter can remove any path, the apply boundary verifies one SHA-256 review
artifact that covers the execution-plan artifact, the execution gate, selected
manifest entries, review reason, reviewer, risks, and no-side-effect policy.

The boundary then rebuilds the execution gate from its embedded preflight
evidence and replays the removal review. Missing, altered, mismatched, or
non-replayable evidence blocks the call before `applyEntry(entry)` is invoked.

## Official-Source Research

- SLSA Build: Verifying artifacts says artifact consumers should verify that
  provenance matches the digest of the artifact and the consumer's
  expectations before use. The apply adapter is a consumer of reviewed removal
  evidence, so it verifies the review fingerprint and its replayed context.
- NIST SP 800-128 describes security-focused configuration management as a way
  to manage and monitor system configurations while minimizing risk. Replaying
  approved review context immediately before a change keeps the destructive
  operation connected to the approved configuration.
- NIST's configuration-control definition describes protecting systems from
  improper modification before, during, and after implementation. Rejecting a
  changed review before adapter invocation is the control that enforces that
  principle here.

Sources:

- SLSA Build: Verifying artifacts:
  <https://slsa.dev/spec/v1.2/verifying-artifacts>
- NIST SP 800-128, Guide for Security-Focused Configuration Management:
  <https://csrc.nist.gov/pubs/sp/800/128/upd1/final>
- NIST Configuration Control glossary:
  <https://csrc.nist.gov/glossary/term/configuration_control>

## Options Considered

### Trust The Ready Review Flag

Pros:

- minimal processing before apply,
- no additional artifact format.

Cons:

- a changed batch can retain a stale ready flag,
- the adapter cannot prove which gate or manifest authorized its entries,
- altered preflight evidence is not reevaluated.

### Compare Only Summary Fingerprints

Pros:

- small response payload,
- catches a simple direct artifact mismatch.

Cons:

- does not bind selected entries, reviewer, reason, or preflight evidence,
- cannot replay the exact reviewed state,
- leaves the adapter dependent on separate summary fields.

### Fingerprint And Replay The Complete Bounded Review

Pros:

- binds the approved context and selected entries together,
- detects post-review changes before adapter invocation,
- proves current gate semantics by rebuilding from preflight evidence,
- stays modular and leaves adapter mechanics unchanged.

Cons:

- review objects carry their bounded execution context,
- any intentional change requires regeneration and renewed confirmation.

## Final Recommendation Stack

1. Emit a versioned SHA-256 review artifact with every ready removal review.
2. Bind the full execution-plan artifact, execution gate, selected entries,
   review metadata, risks, and side-effect policy into that artifact.
3. At apply time, validate the review artifact before checking confirmation or
   invoking an adapter.
4. Rebuild the gate from its embedded preflight evidence and replay the review.
5. Reject missing, altered, mismatched, or non-replayable evidence without
   calling `applyEntry(entry)`.
6. Preserve separate explicit operator confirmation and result-parity checks.

## Implementation Outcome

`policyControlledCompatibilityPathRemovalReviewArtifact.mjs` is a modular ESM
contract that creates and validates the review-artifact fingerprint. The
removal review now carries bounded `executionContext` data plus the fingerprint.
The apply contract is now v2 and verifies the artifact, gate replay, and review
replay before it can call the injected adapter.

Focused tests prove that an adapter is not called when the review context is
missing, when a review changes after fingerprinting, or when altered preflight
evidence no longer rebuilds a ready gate.

## Follow-On Boundary

The next component is 8R.19.1, Runtime Evidence Integrity. It should bind
post-removal scans and validation evidence to the exact applied review before
another removal batch can be authorized.
