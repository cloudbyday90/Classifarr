# Policy Evidence Projection Canonical Ordering

## Status

Implemented as a projection-construction, projection-audit, and fingerprint
invariant.

## Problem

Distinct evidence facts can arrive in different order from otherwise equivalent
library, operator, or metadata inputs. Array order is preserved by JSON
serialization, so an order-sensitive projection could produce a different
fingerprint even though the evidence, source authority, quality, and summary
mean the same thing.

Ordering must not merge facts or use presentation labels as the source of truth.
Different source and authority provenance stays meaningful even where labels
match.

## Official Guidance Reviewed

- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-derived security-relevant values, explicit invariants, and
  tests for ordering-sensitive business rules. Classifarr derives canonical
  order server-side and audits the received projection rather than trusting
  caller order.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends semantic validation before application processing. Canonical
  ordering operates on the shared normalized entry identity, not raw input.
- [NIST Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  recommends integrated, verifiable secure-development practices. Ordering is
  implemented in a reusable helper with focused construction, audit, and
  fingerprint tests.

## Decision

Order entries in each evidence bucket by the complete canonical semantic
identity:

```text
bucketId, sourceId, authoritySourceId, key, label, value, count,
confidence, reasonCode, observedAt, stale
```

The comparator compares the normalized identity key using code-unit string
ordering, avoiding locale-sensitive display ordering. Construction sorts every
bucket before calculating summary and quality. The projection audit emits
`projection_entry_order` for a noncanonical entry sequence. Fingerprinting
independently canonicalizes bucket arrays so equivalent projection content has
one fingerprint even if an external caller supplied a different order.

No entries are removed, merged, aggregated, or relabeled by ordering.

## Implementation

- `server/src/services/policyEvidenceEntryIdentity.mjs` exports the semantic
  comparator, immutable bucket-entry sorter, and out-of-order detector.
- `server/src/services/policyEvidenceEngine.mjs` sorts projection buckets before
  summary and quality generation and audits noncanonical entry order.
- `server/src/services/policyEvidenceFingerprint.mjs` canonicalizes evidence
  bucket arrays within the fingerprint payload.
- Focused identity, evidence-engine, and fingerprint tests verify ordering,
  provenance preservation, audit failure for a reordered projection, and hash
  stability for equivalent content.

## Pros And Cons

Pros:

- Equivalent evidence input order yields the same projection and fingerprint.
- Stable ordering makes correlation, audit, and regression tests reliable.
- The shared comparator prevents summary, quality, and fingerprint paths from
  adopting competing order semantics.
- Source and authority differences remain visible and independently sortable.

Cons:

- Canonical semantic order is not a user-facing relevance ranking.
- Received noncanonical projections fail audit instead of being silently
  reordered, so callers must rebuild invalid artifacts.
- Ordering does not resolve semantic near-duplicates; those remain separate
  evidence facts by design.

## Final Recommendation Stack

1. Normalize individual fields and validate bucket ownership first.
2. Deduplicate exact canonical identities without merging provenance.
3. Sort remaining entries using the complete canonical identity before summary
   and quality computation.
4. Audit ordering in received projections and independently canonicalize bucket
   arrays when producing correlation fingerprints.

## Security Outcome

- A changed input order cannot manufacture a new evidence correlation handle.
- Downstream engine behavior cannot depend on a caller-controlled array order.
- Audit records only bounded bucket IDs and indexes; no titles, provider
  payloads, operator text, API keys, or quota state are added.

## Verification

- Focused evidence identity, evidence engine, and fingerprint tests pass.
- The full server suite, documentation lint, security lint, test lint, and
  production naming audit are required before release.

## Next Step

Add a structural projection snapshot contract that verifies the generated
summary, quality, fingerprint, canonical ordering, duplicate state, and bucket
ownership as one complete immutable handoff before intent evaluation.
