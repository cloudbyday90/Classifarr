# Policy Evidence Projection Deduplication

## Status

Implemented as a projection-construction and projection-audit invariant.

## Problem

Evidence inputs can repeat the same normalized fact through duplicated source
records or repeated values in a bounded input collection. If the projection
keeps every copy, summary counts, evidence quality, and the evidence fingerprint
can change without any new information. That creates false confidence and makes
equivalent inputs produce different downstream handoffs.

The solution must not merge facts merely because their labels match. A fact from
two distinct sources or authorities is still meaningful provenance and must
remain separate.

## Official Guidance Reviewed

- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends allow-list validation and canonicalization before an application
  uses data. The projection therefore evaluates duplication only after the
  shared entry normalizer has produced bounded canonical fields.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends enforcing workflow rules on the server and considering repeated
  requests or actions as business-logic risks. The server owns both duplicate
  suppression during construction and duplicate detection during audit.
- [NIST Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  emphasizes defined, verifiable secure development practices. The semantic
  identity helper is a small reusable contract with focused tests rather than
  duplicated comparison logic in summaries, quality, or fingerprint code.

## Decision

Treat two entries as duplicates only when every bounded semantic field is
equal:

```text
bucketId
sourceId
authoritySourceId
key
label
value
count
confidence
reasonCode
observedAt
stale
```

The builder retains the first occurrence and suppresses later exact matches.
The projection audit reports duplicate canonical entries in externally
constructed or tampered projections. It does not alter the projection during
audit.

Different source IDs, authority source IDs, bucket IDs, values, counts,
confidence, reason codes, timestamps, or freshness flags are never merged.
Counts are not aggregated. This keeps authority and observation provenance
explicit while preventing an exact repeated fact from changing the decision
surface.

## Implementation

- `server/src/services/policyEvidenceEntryIdentity.mjs` defines the canonical
  semantic key and duplicate-index helper.
- `server/src/services/policyEvidenceEngine.mjs` suppresses exact duplicates
  while it adds normalized entries and emits the stable
  `projection_duplicate_entry` audit risk for unsafe constructed projections.
- `server/src/__tests__/services/policyEvidenceEntryIdentity.test.mjs` verifies
  equivalent and distinct semantic keys.
- `server/src/__tests__/services/policyEvidenceEngine.test.mjs` verifies that
  duplicate inputs retain one fact, produce the same fingerprint as the unique
  input, preserve distinct authority provenance, and are rejected when later
  injected into a projection.

## Pros And Cons

Pros:

- Prevents duplicate records from inflating bucket summaries or quality.
- Makes exact-equivalent inputs produce the same correlation fingerprint.
- Preserves source and authority distinctions needed for safe intent and
  automation decisions.
- Audits hand-assembled or tampered projection instances instead of trusting
  the constructor alone.

Cons:

- It intentionally does not reconcile near-duplicates with different bounded
  facts; that requires an explicit source-specific normalization decision.
- Retaining the first exact occurrence preserves current input order for the
  surviving entry, so canonical ordering is a separate concern.

## Final Recommendation Stack

1. Normalize and validate individual evidence fields at the shared entry
   boundary.
2. Deduplicate only exact canonical semantic identities during projection
   construction.
3. Audit duplicate canonical identities in any projection received by later
   engines.
4. Preserve distinct source and authority provenance; do not aggregate or
   infer equivalence from display labels.

## Security Outcome

- Evidence counts and quality cannot be inflated by exact repeated canonical
  facts.
- A caller cannot safely bypass construction by submitting a projection with
  duplicate canonical entries.
- The contract contains no provider payloads, operator text, media titles, API
  keys, or quota state beyond already bounded evidence fields.

## Verification

- Focused evidence identity, evidence engine, and fingerprint tests pass.
- The full server suite, documentation lint, security lint, test lint, and
  production naming audit are required before release.

## Next Step

Enforce projection container ownership: each entry's declared `bucketId` should
match the bucket array containing it. This closes the remaining structural gap
before deterministic ordering work, summaries, quality, and fingerprints trust
the entry location.
