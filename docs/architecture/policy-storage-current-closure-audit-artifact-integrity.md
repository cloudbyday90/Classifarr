# Policy Storage Current Closure Audit Artifact Integrity

## Intent

The policy storage current closure audit is the final current-state artifact
consumed by the storage closure requirement audit. It must not be treated as a
mutable JSON summary. This design binds the complete audit, its normalized
current-state evidence, completion-audit artifact, validation evidence, and
side-effect input with a SHA-256 fingerprint. The downstream requirement audit
replays the pure closure chain before it accepts the audit status.

This boundary does not read the repository, run Git, execute commands, write
files, mutate storage, or authorize compatibility removal. Repository reads
remain in the current-evidence collector, validation execution remains in the
validation-evidence generator, and compatibility-removal authorization remains
in the upstream completion-audit artifact.

## Official-Source Research

- NIST SP 800-53 AU-9 calls for protecting audit information from unauthorized
  modification and identifies cryptographic protection as an enhancement. The
  current-closure artifact binds the information that justifies its status and
  makes inconsistent data detectable before a downstream closure decision.
- NIST SSDF treats provenance and security verification as lifecycle concerns.
  Retaining normalized inputs and replaying the deterministic closure chain
makes the current-state decision reproducible rather than narrative.
- SLSA states that provenance only provides value when a consumer verifies it
  against expectations. The requirement audit is the consumer here: it verifies
  version, fingerprint, retained inputs, replay agreement, and selected-checkout
  content before it uses the audit.
- OWASP's supply-chain guidance recommends generating and consuming provenance
  with sufficient metadata. The checkout fingerprint records only SHA-256
  digests for mapped artifacts, roadmap, and changelog content; it does not
  retain raw source or command output.

Sources:

- [NIST SP 800-53 AU-9, Protection of Audit Information](https://csrc.nist.gov/CSRC/media/Projects/risk-management/800-53%20Downloads/800-53r5/SP_800-53_v5_1-derived-OSCAL.pdf)
- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
- [SLSA artifact verification guidance](https://slsa.dev/spec/v1.2/verifying-artifacts)
- [OWASP Software Supply Chain Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Software_Supply_Chain_Security_Cheat_Sheet.html)

## Options Considered

### Fingerprint Only

Fingerprint the emitted audit and let downstream consumers validate the digest.

Pros:

- small implementation surface,
- detects accidental alteration when the digest remains unchanged.

Cons:

- does not prove the retained evidence actually produces the reported result,
- a workflow that can rewrite the artifact can also recompute an unsigned hash.

### Replay Only

Retain inputs and rebuild the audit without a fingerprint.

Pros:

- proves deterministic agreement with retained inputs,
- avoids digest-format management.

Cons:

- does not detect a changed payload before replay begins,
- makes provenance inspection less direct.

### Fingerprint And Replay

Retain explicit closure inputs, bind the complete audit with a versioned
SHA-256 fingerprint, then reconstruct the closure evidence run, checkpoint,
and final readout before downstream use.

Pros:

- detects stale or altered payloads before status consumption,
- catches refingerprinted derived values that do not match deterministic replay,
- preserves a pure, side-effect-free verification boundary,
- keeps the requirement audit from relying on a detached status summary.

Cons:

- increases artifact size because inputs are retained,
- makes the requirement-audit builder asynchronous,
- does not provide authenticity against an actor that can alter every input and
  recompute the unsigned fingerprint.

### Fingerprint, Replay, And Current Checkout Comparison

Retain the fingerprint and replay controls, then recompute a content-only
fingerprint for the mapped repository artifacts, roadmap, and changelog from
the selected checkout before requirement-audit completion.

Pros:

- rejects a structurally valid artifact that was collected before mapped source
  or evidence content changed,
- prevents a same-path checkout from standing in for the checkout actually
  audited,
- retains only fixed-length digests and repository-relative paths.

Cons:

- old current-closure audit JSON must be regenerated,
- source, documentation, or test changes require a new current-closure audit
  before a requirement audit can complete.

## Final Recommendation Stack

1. Emit `policy.storage_current_closure_audit.v6` only with retained normalized
   current-state evidence, completion-audit artifact, validation evidence, and
   side-effect input.
2. Bind the complete artifact projection using a versioned SHA-256 fingerprint.
3. Bind the mapped artifact, roadmap, and changelog content using a separate,
   content-only SHA-256 checkout fingerprint.
4. Validate the audit version, structural invariants, and fingerprint before
   replay.
5. Establish one timestamp at the current-closure boundary and reuse it for
   the checkpoint and final readout, including when the caller leaves it
   unspecified.
6. Rebuild the pure evidence run, checkpoint artifact, final readout, and
   current-closure audit from retained inputs without filesystem or command
   access.
7. Require exact deterministic agreement and a selected-checkout content
   fingerprint match before the storage closure requirement audit uses the
   replayed audit.
8. Reject missing, legacy, malformed, altered, non-replayable, or
   checkout-mismatched artifacts.
9. Add a signed envelope or a trusted CI-attestation boundary only if artifacts
   must be accepted from an untrusted host or operator; an unsigned hash alone
   is not an authenticity control.

## Implementation Outcome

Implemented:

- `policyStorageCurrentClosureAuditFingerprint.mjs` produces and validates the
  SHA-256 projection and bounded provenance.
- `policyStorageCurrentClosureAuditIntegrity.mjs` verifies a v6 artifact,
  reconstructs the pure closure chain from retained inputs, and rejects replay
  mismatches.
- `policyStorageCurrentClosureAudit.mjs` now retains its closure inputs,
  emits the fingerprint, establishes one boundary timestamp for every nested
  artifact, and exposes a pure from-evidence builder for replay.
- `policyStorageClosureRequirementAudit.mjs` now accepts only a
  fingerprint-valid, replay-verified current-closure audit artifact from the
  selected checkout.
- `policyStorageClosureCurrentEvidenceFingerprint.mjs` records the bounded
  digest of mapped current-state artifacts, roadmap, and changelog content.
- Focused tests cover valid replay, stale fingerprints, refingerprinted derived
  drift, missing replay input, selected-checkout content drift, and
  requirement-audit rejection.
- The fingerprint projection also binds the reconciled repository and
  active-installation component scope map.

## Security Boundary

The fingerprint binds the artifact contents and protects workflow integrity; it
does not identify a human or system signer. The current design is appropriate
for local and CI-produced artifacts consumed inside the same controlled
workflow. A future remote or cross-operator handoff must use an authenticated
attestation, key management, and authorization policy rather than relying on
the SHA-256 field alone.
