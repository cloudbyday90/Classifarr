# Policy Compatibility Deletion Preflight Attestation

## Intent

Compatibility deletion needs two different kinds of evidence. Checkout state,
manifest continuity, and retained runtime-evidence references are machine
observations. Backup/restore proof, final support and rollback stances, and
operator approval are human decisions. A single free-form preflight object
would blur that boundary and allow a caller to substitute a boolean for a
verifiable observation.

This component makes the execution gate consume a versioned collector artifact
as machine evidence only. It verifies the artifact again against the current
execution-plan artifact before deriving its attestation. Human operator evidence
remains separately supplied, bound to the same plan fingerprint, and cannot
carry worktree, manifest, or nested collector claims.

## Official-Source Research

- SLSA says provenance must be inspected by a verifier and compared with
  expected values; unrecognized external parameters should fail verification.
  The gate therefore recomputes artifact fingerprints and rejects caller-owned
  machine claims rather than silently ignoring them.
- OWASP identifies insufficient artifact-integrity validation as a delivery
  risk and recommends integrity validation at subsequent consumption steps.
  The gate validates the collector artifact again at its own boundary.
- NIST SP 800-204D covers supply-chain controls for CI/CD pipelines, including
  artifact provenance and attestation. The implementation retains the plan
  fingerprint, collector fingerprint, checkout revision, and observed manifest
  order as bounded evidence.

Sources:

- SLSA, [Build: Verifying Artifacts](https://slsa.dev/spec/v1.2/verifying-artifacts)
- OWASP, [Improper Artifact Integrity Validation](https://owasp.org/www-project-top-10-ci-cd-security-risks/CICD-SEC-09-Improper-Artifact-Integrity-Validation)
- NIST, [SP 800-204D](https://csrc.nist.gov/pubs/sp/800/204/d/final)

## Options Considered

### Retain One Mixed Preflight Object

Pros:

- fewer input fields for a one-off operator command.

Cons:

- callers can present unverified worktree or manifest booleans,
- machine facts can be confused with human approval or recovery claims,
- later consumers cannot determine which subsystem observed each fact.

### Trust The Collector Artifact Without Revalidation

Pros:

- fewer checks at the execution-gate boundary.

Cons:

- an altered, stale, or cross-plan artifact could reach batch assembly,
- a serialized collector result becomes authority instead of evidence.

### Recommended: Revalidated Collector Attestation Plus Separate Operator Evidence

Pros:

- binds machine observations to the exact current execution plan,
- detects altered collector data, source-revision changes, duplicate paths,
  manifest-order drift, stale timestamps, and cross-plan use,
- prevents a preflight artifact from satisfying recovery, support, rollback,
  or approval requirements,
- preserves a side-effect-free, audit-friendly gate.

Cons:

- a plan or checkout change requires new collector output,
- callers must provide two explicit evidence inputs with distinct purposes.

## Final Recommendation Stack

1. Build a current, fingerprint-valid execution-plan artifact.
2. Collect checkout and manifest evidence through the non-destructive preflight
   collector.
3. Revalidate the collector artifact in
   `policyCompatibilityDeletionPreflightAttestation.mjs` against the current
   plan before it reaches the execution gate.
4. Supply recovery, approval, rollback, and support records separately as
   timestamped operator evidence bound to that plan fingerprint.
5. Revalidate the embedded plan, collector artifact, derived attestation, and
   operator evidence whenever a serialized gate is consumed.
6. Keep deletion exclusively in the later controlled apply boundary.

## Implementation Outcome

Implemented:

- Added `policyCompatibilityDeletionPreflightAttestation.mjs` as a modular,
  side-effect-free collector-to-gate verifier.
- Updated the execution gate to contract v3. It accepts
  `preflightEvidenceArtifact` and `operatorEvidence`; it no longer accepts a
  mixed `preflightEvidence` input.
- Revalidates the collector fingerprint, plan fingerprint and summary,
  collection time, checkout revision and cleanliness, manifest ordering and
  duplicate paths, runtime-evidence state, and reported side effects.
- Derives `preflightAttestation` only from the collector artifact and records
  it in the gate for consumer revalidation.
- Rejects operator evidence that tries to assert worktree, manifest, or nested
  collector state.
- Updated the controlled batch and replay paths to retain and revalidate both
  bounded evidence inputs.
- Added focused adversarial coverage for cross-plan, altered, duplicate,
  post-observation, dirty-checkout, and machine-claim substitution cases.

Not implemented here:

- no deletion, route removal, test removal, Git mutation, or storage change,
- no recovery, approval, rollback, or support decision derived from machine
  evidence,
- no embedded-runtime probe beyond validating the retained runtime reference.

## Next Step

Task 8R.16.4 is implemented in
[Policy Compatibility Deletion Pre-Apply Change Detection](policy-compatibility-deletion-pre-apply-change-detection.md).
Proceed with **8R.16.5 Embedded-Runtime Evidence Escalation Rules**.
