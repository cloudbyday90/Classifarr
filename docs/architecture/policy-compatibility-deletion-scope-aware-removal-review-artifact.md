# Policy Compatibility Deletion Scope-Aware Removal Review Artifact

## Status

Complete. This document records Phase 3R, Task 3R.10.16.

## Decision

An accepted scope-aware removal dry run now has a separate, versioned SHA-256
review artifact. The artifact binds one exact named-test-scope identity, the
fingerprint-valid execution-gate artifact, the current source and resulting
source fingerprints, each bounded edit range and expected-text hash, and
explicit reviewer context.

The artifact is not authorization to change source. Its validator is a
read-only admission check: it requires the original dry run to remain valid,
accepted, and fresh; recomputes the complete artifact fingerprint; and rejects
any changed scope, source snapshot, edit, gate provenance, or review metadata.
It has no filesystem, database, route, storage, Git, or source-write access.

## Problem

The Phase 3R.10.15 adapter derives a conservative, read-only edit proposal from
a fresh gate and retained-file snapshot. A later capability must not treat that
in-memory proposal, a client field, or a reviewer name alone as durable proof of
what was reviewed. Between review and any future operation, the named scope,
gate, source, result, offset, or reviewer context can change.

## Research

OWASP recommends deriving security-relevant data on the server and enforcing
explicit, validated server-side workflow transitions. Its transaction guidance
also recommends binding significant transaction data to the authorization and
failing closed when it is altered. GitHub's artifact-attestation guidance
separately reinforces that provenance is useful only when verification is part
of the consuming workflow. These principles apply here as internal integrity
controls, not as a claim that a local SHA-256 digest is a signed supply-chain
attestation.

- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
- [OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
- [GitHub Artifact Attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations)
- [GitHub: Using Artifact Attestations To Establish Build Provenance](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations)

## Options Considered

### Trust The Existing Dry-Run Object

Pros: no additional implementation and minimal data handling.

Cons: a changed scope, gate, source hash, edit offset, or reviewer context is
indistinguishable from the reviewed state. Rejected.

### Persist A Mutable Approval Record Before A Stable Contract Exists

Pros: a future mutating path could query the approval directly.

Cons: introduces schema, lifecycle, authorization, expiration, and concurrency
semantics before there is a replay-based admission boundary. It would also make
a prematurely broad approval mechanism part of the product contract. Rejected.

### Build A Versioned, Deterministic, Read-Only Review Artifact

Pros: creates a bounded integrity contract now, makes the reviewed facts
auditable and independently verifiable, uses no secret material, and preserves
the no-mutation boundary. A subsequent replay component can regenerate the
snapshot instead of trusting caller data. Selected.

Cons: SHA-256 integrity alone is not identity or authorization. Callers must
still obtain reviewer context through the product's future server-owned
authorization path, and a future admission component must regenerate the dry
run against the current source before applying anything.

## Final Recommendation Stack

1. Build the artifact only from the complete Phase 3R.10.15 result and reviewer
   metadata. Bind the complete named-scope identity, path, gate artifact hash,
   source and result hashes, source-fragment observations, and all ordered edit
   ranges and expected-text hashes.
2. Require a named reviewer, non-empty reason, and valid review timestamp. A
   review cannot predate its dry run.
3. Treat the dry run as short-lived: validation defaults to a 15-minute maximum
   age and permits a caller to apply a stricter non-negative bound. Expired
   snapshots fail closed rather than silently becoming current.
4. Revalidate the original dry-run contract, exact named-scope identity, two
   pre-apply checks, source/result hash cohesion, non-overlapping edit ranges,
   duplicate scope members, and gate evidence before trusting the artifact.
5. Recompute both SHA-256 digest and concise provenance. Reject substitution,
   altered edit data, source drift, gate drift, malformed artifacts, and changed
   reviewer context.
6. Keep the module pure and read-only. Do not add a route, persistence,
   filesystem access, source text output, deletion, source rewrite, storage
   mutation, or Git command.

## Implementation Outcome

The review-artifact service is split into ESM shared-normalization,
canonical-projection, and validation modules. The projection contains only
bounded review facts, then hashes it with SHA-256. The public artifact exposes
the digest and compact provenance only; it does not expose retained test source
text.

Validation separately checks dry-run admission, freshness, reviewer metadata,
artifact structure, recomputed fingerprint, and provenance. It therefore fails
closed when the artifact is paired with a different source snapshot or scope,
when reviewed edit data changes, when duplicate scope members appear, or when
the dry-run snapshot ages out. The service introduces no capability to mutate
anything.

## Security Invariants

- Exactly one `named_test_scope:<sha256>` identity is accepted and it must match
  the preflight identity.
- The dry run must be the ready, risk-free Phase 3R.10.15 contract with an
  intact revalidated gate and two successful pre-apply checks.
- Source and result hashes, edit count, ordered non-overlapping offsets, exact
  test names, and every expected-text SHA-256 hash are fingerprint-covered.
- A scope's test-name members must be unique; duplicates fail closed.
- Review context is fingerprint-covered and cannot predate the dry run.
- The validator returns findings rather than granting authority. It does not
  read or write source, delete a file, alter storage, invoke Git, or expose a
  source-mutation path.

## Validation

Focused tests cover a valid two-edit review artifact, source-snapshot artifact
substitution, changed edit hashes and offsets after review, stale snapshot
rejection, duplicate scope-member rejection, gate and source-observation
cohesion, missing reviewer context, and source-text non-disclosure. The adjacent
Phase 3R.10.15 adapter tests remain green.

## Next Task

Phase 3R, Task 3R.10.17: Compatibility Deletion Scope-Aware Removal Review
Replay Adapter. Create a separate read-only adapter that independently reruns
the Phase 3R.10.15 source and gate checks, then validates the Phase 3R.10.16
artifact against that fresh result. It must never accept a caller-supplied dry
run as proof and must remain incapable of source, file, storage, or Git
mutation.
