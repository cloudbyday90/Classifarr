# Policy Compatibility Deletion Release-Prerequisite Evidence Contracts

## Intent

Compatibility-deletion readiness previously accepted three reviewed-input
booleans: rollback support, support diagnostics, and deletion-manifest
approval. A boolean has no version, subject, freshness, or integrity binding,
so it cannot demonstrate which release context was reviewed.

This component replaces those values with one bounded, versioned attestation
contract. It remains separate from automatic native policy operation and the
database-owned backup/restore verification. It can only allow later release
planning to continue; it cannot perform a restore, provide support, approve a
manifest, remove compatibility code, mutate policy data, or run Git commands.

## Ordering Constraint

The current execution-plan artifact is created only after the evidence bundle
is ready. Therefore, requiring its fingerprint before readiness creates a
circular dependency: no artifact can exist until the attestation is accepted,
but the attestation cannot be accepted until that artifact exists.

The selected contract binds to a deterministic **release-prerequisite context
fingerprint** instead. The context is a minimal canonical projection of the
current policy inventory, reconciliation-state inventory, native-runtime
cutover verification, compatibility-deletion gates, backup/restore evidence,
and residual-reference state. The later execution-plan artifact retains that
context through its existing artifact fingerprint. This preserves a direct,
tamper-evident chain without pretending that a future artifact already exists.

## Official-Source Research

Research was verified on 2026-07-25 against official sources current for the
June 2026 design window.

- [NIST SP 800-218 SSDF](https://csrc.nist.gov/pubs/sp/800/218/final) defines
  secure development practices, including provenance and traceability for
  release components. The contract binds a compact, deterministic context
  rather than an unstructured review claim.
- [OWASP Transaction Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
  requires server-side enforcement and rejects client-controlled authorization
  outcomes. The server evaluates every attestation; a client boolean is never
  trusted as an approval result.
- [OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  recommends default deny, server-side checks, and automated authorization
  tests. Missing, stale, malformed, unknown-subject, or mismatched evidence
  remains blocked.
- [OWASP Logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends bounded, attributable events while excluding sensitive detail.
  The evidence stores fixed status IDs, a constrained subject identifier, and
  a fingerprint; it excludes support transcripts, backup content, credentials,
  and raw policy data.

## Contract

The release-prerequisite evidence record has:

- a version and ISO-8601 generation time;
- a constrained, explicit release-review subject;
- a SHA-256 context fingerprint with fixed algorithm and version;
- exactly one fixed-status attestation for each prerequisite:
  `rollback_support`, `support_diagnostics`, and
  `deletion_manifest_approval`.

Only `verified` is accepted for rollback support and support diagnostics; only
`approved` is accepted for deletion-manifest approval. Any duplicate,
unknown, omitted, stale, future-dated, malformed, or context-mismatched
attestation blocks readiness. The contract recognizes only the fixed
`release_operator` subject type and a bounded identifier shape; an
unrecognized subject type or malformed identifier is blocked. It does not
claim to authenticate that subject by itself. Existing authenticated
execution-gate approval remains the authority for destructive release
execution.

## Options Considered

### Retain Reviewed Booleans

Pros:

- smallest input shape;
- no migration work.

Cons:

- no freshness, subject, or context binding;
- a copied value can authorize an unrelated release context.

Decision: rejected.

### Bind Attestations Directly To The Execution-Plan Artifact

Pros:

- references the final planned action directly.

Cons:

- circular before readiness because the artifact requires the attestation;
- encourages a blocked artifact to be treated as an approval target.

Decision: rejected for pre-plan readiness.

### Bind Attestations To A Canonical Pre-Plan Context

Pros:

- eliminates the ordering cycle;
- detects evidence drift, replacement, and stale review;
- flows into the later artifact fingerprint and execution gate;
- supports automatic collection of database-owned facts without automating
  human release decisions.

Cons:

- creates one additional small evidence contract;
- requires reviewers to refresh the attestation when material readiness
  context changes.

Decision: selected.

## Final Recommendation Stack

1. Derive a canonical, SHA-256 release-prerequisite context from current
   bounded evidence only.
2. Admit one versioned attestation record with an explicit constrained subject
   and exactly three fixed prerequisite entries.
3. Enforce freshness, subject shape, context binding, and status semantics in
   one server-side ESM service; default deny on every failure.
4. Replace raw booleans at the CLI boundary with strict allowlisted input.
5. Include only the compact attestation summary in the evidence bundle and
   maintenance diagnostic; retain detailed approval authority at the later
   execution gate.
6. Keep backup/restore verification database-owned and do not make regular
   policy automation depend on this compatibility-code retirement evidence.

## Implementation Outcome

Implemented in this task:

- `policyCompatibilityDeletionReleasePrerequisiteEvidence.mjs` derives the
  canonical context and evaluates contract version, subject shape, timestamps,
  exact prerequisite set, statuses, and fingerprint server-side.
- deletion readiness and execution-plan evidence accept only
  `releasePrerequisiteEvidence`; they no longer accept the three legacy
  release booleans.
- execution-plan evidence retains a bounded contract summary and independently
  re-evaluates it before validating a ready bundle.
- the CLI uses a strict input allowlist and rejects legacy booleans rather than
  silently discarding them.
- focused tests cover a valid contract and missing, legacy, stale, mismatched,
  duplicate, unrecognized-subject-type, and unexpected-field failures.

Not implemented:

- no automatic restore, support operation, approval, or deletion;
- no database migration or policy-runtime change;
- no replacement of the authenticated execution-gate approval boundary.

## Verification Plan

Focused tests prove that ready evidence is accepted only when all three
attestations, the subject, timestamps, and context fingerprint agree. They
reject legacy booleans, missing or duplicate prerequisites, unrecognized
subject types, malformed or stale fingerprints, and unexpected fields.
Existing bundle, CLI, and execution-artifact tests prove the contract carries
through the later fingerprint chain without exposing raw evidence.
