# Exact History IDs in policy-library evidence

Reviewed November 23, 2026.

## Root cause

Pending-answer, final-outcome, routing-outcome, and manual-correction keys
convert History IDs to JavaScript numbers. Adjacent BIGINT values can become
the same key and then deduplicate when the rest of the observations match.
The key also contributes to the projection fingerprint. The correction key
contains a separate `classification_corrections.id` with PostgreSQL `integer`
storage. [PostgreSQL numeric types](https://www.postgresql.org/docs/18/datatype-numeric.html)
· [RFC 8259 numeric interoperability](https://www.rfc-editor.org/rfc/rfc8259.html#section-6)

All four sources in the loader also query `classification_history.updated_at`,
which is absent from the checked-in PostgreSQL schema. That includes metadata,
which builds genre keys and therefore has no History ID key to repair. A failing
source blocks the loader before it can build a projection.
[PostgreSQL error codes](https://www.postgresql.org/docs/18/errcodes-appendix.html)

## Options

| Approach | Benefit | Tradeoff |
| --- | --- | --- |
| Normalize IDs only | Prevents rounded new keys whenever collectors receive rows. | The current schema still prevents collection. |
| Repair IDs and use the existing creation timestamp fallback | Restores the read-only loader on the checked-in schema. Existing key formats and timestamp tie-breaks stay compatible. | History observations describe row creation time. A separate timestamp would be needed to measure when an outcome changed. |
| Add a new timestamp or key version | Could support a new observation or identity contract. | Requires migration and decisions about legacy meaning, saved snapshots, and reproducibility. |

## Recommendation

1. Validate each History ID as positive canonical BIGINT text using the shared
   helper. Preserve key prefixes and decimal spelling for existing safe IDs.
   Keep the correction row ID in its positive `integer` range. Drop a row with
   an unusable identifier, including a correction with no History link.
   [W3C identifier preservation](https://www.w3.org/TR/dwbp/)
2. Read `created_at` for History observations and order bounded row queries by
   that column and the existing descending ID tie-break. Use `MAX(created_at)`
   for genre metadata. Corrections continue to use their own `created_at`.
   History's `recorded_at` describes insertion, which cannot establish when an
   outcome or answer changed. Preserve parameters and source limits.
   [PostgreSQL bounded query ordering](https://www.postgresql.org/docs/18/queries-limit.html)
3. Keep evidence rules, authorization, and fingerprint verification. Verify the
   real PostgreSQL loader with identical observations on adjacent IDs, the
   BIGINT maximum, and a safe ID and correction. Verify repeated fingerprints
   for the same inputs. Fresh evidence with corrected keys can have a new
   fingerprint. Existing snapshots retain their original key and hash.
