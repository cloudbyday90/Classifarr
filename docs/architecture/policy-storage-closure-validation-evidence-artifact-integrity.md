# Policy Storage Closure Validation Evidence Artifact Integrity

## Intent

The policy storage closure checkpoint must not treat four mutable `passed`
booleans as sufficient validation evidence. This design defines a versioned
artifact that retains normalized results for the fixed validation command
catalog, binds its complete derived output with a SHA-256 fingerprint, and
rebuilds the artifact before a closure consumer accepts it.

The generator remains the only component that executes validation commands.
The fingerprint and integrity services are pure: they do not read files, run
commands, write artifacts, invoke Git, or mutate policy storage.

## Official-Source Research

- SLSA verification guidance says consumers should compare provenance to
  trusted expected values and fail on unrecognized external parameters. The
  fixed source-controlled command catalog is the expected input here; a
  consumer rejects a different catalog or a result that cannot reproduce the
  derived artifact.
- NIST SSDF treats provenance, integrity protection, automation, and
  risk-based verification as secure-development lifecycle concerns. Retaining
  bounded normalized inputs lets the checkpoint reproduce the evidence decision
  instead of trusting a narrative status.
- Node.js provides `node:crypto` for SHA-256 digests. The implementation uses a
  deterministic, key-sorted JSON projection before hashing so property order
  cannot change the result.

Sources:

- [SLSA artifact verification guidance](https://slsa.dev/spec/v1.2/verifying-artifacts)
- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
- [Node.js crypto API](https://nodejs.org/api/crypto.html)

## Options Considered

### Self-Reported Summary

Store only `focused`, `lint`, `markdown`, and `full` pass/fail entries.

Pros:

- smallest artifact,
- compatible with the original checkpoint shape.

Cons:

- derived values can be edited without evidence of their origin,
- no consumer can establish which commands or results produced the summary.

### Fingerprint Only

Bind the summary with an unsigned SHA-256 digest.

Pros:

- detects accidental alteration when the digest is retained,
- gives consumers a compact integrity reference.

Cons:

- an actor able to change the JSON can recompute an unsigned digest,
- does not prove the status and counters follow from the command results.

### Fingerprint And Deterministic Replay

Retain normalized input, use the fixed catalog as an expectation, fingerprint
the bounded artifact projection, and rebuild the artifact from retained input.

Pros:

- detects altered payloads before closure status is consumed,
- rejects re-fingerprinted derived values that disagree with retained input,
- keeps validation execution outside of pure checkpoint and audit services,
- preserves bounded diagnostics without embedding command logs.

Cons:

- adds retained command-result metadata to the artifact,
- requires consumers to support only the current artifact version,
- does not authenticate a remote producer that can modify every field and
  recompute the unsigned digest.

## Final Recommendation Stack

1. Emit only `policy.storage_closure_validation_evidence.v3` from the fixed
   source-controlled command catalog.
2. Retain normalized check ID, exit code, signal, duration, timestamps,
   bounded message, and side-effect input.
3. Compute a versioned SHA-256 fingerprint over the full bounded projection.
4. Validate the version, catalog, counters, generated timestamp, and
   fingerprint before consuming the artifact.
5. Rebuild the artifact with the retained normalized input and canonical
   command catalog, without executing commands.
6. Require exact replay agreement in the completion checkpoint and
   current-closure audit.
7. Treat the unsigned digest as local workflow integrity only. If evidence
   crosses a host, trust, or operator boundary, require a signed CI
   attestation and a trusted builder identity.

## Implementation Outcome

Implemented:

- `policyStorageClosureValidationEvidence.mjs` now emits v3 evidence with a
  canonical command catalog, retained normalized input, validation counters,
  bounded risks, and fingerprint metadata.
- `policyStorageClosureValidationEvidenceFingerprint.mjs` projects, hashes,
  and validates the bounded artifact content.
- `policyStorageClosureValidationEvidenceIntegrity.mjs` validates and replays
  the artifact without command execution.
- The completion checkpoint, checkpoint artifact, and current-closure audit
  consume only replay-verified validation evidence. Their contracts advanced to
  v3 to reject older summary-only artifacts.
- Focused tests cover valid replay, direct digest alteration, inconsistent
  fingerprint provenance, legacy summaries, and refingerprinted derived drift.
- The v3 catalog directly validates the closure-map reconciliation service and
  design record. Prior v2 artifacts fail version and catalog validation rather
  than being reused after the repository/install scope contract changed.

## Security Boundary

The artifact is intentionally not a signed attestation. It prevents a local
consumer from accepting a detached, stale, malformed, or derived-state-unsafe
summary, but it cannot establish the identity of an untrusted remote producer.
The next trust-boundary expansion must use CI-backed signatures or an
equivalent authenticated provenance envelope rather than treating the SHA-256
field as an authorization mechanism.
