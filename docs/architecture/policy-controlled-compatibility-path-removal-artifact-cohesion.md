# Policy Controlled Compatibility Path Removal Artifact Cohesion

## Intent

Artifact and gate cohesion prevents a caller from selecting compatibility paths
from one removal manifest while presenting a ready execution gate generated for
another. The removal-review boundary consumes one versioned execution-plan
artifact, validates its deterministic fingerprint, validates the execution
gate's embedded artifact, and requires the fingerprints to be identical before
using any manifest entry.

This is a control-plane integrity boundary only. It does not perform a file,
route, test, storage, manifest, archive, or Git mutation.

## Official-Source Research

- SLSA Build: Verifying artifacts says verification includes matching the
  provenance statement subject to the digest of the artifact and failing on
  unrecognized expected values. A manifest selection is an artifact consumer,
  so it must validate the artifact that carries the manifest instead of trusting
  independent readiness flags.
- NIST SP 800-218 defines the Secure Software Development Framework as secure
  development practices integrated into the SDLC. A small, explicit integrity
  contract with focused validation makes the destructive path reviewable and
  testable as part of that lifecycle.

Sources:

- SLSA Build: Verifying artifacts:
  <https://slsa.dev/spec/v1.2/verifying-artifacts>
- NIST Secure Software Development Framework SP 800-218:
  <https://csrc.nist.gov/pubs/sp/800/218/final>

## Options Considered

### Keep Raw Plan And Gate Inputs

Pros:

- smallest immediate caller change,
- easy to inspect separately.

Cons:

- a ready gate can be paired with a different plan or manifest,
- selection has no single immutable source of truth,
- callers can accidentally reconstruct trust from detached objects.

### Compare Only Plan Status And Manifest Entry Counts

Pros:

- low implementation cost,
- catches some obviously invalid calls.

Cons:

- equal counts do not prove identical manifests,
- cannot detect altered replacement evidence or approval context,
- retains ambiguous object composition.

### Require One Fingerprint-Validated Artifact And A Matching Gate

Pros:

- binds every selected path to one approved manifest context,
- detects different, altered, missing, or invalid gate artifacts,
- keeps the contract small and side-effect-free,
- follows the artifact-consumer verification model from SLSA.

Cons:

- artifact regeneration requires a new matching gate and current preflight
  evidence,
- callers must preserve the versioned artifact through the review handoff.

## Final Recommendation Stack

1. Accept a versioned `executionPlanArtifact` as the only manifest source.
2. Validate the artifact's version, readiness, contract validation, and
   deterministic fingerprint.
3. Validate the artifact embedded in the supplied execution gate.
4. Require the embedded and supplied artifact fingerprints to match exactly.
5. Select paths only from the supplied artifact's approved manifest.
6. Block on any mismatch and defer all mutations to the separate apply boundary.

## Implementation Outcome

`policyControlledCompatibilityPathRemoval.mjs` now exposes v2 of the removal
review contract. It rejects raw execution-plan input as insufficient evidence,
reports bounded artifact and gate-cohesion risks, and includes fingerprint
summaries in its review output. The controlled removal batch artifact forwards
the same execution-plan artifact to this boundary instead of extracting and
passing a raw plan.

Focused tests cover a ready review, a blocked artifact, a blocked gate, a ready
gate paired with a different ready artifact, and a legacy raw-plan attempt.

## Follow-On Boundary

The next component is 8R.18.1, Review Artifact Integrity. It should make the
apply boundary revalidate the review's artifact and gate context before any
adapter call can execute.
