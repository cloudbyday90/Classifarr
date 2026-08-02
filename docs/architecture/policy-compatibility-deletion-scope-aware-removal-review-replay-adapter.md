# Policy Compatibility Deletion Scope-Aware Removal Review Replay Adapter

## Status

Complete. This document records Phase 3R, Task 3R.10.17.

## Decision

The review replay adapter is a separate, read-only ESM service. It refuses a
caller-supplied dry-run object, independently invokes the Phase 3R.10.15
scope-aware dry run against the current server-owned gate and source, and then
validates the Phase 3R.10.16 review artifact against that fresh result.

The original review-artifact digest remains exact and time-bound. Artifact v2
also records two SHA-256 provenance digests: a reviewer-metadata digest and a
scope-snapshot digest that excludes only the dry-run evaluation timestamp. The
replay adapter uses those two digests so a newly generated dry run can be
compared without treating its new evaluation time as source drift. It does not
accept the original dry run from a caller as proof.

## Problem

An artifact verified only against the dry-run object supplied by a caller can
be paired with stale source, stale gate evidence, a different named scope, or
changed review metadata. Comparing a fresh dry run to the complete original
artifact digest also fails for every legitimate replay because the evaluation
timestamp changes. The system therefore needs a narrow, server-derived replay
boundary with stable provenance for the reviewed facts and no mutation
capability.

## Research

OWASP recommends enforcing server-side workflow transitions and deriving
security-relevant state on the server rather than trusting client-provided
state. Its transaction-authorization guidance requires binding significant
transaction data to the authorization and invalidating it when that data
changes. NIST SSDF likewise calls for protecting software from unauthorized
changes and preserving evidence that supports secure release decisions. This
adapter applies those principles to an internal source-retirement workflow.

- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
- [OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
- [NIST SP 800-218, Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)

## Options Considered

### Trust A Caller-Supplied Dry Run

Pros: small implementation and no repeated source read.

Cons: permits snapshot substitution and makes the review independent of the
current source and gate. Rejected.

### Compare The Complete Original Digest To A Fresh Dry Run

Pros: preserves one digest and detects any value difference.

Cons: every fresh dry run has a new evaluation timestamp, so legitimate replay
always fails. Rejected.

### Regenerate Server State And Compare Stable Provenance Digests

Pros: detects changed scope, source, gate, edits, and reviewer context without
treating replay time as drift; keeps exact original-artifact verification
available when its original dry run is present; introduces no write capability.
Selected.

Cons: performs a bounded source read and gate revalidation for each replay.
The cost is intentional because review reuse is safety-critical.

## Final Recommendation Stack

1. Reject any `scopeRemovalDryRun` supplied to the replay API before attempting
   a source read or pre-apply check.
2. Regenerate Phase 3R.10.15 gate, preflight, source-read, pre-apply, and
   bounded-edit evidence from server-owned inputs.
3. Require the fresh dry run to be ready, risk-free, and internally valid
   before reviewing provenance.
4. Bind artifact v2 provenance to a canonical scope snapshot excluding only
   evaluation time and to normalized reviewer metadata. Compare both digests
   and their concise gate, source, result, scope, path, edit-count, and version
   fields to the fresh result.
5. Return only compact fingerprints, status, risk IDs, and review metadata.
   Never return source text or a mutation handle.
6. Keep all filesystem, storage, route, Git, and source writes outside this
   component. A successful replay is not authorization to change source.

## Implementation Outcome

`policyControlledCompatibilityNamedScopeRemovalReviewReplayAdapter.mjs` owns
the orchestration boundary and its shared module owns versioned statuses, risks,
read-only side effects, and next-step guidance. The adapter emits one of four
states: ready for future removal admission, blocked by caller input, blocked by
the fresh dry run, or blocked by the review artifact.

The v2 review-artifact projection now supplies canonical snapshot and
reviewer-metadata fingerprints. Full artifact validation remains available for
the original time-bound review. Replay validation deliberately checks the
freshly recomputed stable provenance instead, so a new evaluation time does not
hide or manufacture drift.

## Security Invariants

- A caller-provided dry-run object is an explicit blocker and is never read as
  evidence.
- The current dry run must revalidate the execution gate, selected scope,
  retained source, two pre-apply observations, and bounded source edits.
- Changed source, gate evidence, scope identity, path, result, edit count,
  reviewer, or reviewer reason invalidates replay.
- Duplicate selected identities fail during the fresh dry run before an
  artifact can be accepted.
- The result reports all write-related side effects as false and validates that
  invariant. No source text is emitted.

## Validation

Focused tests cover a successful independent replay, caller snapshot rejection
without a source replay, source drift, stale gate evidence, review-metadata
drift, duplicate selected scope identity, no source-text disclosure, and the
read-only result contract. The existing review-artifact tests now reuse the
same fixture and remain green.

## Next Task

Phase 3R, Task 3R.10.18: Compatibility Deletion Scope-Aware Controlled Apply
Adapter. Create the first mutation-capable component only after a ready replay.
It must own final replay, authenticated and explicitly scoped authorization,
single-use and expiry semantics, a final source fingerprint check, bounded
replacement limited to the reviewed edit ranges, durable rollback evidence,
and audit output. It must reject API-supplied replay or authorization results,
whole-file deletion, path widening, Git mutation commands, and any source
change after its final check.
