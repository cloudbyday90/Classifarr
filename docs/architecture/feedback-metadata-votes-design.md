# Unique metadata votes in feedback analysis

## Problem and contract

One feedback record containing `['Action', 'Action', 'Action']` currently counts
as three votes for the same pattern. That can cross the two-record discovery or
three-record failure-pattern thresholds and inflate the confidence derived from
the count. Deduplicating supporting IDs at storage is too late to repair it.

Count each normalized metadata value once within each feedback record. Reuse
`normalizeGroupingValues`, then iterate a native `Set` in the existing small ESM
grouping service. Keep the first-seen ordering, distinct values, distinct records,
and input metadata intact. Genre, keyword and company name/object/JSON forms use
the existing trimmed-string normalization; collection behavior stays compatible.
Retain the null-prototype group dictionary for reserved names such as
`__proto__` and `constructor`.

This is a counting correction, not a new identity policy. Case variants and
different Unicode representations retain their existing meaning. Separate
feedback records about the same media item still count separately. The production
cohort contract already rejects repeated feedback IDs in a captured cohort.

## Existing pending suggestions

Advance the cohort contract from `feedback_suggestions.v1` to
`feedback_suggestions.v2`. The version identifies analysis semantics as well as
the stored input shape. Even an unchanged v1 input can have an inflated suggestion,
so existing freshness guards must reject its application with the established
`SUGGESTION_EVIDENCE_STALE` conflict.

Normal analysis with sufficient eligible input supersedes old pending suggestions
and uses corrected counts for any replacements. Existing applied/rejected history
and immutable cohort records are preserved. Rejection remains available. All v1
pending suggestions require regeneration, including ones without duplicate tags;
this conservative boundary avoids introducing a second legacy analyzer. No schema
migration, endpoint, UI flow, dependency, or routing change is needed.

## Pattern application schema compatibility

The real PostgreSQL regression also exposed an existing writer mismatch:
`create_pattern` application inserted a nonexistent `source` column and omitted
the required `library_name`. Correct the existing transactional writer to use
the current locked destination's name and the actual schema. Keep attribution in
the suggestion/cohort and policy change log. Retain its existing conflict behavior:
approve the matching pattern and preserve the higher confidence. This repairs the
existing explicit-review path without introducing a new pattern storage system.
Existing approved patterns are not automatically recalibrated or downgraded.

## Research for the August 2026 baseline

Official URLs were discovered with web tools and read on 6 September 2026.

- The ECMAScript 2026 specification defines native sets with unique membership
  and deterministic iteration. A set over the normalized strings provides the
  required local deduplication without a library or a shared mutable cache.
  [ECMAScript 2026](https://tc39.es/ecma262/2026/multipage/keyed-collections.html).
- W3C Data on the Web Best Practices recommends version indicators, version
  history and provenance. Applying those principles here means preserving frozen
  evidence and identifying the changed counting semantics, rather than rewriting
  old snapshots. This is an internal design application, not a conformance claim.
  [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/).
- W3C's July 2026 string-matching document distinguishes case folding and Unicode
  normalization choices. It is a **Working Draft**, not a Recommendation. We use
  it as context for keeping this fix within the established matching contract;
  no new case-folding or compatibility normalization is introduced.
  [W3C String Matching draft](https://www.w3.org/TR/2026/WD-charmod-norm-20260716/).

## Recommendations and tradeoffs

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Per-record set after normalization | Correct count before thresholds/confidence; small deterministic change | Temporary memory proportional to unique values in a record | Use |
| Deduplicate supporting IDs only | Compact attribution | Leaves inflated confidence and thresholds | Insufficient |
| Change the shared normalizer globally | Centralizes uniqueness | Alters unrelated consumers and source representations | Avoid for this fix |
| Merge by media identity across records | Could reduce repeated-item bias | Requires rules for corrections over time and media types | Assess separately |
| Version the cohort semantics | Old inflated suggestions fail closed; reuses automatic supersession | Unaffected v1 suggestions also need fresh analysis | Use |

Recommended stack: existing metadata normalization → per-record native `Set` →
pattern count/confidence → versioned immutable cohort → existing locked storage
and explicit review. Keep the implementation in the existing modular service;
introducing another service or package adds no useful boundary here.

## Validation plan

Use regression tests for repeated strings, normalized object/JSON forms, malformed
entries, reserved names, input immutability, ordering and distinct records. Verify
that adding duplicate tags cannot change discoveries, confidence, threshold
analysis or weight analysis. Exercise real PostgreSQL capture, storage and apply,
including v1 rejection, automatic regeneration and historical preservation. Use
the existing Docker integration harness and inspect Compose data read-only.
