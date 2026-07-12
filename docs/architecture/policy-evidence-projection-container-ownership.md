# Policy Evidence Projection Container Ownership

## Status

Implemented as a projection-audit structural invariant.

## Problem

Policy evidence is stored in named bucket arrays and each entry also carries a
declared `bucketId`. Previous validation checked whether the containing bucket
allowed the entry's source and authority, but did not compare the entry's own
declaration with its container. A tampered or hand-assembled projection could
therefore place an entry in a different bucket than it declared.

That mismatch makes the bucket location ambiguous for summary counts, quality,
and fingerprints. It can also cause a restrictive or review fact to be
interpreted by the wrong downstream policy rule.

## Official Guidance Reviewed

- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  distinguishes syntactic validation from semantic validation and recommends
  server-side validation before application processing. Bucket ownership is a
  semantic relationship between two otherwise valid fields.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends enforcing business workflow invariants on the server. The audit
  therefore rejects a mismatch rather than relying on the caller or UI to keep
  related fields consistent.
- [NIST Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports defined, testable controls. The invariant is expressed as one stable
  audit risk and covered by a focused regression test.

## Decision

For every entry in `projection.buckets[bucketId]`, require:

```text
entry.bucketId === bucketId
```

The projection audit emits `projection_entry_bucket_mismatch` when the relation
does not hold. It does not relocate, rewrite, or silently discard the entry.
Construction remains server-owned and already places entries by declared bucket;
the audit protects downstream consumers from externally constructed or later
mutated projection objects.

## Implementation

- `server/src/services/policyEvidenceEngine.mjs` adds the
  `projection_entry_bucket_mismatch` risk and validates the entry declaration
  before source, authority, summary, quality, and fingerprint consumers rely on
  the projection.
- `server/src/__tests__/services/policyEvidenceEngine.test.mjs` mutates a valid
  identity entry to declare the compatibility bucket and verifies that the
  projection audit fails.

## Pros And Cons

Pros:

- Prevents bucket-local summary and quality calculations from trusting an
  internally contradictory entry.
- Keeps the ownership rule small, deterministic, and independent of UI state.
- Fails closed for tampered handoffs while preserving evidence for diagnosis.

Cons:

- The audit reports a mismatch but deliberately does not recover it; callers
  must rebuild or reject the invalid projection.
- This validates containment, not ordering. Canonical ordering remains a
  separate deterministic-processing concern.

## Final Recommendation Stack

1. Normalize individual entry fields at the shared boundary.
2. Require the declared bucket to equal the containing bucket during projection
   audit.
3. Validate source and authority permissions against that same trusted bucket.
4. Reject the complete handoff before summary, quality, fingerprint, intent, or
   automation processing accepts a structural mismatch.

## Security Outcome

- A caller cannot relabel an entry while leaving it in a more favorable bucket.
- Summaries, quality, and fingerprints receive a single unambiguous bucket
  location for each accepted entry.
- The audit exposes only bounded IDs and contains no provider payload, media
  title, operator text, API key, or quota state.

## Verification

- Focused evidence-engine, entry-identity, and fingerprint tests pass.
- The full server suite, documentation lint, security lint, test lint, and
  production naming audit are required before release.

## Next Step

Canonicalize ordering of distinct valid entries before fingerprinting. This
should preserve all provenance and avoid merging facts while making equivalent
input order produce one deterministic projection artifact.
