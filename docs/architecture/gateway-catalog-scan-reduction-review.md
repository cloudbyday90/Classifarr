# Next opportunity: reduce unnecessary catalog reads

Research review, 2026-10-18. The user selected reducing repeated archive checks as
the next opportunity, with impact and risk understood first. This document
retains the research/options review; the design and outcome below record the
subsequent implementation. No verification-removal authority is implied.

## Where the repeated work occurs

`catalogDependencies.mjs` uses `visitCatalogRows` to stream complete job JSON,
parses it, then discards jobs outside the selected set or not verified. A failed
job's large manifest therefore crosses the database connection even though it
cannot contribute a dependency file. The wide fixture has about 234 MB of job
JSON, mostly failed-history padding.

Scheduled capture checks dependencies before and after pg_dump. The same reader
is used by legacy catalog capture, isolated restore and retention registration.
The latter has its own read-only transaction and cannot assume a preceding full
catalog scan validated every row. A change must cover these callers together.

## Recommended direction

Reduce the data transferred and parsed by each dependency check, rather than
remove checks. Investigate a bounded dependency-specific reader that projects
only the required verified job bodies, in the same deterministic order and
repeatable-read snapshot. Preserve existing whole-history schema/count/row-size
refusals, including invalid excluded records, before returning selected bodies.
Use parameterized selection and fixed identifiers, not interpolated ID lists.

Full canonical catalog hashing and the actual dump must still include failed
history. Keep pre-export and post-export file revalidation, independent restore,
retention-registration checks, protection markers and pin validation. No cached
trust across runs, stored validation credit, new table, expiry or purge.

| Risk / impact | Required evidence or safeguard |
| --- | --- |
| Filtering accidentally bypasses row/count guards | Oversized excluded failed rows and 10,001 total jobs must still refuse; test standalone retention as well as capture |
| Different callers choose different dependency sets | Version 1 selects all verified dependencies; version 2 preserves newest pair plus protected jobs, including timestamp ties |
| Snapshot or ordering changes alter hashes | Compare old/new dependency count, bytes, order, digest and registered pins on the same real SQL snapshot |
| Files change after the first check | Keep post-export checking; late dump/manifest/receipt/marker corruption must refuse publication or registration |
| Hidden work moves into PostgreSQL | Measure query plan, database CPU/elapsed time and transferred bytes separately; fewer Node bytes do not prove less SQL work |
| A new reader retains all selected bodies | Preserve byte-before-transfer limits and incremental consumption; include the 400-valid-archive fixture |
| Retry or interruption behavior changes | Keep deadlines, shared attempts, cooldowns, cancellation and ambiguous-publication handling unchanged |
| Expected memory improvement is overstated | Export still writes the full large dump; file-cache peaks may remain near the same limit |

Expected benefit is less transfer and JSON parsing during dependency scans. Its
magnitude is not yet measured. Whole-history size checking may still require
SQL serialization, so neither lower database cost nor a shorter run is promised.
The external sampler identifies resource windows, not exact internal call costs.

## Alternatives and recommendation stack

- Keep the current reader: least implementation risk, but retains demonstrated
  unnecessary transfer of failed-history payloads.
- Add a dependency-specific bounded projection: best first candidate; adds a
  query contract that must preserve validation independently at every caller.
- Reuse an earlier file-validation result or drop the post-export pass: faster
  in principle, but weakens protection against changed files. Do not do this.
- Persist a cache/checkpoint: larger invalidation and crash-recovery design;
  defer until simpler projection has been measured.

Recommended stack: existing ESM service boundary, PostgreSQL read-only snapshot,
bounded SQL projection, sequential validation and differential real-SQL/image
tests. No new admin function or production activation.

## Official sources

Discovered and opened through MCP on 2026-10-18:

- [PostgreSQL SELECT](https://www.postgresql.org/docs/18/sql-select.html) describes
  filtering, projection and ordering. Our inference is that targeted projection
  can reduce output bytes, but the actual query plan and preserved guards must
  be tested rather than assumed.
- [PostgreSQL SET TRANSACTION](https://www.postgresql.org/docs/18/sql-set-transaction.html?trk=article-ssr-frontend-pulse_little-text-block)
  documents transaction snapshot semantics. Keep the existing read-only
  repeatable-read boundary; it does not freeze external archive files.

The user requested implementation of this scope on 2026-10-18 after the contract
and safeguards were explained. The
[selective-read design](gateway-catalog-selective-reads-design.md) records that
agreement. Validation remains incremental: each visited row is bounded, and the
whole cursor must finish before dependency inspection returns a summary. Its
consumers read and hash files; they cannot publish or register a partial scan.

Acceptance requires equivalent safety results plus measured reduced transfer,
with a separate outcome record. The
[measurement foundation](gateway-catalog-memory-design.md) distinguishes process
memory from file cache and does not promise a lower peak for this optimization.
The [implementation outcome](gateway-catalog-selective-reads-outcome.md) records
the same-snapshot comparison, preserved refusal paths and local image evaluation.
