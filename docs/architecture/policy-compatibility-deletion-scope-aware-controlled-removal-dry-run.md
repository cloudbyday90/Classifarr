# Policy Compatibility Deletion Scope-Aware Controlled-Removal Dry Run

## Status

Complete. This document records Phase 3R, Task 3R.10.15.

## Decision

Named shared-test scopes now have a separate, read-only controlled-removal
adapter. It accepts only an exact server-derived named-scope identity from the
fingerprint-valid execution gate, revalidates the existing gate at dry-run
time, rechecks the retained test file before and after reading it, and derives
only offset-bounded proposed source edits.

The adapter cannot write source, delete a file, alter storage, write a manifest,
or run a Git mutation command. The existing whole-file removal adapter remains
the only component with file-deletion capability and still refuses
`remove_named_test_scope`.

## Problem

The execution gate can now observe distinct approved named scopes in one
retained test file. The file-removal path must not consume those entries because
it deletes whole files. A later scoped editor cannot safely trust a caller-
supplied entry, a path alone, or a raw text search: any of those could select an
unapproved assertion or widen removal to active native coverage.

## Research

OWASP transaction-authorization guidance requires the significant data of an
operation to be identifiable and authorization to be enforced server-side.
OWASP business-logic guidance recommends server-side derivation and explicit,
validated workflow states for sensitive operations. NIST SSDF recommends
integrating such practices in the implemented and tested development lifecycle.

- [OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
- [NIST SP 800-218 Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)

## Options Considered

### Reuse The Whole-File Apply Adapter

Pros: already has repository containment and a controlled apply workflow.

Cons: its only mutation is file deletion, so a shared test file could be
removed with native coverage. Rejected.

### Accept A Caller-Supplied Path And Source Snippet

Pros: small API and direct implementation.

Cons: caller data can drift from the approved manifest, snippets may match more
than one location, and the path does not identify one named scope. Rejected.

### Build A Gate-Bound Read-Only Source-Edit Adapter

Pros: derives scope identity from the approved manifest, revalidates freshness,
uses exact test declarations as edit boundaries, is platform-independent within
the configured repository root, and produces reviewable hashes and ranges with
no mutation capability.

Cons: supports only conservative `it` and `test` declarations with direct
single- or double-quoted names; unsupported syntax blocks rather than guessing.
Selected.

## Final Recommendation Stack

1. Accept only a `named_test_scope:<sha256>` identity, then rederive and match
   the selected manifest entry server-side. Never accept an entry body from the
   caller as authority.
2. Validate the serialized execution gate and rebuild it from its bounded
   artifact, preflight, recovery, stance, approval, and freshness evidence at
   the dry-run timestamp.
3. Require exactly one current preflight observation for the selected identity.
   Run the existing read-only checkout recheck both before and after source
   capture.
4. Re-read only a canonical repository-relative, regular, non-symlink file
   contained by the resolved repository root. Bound source reads to 5 MiB.
5. Require every approved source fragment to remain present. Treat source
   fragments as corroboration only, never as a deletion locator. Locate each
   edit by an exact, unique `it` or `test` name and block missing, duplicate,
   malformed, or overlapping declarations.
6. Emit only SHA-256 source and edit fingerprints, offsets, test names, and a
   result fingerprint. Do not expose a write operation or complete source text.

## Implementation Outcome

`policyControlledCompatibilityNamedScopeSourceEdit.mjs` is the pure ESM source
derivation module. It masks comments, string literals, templates, and regular
expressions while locating line-oriented test declarations, then uses a balanced
parenthesis scan to derive precise removal ranges. It supports only exact
direct string test names and preserves all source outside those ranges.

`policyControlledCompatibilityNamedScopeRemovalAdapter.mjs` is the small
orchestrator. Focused ESM modules own shared contracts, gate revalidation, exact
identity selection, safe source reading, and double pre-apply checkout rechecks.
Together they validate the original gate, create a fresh read-only gate
evaluation, bind the requested exact identity to one manifest entry and one
preflight observation, safely read the retained file, and return a dry-run
result. The result has no source text or mutation path.

The current four retirement named-scope candidates all derive successfully
against the checked-in source: their bounded edit counts are two, one, one, and
two respectively.

## Security Invariants

- The selected identity covers the action, path, source fragments, test names,
  dependency identity, deletion intent, and `wholeFileDeletion: false`.
- A stale, invalid, or not-ready execution gate blocks before the source is
  read.
- A changed checkout or retained file blocks before a dry run is accepted.
- A missing source fragment blocks; repeated free-text fragments do not widen
  the scope because exact test names alone determine edit ranges.
- Duplicate test-name declarations, malformed calls, trailing code, and
  overlapping edits fail closed.
- The service reports every side effect as false and retains no source-write,
  file-delete, storage-mutation, or Git-mutation capability.

## Validation

Focused tests cover successful multi-scope dry runs, unchanged file content,
exact identity binding, missing source fragments, duplicate test names, stale
gate revalidation, pre-apply failure before source read, parser resistance to
comment and string lookalikes, and absence of source text in the result. The
actual current inventory was also checked directly against its retained test
files.

## Next Task

Phase 3R, Task 3R.10.16: Compatibility Deletion Scope-Aware Removal Review
Artifact. Bind the accepted dry run, source snapshot fingerprints, exact edits,
and review metadata into a versioned review artifact. This next component must
remain read-only and must not introduce scoped-source mutation.
