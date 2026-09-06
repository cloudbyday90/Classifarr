# Fair automatic library sampling design

## Decision

Replace the hourly combined coverage sampler with one automatic library visit
every five minutes. Reuse the existing strict observation measurement and retain
its 20,000-row limit per visit. A library above that limit gets its own capacity
status; the cursor still advances, so smaller libraries remain measurable.

The durable cursor traverses active library IDs using a fixed upper ID for each
pass. New higher IDs wait for the next pass, preventing continuous additions from
starving earlier libraries. Deleted/inactive IDs are skipped; reactivated lower
IDs join the next pass. With a stable catalog of N active libraries, each library
is visited once per N successful five-minute slots. There is no catch-up burst.
Restarts retain progress. Empty catalogs advance the sampling clock without
manufacturing a library observation.

This is 288 possible visits per day. More than 2,016 active libraries cannot all
appear within the seven-day window at this cadence; completeness is not implied.
Immediate health and overlap reads retain their existing first-12-library/shared
20,000-row scope. This increment expands automatic history.

## Snapshot, concurrency and storage

Selection, bounded inventory and population fingerprints share one database
snapshot. An indexed lateral lookup examines at most 20,001 item IDs and loads
metadata only below capacity. An index on `(library_id, id)` supports this access;
a partial active-library ID index supports traversal. Counting the active catalog
still scans active library entries, not media inventory.

Small ESM services separate selection, persistence and history projection. A
conditional cursor update and sample insert share one SQL statement. The expected
previous sampling timestamp prevents overlapping workers from advancing twice;
failed writes advance neither state nor history. The original health endpoint
keeps its immediate bounded snapshot contract and shares measurement SQL.

The schema migration adds indexes and bounded tables; index creation has a
one-time disk and write-blocking cost during migration. A separate idempotent
data migration seeds the singleton without resetting an existing cursor. It is
also in the schema snapshot seed manifest: schema-only dumps cannot preserve a
runtime row. Fresh installation and upgrade must both initialize sampling.

A new table has 2,016 fixed five-minute slots, retaining at most seven days of
visible per-library points. A singleton row stores traversal progress. Integer
counts, status, times and private fingerprints are retained; names, raw media
identities, provider metadata and secrets are excluded. Capacity points retain
only the inventory lower bound, with unknown coverage and fingerprint. Old slots
are overwritten on reuse; physical deletion at seven days is not promised.

Legacy hourly frames remain readable without rewriting their meaning. New
per-library points have a separate v2 contract and do not combine observations
from different times into an apparent whole-inventory percentage.
The existing root v1 fields still describe legacy coverage; the additive
`librarySampling` and `librarySamples` fields describe automatic visits. A read
returns at most 168 legacy frames, 168 activity buckets and 2,016 modern points.

## Comparisons and UI

Compare consecutive retained visits to the same library using actual sample
times. A continuity timestamp changes when a five-minute slot is missed. Such
gaps, capacity boundaries, changed populations or acquisition-configuration
presence withhold deltas. Normal rotation alone is not a gap. Unchanged counts
are described as sampled comparisons, never continuous hourly stagnation.

The existing authenticated, rate-limited, parameterless history GET adds bounded
sampling status and per-library points. It performs no acquisition or sampling
writes and continues to send `no-store`. Private fingerprints and continuity
keys are removed before response serialization. Errors remain generic.
The continuity key detects sampling interruptions; it is not a security
attestation or proof that inventory stayed unchanged between two visits.

Libraries loads the report automatically. Local pagination shows at most 12
library summaries per page with actual sample times, explicit capacity limits,
current names and expandable semantic tables. Pagination and disclosure only
change the view. Retained sampled-library count is distinct from active-library
count at the last sampling pass; historical inactive libraries can remain visible.

## Official sources and August 2026 scope

URLs were discovered using search and read on 5 September 2026. The established
W3C recommendations and PostgreSQL 18 mechanisms predate the requested August
cutoff; living source pages are not claimed to be archived August snapshots.

- [PostgreSQL index ordering](https://www.postgresql.org/docs/18/indexes-ordering.html)
  explains how matching indexes support limited ordered reads. Use keyset
  traversal and the library/item index rather than offset scans.
- [PostgreSQL SELECT](https://www.postgresql.org/docs/18/sql-select.html) documents
  deterministic ordering and lateral subqueries. Bound the selected library's
  item lookup before metadata measurement.
- [PostgreSQL data-modifying CTEs](https://www.postgresql.org/docs/18/queries-with.html)
  share a statement snapshot; communicate write results through `RETURNING`.
  Couple cursor claims and sample persistence atomically.
- [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/) supports clear
  quality, provenance and version metadata. Retain actual observation times and
  distinguish measured, unavailable and unobserved populations.
- [W3C captions](https://www.w3.org/WAI/tutorials/tables/caption-summary/) and
  [header scope](https://www.w3.org/WAI/tutorials/tables/two-headers/) support
  understandable time/count tables with accessible navigation.
- [OWASP REST security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
  recommends endpoint access control, generic errors and explicit cache policy.
  Preserve the existing authenticated, rate-limited history route and `no-store`.

## Alternatives and recommendation stack

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| One bounded visit every five minutes | Fair traversal; isolates capacity; preserves item budget | Revisit latency grows with library count | Implement |
| Scan all libraries on every request | Immediate complete view | Unbounded work and request latency | Reject |
| Increase the combined cap | Smallest change | Large libraries still dominate; higher peak memory | Reject |
| Manual library schedules | Operator control | Recurring setup and uneven coverage | Defer to exceptional needs |

Recommended stack: synchronized inventory → attributable observations → automatic
profiles → fair bounded sampling → population-aware comparisons → independently
evaluated review-only semantic evidence. Source placement and controlled fixtures
cannot replace independent human labels or bypass readiness/frozen-study gates.
