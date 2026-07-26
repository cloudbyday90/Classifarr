# Compatibility-Deletion Execution-Plan Artifact Binding

## Purpose

The compatibility-code retirement workflow may authorize a bounded removal
batch only from current, verified evidence. This document defines the direct
binding between the current compatibility-deletion execution-plan artifact and
the runtime, authorization, completion, and replay evidence that follows it.

The change is intentionally narrow. It does not create a second approval
system, run a command, mutate a checkout, remove a file, or change routine
native policy automation.

## Research

The design uses three complementary, official guidance sources reviewed in
June 2026:

- [NIST SP 800-218 SSDF](https://csrc.nist.gov/pubs/sp/800/218/final)
  recommends integrating secure development practices throughout the delivery
  lifecycle. For this workflow, durable evidence and deterministic validation
  make the destructive-operation boundary auditable.
- [OWASP Transaction Authorization Cheat
  Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
  recommends server-side authorization bound to the significant transaction
  data, with final execution checks and invalidation when data changes. The
  execution-plan digest is the significant data for compatibility removal.
- [SLSA artifact verification guidance](https://slsa.dev/spec/v1.2/verifying-artifacts)
  requires a verified statement subject to match the artifact digest. The same
  principle applies here: later evidence must name the digest of the exact
  artifact it evaluates, not merely a structurally similar plan.

## Options Considered

### Review-Fingerprint-Only Binding

Use the removal-review fingerprint as the only downstream link.

Pros:

- No evidence schema change.
- The review artifact already includes execution-plan provenance.

Cons:

- Runtime and completion evidence do not independently name the plan artifact.
- A consumer must recover and trust an indirect provenance chain to detect a
  cross-plan replay.

### One Shared Mutable Current-Plan Record

Store a globally mutable current-plan pointer and make every step dereference
it.

Pros:

- A short consumer payload.

Cons:

- Adds state, concurrency, retention, and recovery concerns.
- Makes a previously produced evidence record depend on a later mutable value.
- Does not improve platform portability or deterministic offline replay.

### Direct Digest Binding At Each Evidence Boundary

Retain the SHA-256 fingerprint of the applied execution-plan artifact in the
runtime evidence and compare it to the verified current artifact at
authorization and completion replay.

Pros:

- Detects a cross-plan artifact even if the review fingerprint is internally
  consistent.
- Preserves local, deterministic, platform-agnostic replay.
- Requires no database table, scheduler, provider, or media-server call.

Cons:

- Version 2 runtime evidence is intentionally incompatible with older evidence
  that omitted the plan digest.
- Test fixtures and exporters must retain one additional bounded field.

## Recommendation Stack

1. Require direct plan-artifact fingerprints in post-removal runtime evidence.
2. Resolve the plan artifact through the existing fingerprint-valid source
   before authorizing another batch.
3. Compare the runtime evidence fingerprint to that source and block on absent
   or mismatched values.
4. Re-check the same direct binding in next-batch authorization-artifact
   integrity before completion audit or replay accepts it.
5. Retain the existing review fingerprint and path-state checks; they cover
   separate review and checkout facts and must not be replaced by this binding.

## Implemented Contract

`policy.post_removal_runtime_evidence_artifact.v2` derives
`provenance.executionPlanArtifactFingerprint` from the applied removal-review
context. Validation requires a SHA-256 digest alongside the existing removal
review digest.

`policy.next_compatibility_removal_batch_authorization.v4` resolves the current
execution-plan artifact via the existing path-state source, then requires the
runtime evidence digest to match that exact artifact. The authorization output
retains the value in both runtime and post-removal summaries for deterministic
replay.

Authorization-artifact integrity repeats the direct comparison before it
accepts an artifact as authorizable. Completion evidence already invokes that
integrity check and retains the verified execution-plan wrapper and its digest,
so completion audit and artifact replay inherit the same fail-closed boundary.

## Security And Operations

- A missing, malformed, stale-version, or mismatched digest blocks downstream
  authorization. It cannot be repaired by a client flag or an alternate nested
  plan object.
- Artifact validation and comparisons occur in process and are deterministic;
  they make no provider, quota, media-server, database, Docker, filesystem,
  Git, or network call.
- The change is installation-agnostic. It binds artifacts supplied by the
  running workflow rather than a developer checkout, local paths, policy
  names, library names, or environment-specific configuration.
- Existing review-artifact, path-state, runtime-verification, and completion
  fingerprint checks remain mandatory. A digest match alone never authorizes
  file deletion.

## Verification

Focused coverage proves that runtime evidence without a plan digest is invalid,
that another plan's digest blocks authorization, and that authorization
artifact integrity detects the same mismatch during replay. The complete server
unit suite, type check, lint, and container smoke checks remain release gates.
