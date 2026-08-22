# Policy Compatibility Deletion Release Review Artifact

Status: implemented. The artifact is a review handoff only; it does not
approve a release, authorize deletion, modify storage, or execute Git or Docker
commands.

## Objective

The compatibility-deletion evidence pipeline already evaluates a strict,
context-bound release-prerequisite attestation. Its remaining gap was a safe
handoff to a human reviewer: copying individual booleans or a free-form JSON
record makes it easy to review the wrong evidence window or accidentally imply
approval.

This component produces one bounded review artifact from a current
execution-plan evidence bundle. It carries the exact release-prerequisite
context fingerprint, a separate SHA-256 fingerprint of its bounded source
summary, the source status/risk identifiers, a five-minute review deadline, and
the three required decisions. It intentionally contains no subject, approval,
approval status, policy content, backup content, credentials, installation
configuration, or command to remove a path.

## Official-Source Research

Research was performed on 2026-08-22 using the current official sources below.

- [GitHub artifact attestations](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations)
  requires build provenance to be established for an artifact and supports
  later verification. The review artifact follows the same producer/consumer
  split: its SHA-256 fingerprint detects drift but is not represented as a
  signature or an approval.
- [GitHub attestation verification](https://docs.github.com/en/rest/repos/attestations)
  says a useful attestation must verify signatures and timestamps and validate
  signer identity. The local artifact therefore never pretends a local hash
  authenticates a release operator; authenticated approval remains a later
  release/execution-gate responsibility.
- [SLSA provenance v1.1](https://slsa.dev/spec/v1.1/provenance) treats
  externally controlled inputs as untrusted and requires consumers to verify
  them. The artifact uses a minimal, fixed projection and rejects unexpected
  artifact fields rather than accepting an unbounded evidence blob.
- [OWASP Transaction Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
  recommends server-side enforcement, protected transaction data, distinct
  authorization, and bounded authorization lifetime. The artifact expires with
  its source evidence and is structurally unable to carry an authorization.
- [OWASP Logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends attributable, bounded audit data while excluding secrets and
  sensitive data. The artifact retains only contract versions, timestamps,
  fixed status/risk IDs, and SHA-256 fingerprints.
- [GitHub Actions security hardening](https://docs.github.com/en/code-security/tutorials/secure-your-organization/protect-against-threats)
  recommends explicit least-privilege workflow permissions and pinning actions
  to full commit SHAs. The related local application of Dependabot PR #511
  preserves that control while advancing CodeQL to its reviewed v4.37.7 commit.

## Options Considered

### Have Reviewers Hand-Create Attestation JSON

Pros:

- no additional implementation;
- a reviewer can use the existing evidence contract directly.

Cons:

- easy to copy a context fingerprint, timestamp, or prerequisite status from
  an unrelated evidence window;
- does not give reviewers a compact explanation of what the attestation binds;
- a template that contains accepted statuses can be mistaken for an approval.

Decision: rejected.

### Generate a Complete Release-Prerequisite Attestation Locally

Pros:

- fewer handoff steps;
- superficially easy to feed to the existing evidence collector.

Cons:

- a local command cannot authenticate a release operator;
- allowing a command line to emit `verified` or `approved` would make the
  approval boundary forgeable;
- conflicts with the existing fail-closed maintenance-runner design.

Decision: rejected.

### Generate a Fingerprinted, Non-Approving Review Artifact

Pros:

- binds the exact, fresh source evidence and release-prerequisite context;
- makes required human decisions explicit without claiming they occurred;
- keeps the review surface small and excludes secrets and raw policy data;
- can be independently checked for added fields, context mismatch, stale
  evidence, source-summary tampering, and side effects.

Cons:

- the reviewer must still create authenticated release-prerequisite evidence
  through the later controlled approval boundary;
- source evidence must be recollected if the five-minute review window expires.

Decision: selected.

## Design

```text
Read-only evidence bundle
        |
        v
Release review artifact generator
  - verifies freshness and context fingerprint
  - writes one new JSON file only below .tmp
  - creates no approval or execution authority
        |
        v
Authenticated release review / protected environment
        |
        v
Existing release-prerequisite evaluator and later execution gate
```

The service is split into a pure ESM contract module and a narrow ESM CLI
runner. The contract rebuilds the context fingerprint from its bounded source
projection and creates an independent SHA-256 artifact fingerprint. The runner
requires a JSON input inside the checkout and creates exactly one new JSON file
under `.tmp`; path traversal, symlink escapes, reused output names, non-JSON
inputs, and unknown options fail closed. The artifact leaves all side-effect
flags false and validates that its own schema cannot contain `approvedBy`, an
attestation, or any other unrecognized field.

Use it immediately after a fresh maintenance evidence collection:

```powershell
npm run policy:compatibility-deletion-release-review-artifact -- `
  --input .tmp/policy-storage/current-execution-plan-evidence.json `
  --output .tmp/release-review/compatibility-deletion-review.json
```

An exit code of `0` means the artifact is a valid request for review, not that
the release or deletion is approved. Exit code `1` emits a bounded diagnostic
when its source is stale or context-inconsistent. Exit code `2` means the
input/output contract was invalid and no artifact was written.

## Final Recommendation Stack

1. Recollect revision-matched, read-only execution-plan evidence immediately
   before review; do not reuse a stale review request.
2. Generate this artifact and review its source status, risk IDs, deadline, and
   context fingerprint before any attestation is considered.
3. Record the three decisions only through an authenticated release-review
   boundary with a named `release_operator`; do not treat the local artifact or
   a chat acknowledgement as proof of approval.
4. Use a protected GitHub environment with required reviewers and no
   self-review if the repository has more than one authorized release operator.
   Keep the environment configuration out of application data.
5. Verify the tagged image provenance/attestation and use pinned GitHub Action
   commits with minimal workflow permissions before publishing a release.
6. Keep the later execution gate, fresh preflight evidence, and protected apply
   workflow mandatory; this artifact only improves the review handoff.

## Implementation Outcome

Implemented:

- `policyCompatibilityDeletionReleaseReviewArtifact.mjs` owns review-state
  evaluation and validation, while the separate
  `policyCompatibilityDeletionReleaseReviewArtifactFingerprint.mjs` owns the
  canonical bounded projections and both SHA-256 fingerprints.
- `policyCompatibilityDeletionReleaseReviewArtifactRunner.mjs` enforces the
  non-interactive, checkout-contained input/new-`.tmp`-output CLI contract.
- `policy:compatibility-deletion-release-review-artifact` exposes the command
  without adding a CommonJS path or a database/API mutation.
- Focused service and runner tests cover a valid request, stale-source
  diagnostic, context mismatch, output-path rejection, approval-field
  injection, fingerprint tampering, and side-effect reporting.
- Dependabot PR #511 was applied locally without merge: CodeQL init/analyze
  and SARIF upload now use the reviewed v4.37.7 full commit SHA.

Not implemented:

- no local generation of a valid release-prerequisite attestation;
- no identity authentication, GitHub environment configuration, or release
  publication;
- no automatic compatibility-path deletion, backup restore, database write, or
  application restart.

## Next Task

Add a protected release-review workflow that accepts only the fresh artifact's
context fingerprint, authenticates the named reviewer through GitHub, and
records a signed/verified attestation for the exact release candidate. It must
remain separate from the maintenance collector and should verify the image
provenance before exposing the attestation to the execution-plan pipeline.
