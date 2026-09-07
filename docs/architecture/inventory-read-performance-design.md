# Inventory read performance design

Date: 2026-09-07. Outcome and measurements are recorded separately in
[inventory read performance outcome](inventory-read-performance-outcome.md).

## Problem and evidence

The previous candidate comparison work identified slow observation-health and
overlap reads. Both already select at most 12 active libraries and detect a
20,001st row before projecting a maximum of 20,000 inventory rows. Their indexes
select the real local population of 6,692 rows in under five milliseconds.
Initial PostgreSQL plans instead spend roughly 1.8–2.0 seconds projecting metadata.

The shared SQL function repeatedly extracts fields from its JSONB argument.
Large stored metadata can require repeated retrieval and decompression. The
projection nodes account for most buffer accesses, while joins and queue lookups
are inexpensive. This is evidence for reducing repeated payload processing;
it does not establish a need for another index or a cache.

## Selected design

Keep the existing small ESM query modules and canonical PostgreSQL projection:

1. Health and fair sampling pass only the `inventory_tmdb` child, wrapped under
   its existing key, into `library_profile_observed_metadata`. Other provider
   sections cannot contribute to an observation-health result.
2. Overlap passes `to_jsonb(msi.metadata)` into that function. On PostgreSQL 18,
   this materializes the JSONB value before the SQL function repeatedly accesses
   its fields. Preserve the full input here because overlap also uses OMDb and
   TMDb fallbacks. Keep the existing materialized projected CTE.
3. Continue applying byte limits to the canonical projected values. A large
   unrelated field must not cause a small valid observation to be withheld.

The function remains the sole field allowlist. Missing language keys remain
absent; explicit JSON null remains present. Keep `has_observation` derived from
the original metadata, including malformed values. Identity, freshness, queue
precedence, population fingerprints, scan continuity and overflow behavior stay
unchanged. No API contract, schema, dependencies, runtime options or UI controls
are added. Future changes to the projection function's inputs must revisit the
health input reduction and its equivalence regressions.

## Official research, checked September 2026

Sources were discovered through web search and opened through the web tool.

- PostgreSQL 18 [EXPLAIN](https://www.postgresql.org/docs/18/sql-explain.html)
  distinguishes execution, buffer activity and output serialization. `ANALYZE`
  executes the query; use read-only transactions for these SELECT measurements.
  Serialization timing excludes network transfer.
- PostgreSQL 18 [TOAST storage](https://www.postgresql.org/docs/18/storage-toast.html)
  explains compression and external storage of large values. The observed buffer
  reduction and timing improvement support the repeated-payload-processing
  explanation; they are not a general guarantee for every storage distribution.
- PostgreSQL [JSON functions](https://www.postgresql.org/docs/current/functions-json.html)
  documents `to_jsonb`, object construction and the distinction between JSON null
  and SQL NULL. Real PostgreSQL equivalence tests cover these input shapes.
- PostgreSQL 18 [CTE materialization](https://www.postgresql.org/docs/18/queries-with.html)
  explains avoiding repeated expensive evaluations and the cost of restricting
  optimizer pushdown. Retain the existing bounded materialization boundaries.
- W3C [Data on the Web Best Practices](https://www.w3.org/TR/dwbp/) supports
  explicit provenance and data quality metadata. Preserve unknown states, scope,
  observation times and coverage denominators. The existing accessible interface
  receives the same contract; this backend change makes no new accessibility claim.
- OWASP [SQL Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
  supports parameterized queries and least privilege. SQL structure stays fixed,
  values remain bound, and authenticated read-only/no-store routes stay intact.

## Alternatives and tradeoffs

| Option | Benefits | Costs and decision |
| --- | --- | --- |
| Narrow health input; materialize overlap input | Measured speedup, canonical allowlist, no migration or operator action | Still reads bounded source payloads; remeasure after PostgreSQL upgrades. Selected. |
| Extract three provider sections for overlap | Explicit narrower function input | Repeated root access was slower in local comparison. Not selected. |
| Copy with JSONB concatenation or an object wrapper | Similar speed improvement in experiments | Less direct intent; concatenation also changes non-object inputs. Not selected. |
| Rewrite the shared SQL function | Could benefit every caller | Wider writer/revision impact and migration burden; requires separate measurement. Deferred. |
| Add indexes | Useful if selection dominates | Selection is already fast; adds write/storage cost without targeting the measured issue. Deferred. |
| Cache aggregate counts | Avoids repeated computation | Adds invalidation and freshness state to passive discovery. Deferred. |

Recommended stack: existing indexed bounds → targeted JSONB materialization →
canonical SQL allowlist → existing byte limits and ESM validation → unchanged
aggregate API and Vue presentation. Optimize measured work without adding an
operational workflow or weakening study readiness gates.

## Verification strategy

Compare old and new reads inside one repeatable-read, read-only transaction with
a five-second statement timeout and a fixed observation clock. Assert complete
snapshot equivalence (normalizing only unordered inventory arrays) and complete
API response equivalence. Record plans and repeated timings without private media
records. Exercise real PostgreSQL fixtures for malformed roots/sections, missing
versus null fields, large irrelevant fields, exact byte limits, library/row caps
and shared fair-sampling behavior. Wall-clock timings are evidence, not flaky CI
pass/fail thresholds. Finish with the existing regression suites and local Compose
endpoint checks, retaining all provider and routing settings.
