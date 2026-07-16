# Policy Compatibility Deletion Execution Artifact Fingerprint

## Intent

The execution-plan artifact fingerprint binds a versioned compatibility-deletion
plan, its readiness evidence, manifest, replacement evidence, and side-effect
claims into one deterministic SHA-256 value. A collector artifact must name
that exact value before the execution gate can permit a later controlled
removal step.

The component is local, deterministic, and side-effect-free. It neither reads
the repository nor deletes files, writes storage, or invokes Git.

## Official-Source Research

- SLSA verification guidance requires consumers to verify artifact provenance
  against trusted expectations before use. The fingerprint gives the deletion
  gate a concrete artifact identity to verify rather than trusting isolated
  readiness fields.
- NIST SP 800-204D recommends verifiable CI/CD artifact provenance and
  attestation practices. Binding the plan and evidence summary makes a stale or
  substituted plan detectable at the final execution boundary.
- NIST IR 8397 describes automated verification and testing as a way to reduce
  inconsistent human checks. Deterministic canonicalization and focused tests
  make the bound fields repeatable and reviewable.

Sources:

- SLSA, Verifying Artifacts:
  <https://slsa.dev/spec/v1.2/verifying-artifacts>
- NIST SP 800-204D:
  <https://csrc.nist.gov/pubs/sp/800/204/d/final>
- NIST IR 8397:
  <https://csrc.nist.gov/pubs/ir/8397/final>

## Recommendations

### Bind A Bounded Canonical Projection

Fingerprint the exact fields that affect deletion safety: artifact status,
timestamps, evidence-bundle summary, execution-plan readiness, manifest,
replacement evidence, risks, and side-effect claims. Sort object keys, manifest
entries, and risks deterministically.

Pros:

- detects plan or manifest substitution,
- avoids false mismatches from JSON key order,
- keeps the security-relevant scope reviewable.

Cons:

- changing bound fields intentionally requires a new artifact and preflight.

### Require Versioned SHA-256 Metadata

Store the fingerprint version, algorithm, digest, and limited provenance
summary. Reject malformed metadata, digest mismatches, and provenance mismatch.

Pros:

- supports explicit future algorithm migrations,
- fails closed on malformed or altered artifacts,
- provides bounded diagnostics without exposing payloads.

Cons:

- downstream tools must use the current artifact contract.

### Bind Collector Evidence And Operator Decisions Separately

The execution gate must compare the collector fingerprint with the recomputed
artifact fingerprint before deriving checkout or manifest checks. It must bind
recovery, approval, and stances separately as operator evidence; a collector
artifact cannot supply those human decisions.

Pros:

- prevents detached or stale collector output from authorizing a different
  plan,
- prevents machine evidence from substituting for human approval or recovery,
- makes the final gate auditable,
- removes the raw-boolean readiness bypass.

Cons:

- operators must regenerate collector evidence after plan changes.

## Final Recommendation Stack

1. Build a v2 execution-plan artifact from current evidence.
2. Compute and persist its deterministic SHA-256 fingerprint.
3. Collect a fingerprinted preflight evidence artifact that names that
   fingerprint and records only machine-observed facts.
4. Bind separately timestamped operator evidence for recovery, approval, and
   final stances to the same fingerprint.
5. Recompute and validate both artifact bindings in the execution gate.
6. Reject stale, detached, malformed, altered, duplicate, or mismatched
   evidence before any later removal component is considered.

## Implementation Outcome

Implemented:

- `policyCompatibilityDeletionExecutionPlanArtifactFingerprint.mjs` builds a
  stable, bounded SHA-256 projection and validates digest and provenance.
- Execution-plan artifacts now use v2 and carry an `artifactFingerprint`.
- The execution gate and controlled batch artifact require the fingerprinted
  plan artifact, a matching collector artifact, and separate operator evidence.
- Focused tests cover canonical ordering, manifest mutation, malformed digest,
  and provenance mismatch.

## Next Step

Make the controlled compatibility path removal boundary consume one
evidence-bound execution artifact, rather than independently accepting an
execution plan and gate that could be from different evaluations.
