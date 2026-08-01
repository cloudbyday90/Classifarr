# Policy Compatibility Execution-Manifest Named-Scope Entry Model

**Status:** Complete

**Roadmap task:** Phase 3R, Task 3R.10.8

**Decision date:** 2026-08-01

## Decision

Shared native test files require a first-class execution-manifest entry that
names the exact compatibility-only scope to retire. A scope is represented by a
canonical repository-relative path, exact source-text fragments, exact test-name
fragments, and an explicit `wholeFileDeletion: false` boundary.

The existing file-removal adapter remains restricted to `delete_file` and
`remove_test`. It refuses `remove_named_test_scope` even when apply mode is
enabled. This task adds no scoped-source rewriter, no file deletion capability,
no storage mutation, and no manifest persistence.

## Official-Source Research

- NIST SSDF recommends integrating secure-development practices into the
  lifecycle to reduce vulnerability risk and impact. The model therefore uses
  explicit, validated scope evidence rather than inferring a whole-file action
  from a shared test path.
- GitHub's artifact-attestation guidance describes provenance as evidence of
  what produced an artifact and stresses that verification is required before it
  provides security value. The versioned SHA-256 projection now binds every
  scope fragment and the no-whole-file boundary.
- GitHub also notes that an attestation does not itself prove that content is
  safe. The model consequently does not grant removal authority; it records an
  exact candidate scope for a later dedicated execution component.

Sources:

- [NIST SP 800-218 Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
- [GitHub Docs: Artifact Attestations](https://docs.github.com/en/enterprise-cloud%40latest/actions/concepts/security/artifact-attestations)
- [GitHub Docs: Using Artifact Attestations](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations)

## Options Considered

### Remove The Shared Test File

Pros:

- uses the existing file-removal adapter,
- requires no new manifest shape.

Cons:

- deletes active native regression coverage,
- cannot distinguish one retiring assertion from the rest of the test file,
- violates the native ownership boundary.

### Use An Unstructured Text Note

Pros:

- quick to record,
- no contract-version update.

Cons:

- not fingerprint-bound,
- cannot be matched to a reconciliation target deterministically,
- permits ambiguous or widened scope later.

### Adopt Exact Fingerprinted Named-Scope Entries

Pros:

- binds path, source fragments, test names, and no-whole-file intent,
- rejects incomplete or widened scope evidence,
- preserves the existing file-only executor as a separate authority boundary,
- allows the reconciliation binding to prove exact coverage without execution.

Cons:

- advances the plan and artifact contracts to v2 and v3 respectively,
- requires a later dedicated scoped-source transformation component before any
  shared-test assertion can be removed.

## Final Recommendation Stack

1. Use `remove_named_test_scope` only with an exact canonical test-file path.
2. Require at least one source-text fragment and one test-name fragment.
3. Require `wholeFileDeletion: false`; reject scope metadata attached to a
   file-level action.
4. Bind scope fields in the deterministic artifact fingerprint and invalidate
   the artifact when any field changes.
5. Keep the file-removal adapter restricted to whole-file actions.
6. Build later scoped-source transformation behavior in a separate component
   with its own authorization and source-precondition checks.

## Implementation Outcome

Implemented:

- `policyCompatibilityDeletionExecutionActions.mjs` owns the shared ESM action
  identifiers, including `remove_named_test_scope`, without introducing import
  cycles.
- `policyCompatibilityDeletionExecutionManifestEntry.mjs` normalizes and
  validates named-scope entries independently from plan construction.
- The deletion execution plan is now v2 and accepts only validated named-scope
  additions. Invalid scope identity blocks plan readiness as manifest evidence.
- The wrapper artifact is now v3 and its fingerprint is v2. The fingerprint
  binds entry kind, path, component, exact source fragments, exact test-name
  fragments, and `wholeFileDeletion`.
- Retirement binding now compares both named test and source fragments before
  treating a scope target as covered.
- Focused coverage proves that a scope action cannot delete a retained file,
  even when the file-removal adapter is configured to apply changes.

## Security Outcome

- A shared test file cannot be converted into an approved whole-file deletion
  by adding scope metadata.
- Missing or altered scope fragments fail execution-plan or artifact-fingerprint
  validation.
- A complete read-only manifest can bind the four shared test scopes exactly,
  but cannot authorize or execute a deletion.
- Existing file-removal authority rejects the new action, preserving a strict
  separation between file deletion and future scoped source transformation.

## Next Step

Proceed to **Phase 3R, Task 3R.10.9: Compatibility Retirement Candidate Plan
Projection**. Derive a read-only candidate plan input from the source-backed
reconciliation targets, including exact named-scope entries and their native
successor evidence. Do not write a manifest, remove source, or change storage.
