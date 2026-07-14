# Policy Post-Removal Runtime Evidence Integrity

## Intent

Post-removal verification must prove that its import scan, runtime checks, and
focused and full validation results belong to the same controlled-removal review
that was applied. A passing test from another removal batch, or evidence edited
after it was collected, must not authorize further compatibility removal.

The runtime verifier remains side-effect-free. It consumes an explicit,
versioned evidence artifact; it does not run source searches, tests, Git
commands, storage writes, or removals.

## Official-Source Research

- SLSA artifact verification recommends checking an artifact digest against its
  provenance subject and evaluating expected provenance before use. The runtime
  evidence artifact applies the same artifact-to-evidence binding pattern to a
  controlled local removal workflow.
- NIST SP 800-128 describes security-focused configuration management as
  controlling and monitoring changes to preserve integrity and reduce risk.
  Binding verification evidence to the reviewed change makes that monitoring
  specific to one bounded change set.
- NIST SP 800-218 recommends integrating secure development practices into the
  SDLC. The contract makes verification evidence explicit, deterministic, and
  testable rather than relying on a caller's unverified pass flag.

Sources:

- [SLSA Build: Verifying artifacts](https://slsa.dev/spec/v1.2/verifying-artifacts)
- [NIST SP 800-128: Guide for Security-Focused Configuration Management](https://csrc.nist.gov/pubs/sp/800/128/upd1/final)
- [NIST SP 800-218: Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)

## Options Considered

### Raw Independent Evidence

Allow the verifier to receive an apply result, import scan, runtime checks, and
validation result as independent values.

Pros:

- smallest caller payload change,
- simple unit-test fixtures.

Cons:

- cannot prove that values belong to one applied review,
- a later caller can mix an old successful test result with a new removal,
- evidence can change after review without a deterministic detection boundary.

### Externally Signed Evidence

Require a key-backed signature from every source-search and test producer.

Pros:

- establishes integrity across independently trusted systems,
- supports hostile or cross-organization evidence producers.

Cons:

- introduces key lifecycle, trust-root, rotation, and operator overhead,
- exceeds the current in-process control-plane trust boundary.

### Fingerprinted Review-Bound Evidence Artifact

Construct one SHA-256 artifact over the applied evidence and require every
import scan, runtime check, and validation result to carry the exact applied
review artifact fingerprint.

Pros:

- detects altered evidence and cross-batch substitution,
- preserves bounded, deterministic, no-side-effect verification,
- keeps the current exporter usable without exposing review internals.

Cons:

- evidence producers must attach the review fingerprint,
- digest integrity alone is not an authentication mechanism for an untrusted
  external producer.

## Final Recommendation Stack

1. Carry the already verified removal-review fingerprint forward from the
   controlled apply result.
2. Require every supplied import scan, runtime check, focused validation, and
   full validation result to declare that exact fingerprint.
3. Hash the complete evidence projection with a versioned SHA-256 artifact.
4. Validate artifact version, digest, provenance summary, and every binding
   before using any nested evidence in the runtime verifier.
5. Preserve the existing detailed blockers for genuinely missing scans, checks,
   or validations; classify altered or cross-batch supplied evidence as an
   integrity blocker.
6. Introduce externally signed provenance only if this evidence crosses an
   untrusted process or organizational trust boundary.

## Implementation Outcome

Implemented `policyPostRemovalRuntimeEvidenceArtifact.mjs` as the single
evidence-binding contract. It fingerprints the applied review identity and
bounded evidence payload, validates every supplied binding, and exposes only
counts, paths, fingerprints, and bounded issue identifiers.

`policyPostRemovalRuntimeVerification.mjs` now consumes the validated artifact
instead of independent raw evidence objects. Missing, malformed, altered, or
cross-batch artifacts produce `blocked_by_evidence_integrity` before a verifier
can report success. The artifact exporter constructs this evidence artifact from
its explicit input and retains the side-effect-free execution policy.

Focused tests cover a valid artifact, altered import evidence, missing bindings,
cross-batch runtime evidence, and preservation of existing missing-evidence
diagnostics.

## Next Step

Proceed with **8R.20.1 Next-Batch Authorization Artifact Integrity** so the
next removal batch can consume this verified artifact rather than only a
detached post-removal status summary.
