# Policy Library Metadata Evidence Collector

## Status

Implemented as the read-only normalized-metadata collector for the policy
evidence envelope.

The collector reads only bounded, aggregated `genre_names` facts from final
classification history for a destination library. It emits normalized genres as
compatibility evidence. It does not read raw provider JSON, titles, overview
text, keywords, cast, director, studio, certification, provider responses, or
live provider state.

## Problem

Persisted metadata can help explain what commonly fits a destination, but raw
provider data must not enter a durable policy contract or establish destination
identity. `classification_history.genre_names` is a typed, normalized storage
field populated during classification persistence. It is therefore safer than
re-reading `metadata` JSON, but broad genre still remains weak evidence.

The collector deliberately limits this component to genre facts. Director,
studio, cast, and certification data either have different privacy/authority
semantics or currently rely on less constrained storage shapes. They need their
own evidence contract rather than being added to this read path opportunistically.

## Official Guidance Reviewed

- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends server-side allow-list validation. The collector accepts only a
  positive integer library ID and normalizes genre strings through a bounded
  character and length allow-list.
- [OWASP SQL Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
  recommends parameterized queries. The query has fixed SQL and binds only the
  library ID, server-owned final-status list, and row limit.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends data minimization. The collector avoids raw metadata, provider
  payloads, titles, and error text.
- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
  supports documented security requirements and verification. The collector
  documents provenance, bounded reads, sanitization, and side-effect auditing.

## Recommendations

1. Read only typed persisted `genre_names`, not raw `metadata` JSON.
2. Aggregate facts by destination library and final classification status.
3. Normalize and reject malformed genre strings before evidence projection.
4. Use stable hashed keys while retaining the normalized genre as a bounded
   compatibility fact.
5. Keep metadata evidence in the compatibility bucket. It cannot establish
   identity, hard limits, avoid rules, or durable learning.
6. Read at most 51 rows and emit at most 50 facts with explicit truncation.

## Pros And Cons

Pros:

- Uses already persisted typed data with no provider call or raw JSON parsing.
- Adds source-specific compatibility context while preserving the existing
  metadata authority boundary.
- Sanitizes values and bounds cardinality before projection.
- Leaves sensitive or semantically ambiguous metadata categories out.

Cons:

- Broad genres are intentionally weak evidence and cannot define a destination.
- Studio, director, cast, and certification evidence require separate contracts.
- Historical rows without normalized `genre_names` do not contribute until the
  existing backfill/persistence path has populated them.

## Final Recommendation Stack

1. `policyLibraryMetadataEvidenceCollector.mjs` aggregates normalized persisted
   genre facts.
2. `policyEvidenceEnvelope.mjs` accepts bounded `metadataEvidence`.
3. `policyEvidenceBoundary.mjs` projects the source only as compatibility
   evidence.
4. The intent and learning components retain authority safeguards and cannot
   treat metadata as destination identity or direct learning.

## Implementation Outcome

The collector returns:

```text
metadataEvidence[]
summary
sideEffects
```

Each record contains a stable hash-based key, normalized genre, count,
timestamp, and `persisted_metadata_genre_compatibility` reason ID. Invalid
facts are omitted and counted without exposing their values.

## Security Outcome

- All variable SQL values are parameterized.
- The query reads typed `genre_names`; it does not select `metadata` JSON.
- Genre values are length-limited, allow-listed, normalized, and hashed for
  stable keys.
- Raw provider payloads, personal names, titles, paths, tokens, and error text
  are excluded.
- No provider/media-server call, quota read, metadata refresh, policy write, or
  learning mutation occurs.
- The audit detects summary drift, invalid facts, and unsafe side-effect claims.

## Next Step

Complete the 6R.1 evidence-source cutline by composing the profile, outcome,
pending-answer, routing, and metadata collectors into one server-owned library
evidence loader. The loader should preserve each collector audit, return a
single bounded envelope, and remain entirely read-only.
