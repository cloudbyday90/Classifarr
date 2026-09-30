# Selective waiting-backlog discovery: outcome

Date: 2026-09-30. Implemented under Unreleased; no release or version bump.
See the separate [design and official research](retry-wait-discovery-design.md).

## Delivered

- Shared ESM availability predicate for candidate pages and the earlier scheduler
  probe. Both remain read-only, in the same statement as their existing guards.
- Narrow partial index on pending exact-deadline wait provenance, with bounded
  startup migration and mechanically regenerated, round-trip-checked schema.
- No guessed legacy provenance, deadline reset, attempt reset, provider quota
  bypass, new polling service, music ingestion or change to source/claim fencing.
- Extended isolated PostgreSQL benchmark and regression tests for skewed order,
  unchanged/rotated credentials, changed deadlines, concurrent commit visibility,
  negative-cache absence, read-only execution and rollback.

## Measurements

Page report: `.tmp/retry-wait-benchmark.json`, PostgreSQL 18.6, 100,000 synthetic
queue rows per populated scenario; 11 scenarios, three retry types, head/middle/
tail pages, readiness and claims. All 594 comparisons verified result IDs, with
three warmed EXPLAIN repetitions each. Both compared page shapes use the same
current schema; the baseline SQL shape is revision `132d9188` without the check.
The separate broad ordered-index experiment is not deployed.

Selected medians in milliseconds, current indexes (including the narrow index):

| OMDb case | Previous page | Availability-gated page |
| --- | ---: | ---: |
| All waiting, no provenance, head | 49.741 | 0.264 |
| All waiting, middle | 33.409 | 0.282 |
| Changed deadlines, head | 32.100 | 0.361 |
| Mass credential rotation, head | 1.315 | 1.375 |
| Mixed eligibility, head | 1.147 | 1.289 |
| Sparse rotation with priority/time skew, head | 10.026 | 10.880 |
| Ready work only at tail, head | 59.234 | 57.224 |

The useful improvement is verified work avoidance, not small timing differences:
all-waiting head pages stopped filtering 100,000 queue rows, and the candidate
scan executed zero times. Shared buffer hits fell from 1,624 to five. Native
web-search and Tavily all-waiting head pages measured 0.356 and 0.263 ms versus
53.532 and 50.733 ms. No current page plan used JIT; no measured plan spilled
temporary blocks in this run.

Not a universal speed-up: ready-tail web-search measured 50.205 to 68.636 ms;
OMDb terminal-history head measured 8.112 to 12.077 ms. Their candidate work did
not materially shrink. Dense, unchanged provenance still caused a full guarded
scan (426.710 ms for the new OMDb head page). Local validation/build activity
overlapped part of this run, so sub-millisecond overheads and latency differences
without work reduction are not isolated causal evidence or production SLOs.

The rejected split-query prototype improved waiting scans but regressed rotation
head from about 1.5 to 551 ms. It was not shipped.

Scheduler probe report: `.tmp/retry-dispatch-benchmark.json`, the same PostgreSQL
image, row count and resource limits. All 66 unordered availability comparisons
passed, with three warmed repetitions each and verified schema rollback. OMDb
all-waiting discovery fell from 39.109 to 0.323 ms and stopped filtering 33,333
rows; changed deadlines fell from 18.364 to 0.235 ms. Mass rotation remained
0.429/0.496 ms. Sparse rotation was 0.540/1.024 ms and ready-tail discovery
47.878/50.611 ms: the extra existence check is overhead when work is present.
Dense unchanged provenance still scanned 33,333 rows (460.406 ms); this remains
the next measured optimization target, not a claimed fix in this patch.

### Index cost

The provenance index occupied 8 KiB when empty, 16 KiB with roughly one percent
provenance, and 664 KiB when all 100,000 rows had matching provenance. It stores
one retry-type key, not JSON or secrets.

For 1,000-row synthetic wait-recording updates, warmed medians without/with the
index were 33.036/42.639 ms (initially no provenance), 22.539/28.776 ms (dense),
and 24.843/33.661 ms (sparse). This is a real maintenance tradeoff, not a free
index. Claim-status updates were 11.324/11.698, 12.875/13.119 and 10.355/11.486 ms.
Both write variants also retained the offline ordered-index experiment; these
numbers are comparative fixture costs, not production write throughput.

Savepoints restore logical rows/index state, not WAL, dead tuples or warmed
buffers. The fixture omits application triggers and foreign keys, and does not
model simultaneous ingestion. Independent two-connection integration tests cover
visibility and ownership correctness, not load capacity. No production data or
provider HTTP was used in the benchmark.

The middle/deep markers are physical fixture IDs, not percentiles of eligible
work. Under reversed-time/priority skew they are not the middle/tail of sorted
results; the independent oracle verifies those explicit cursor boundaries.

## Validation

Focused final unit checks: 147 tests passed. PostgreSQL integration checks:
136 tests passed across nine suites. Frontend: 411 suites, 5,795 tests passed
with coverage. Final backend: 1,553 suites, 47,129 tests passed; 90.23% statement/
line coverage, 85.04% branch coverage, 92.06% function coverage. Lint, type checks,
CI preflight, ESM import/mock-shape checks and product/maintenance policy gates
passed. No validation issues remain from the focused or full test runs.

Schema generation applied the additive migration to an isolated application
container, then a rebuilt fresh-schema container reproduced the snapshot exactly.
The index migration also passed transaction rollback/replay assertions.
Ownership review preserves existing unresolved classifications; a passing drift
gate does not certify legacy or external writers as ownership-safe.

## PR disposition

Initial and repeat GitHub MCP searches found no open PR in `cloudbyday90/Classifarr`; none could be
randomly selected. No closed PR was substituted and no PR was merged.

## Local deployment evaluation

The user subsequently requested a no-cache local Compose rebuild. Before upgrade,
the existing container was healthy, used about 351 MiB of its 2 GiB limit, and had
one application process plus PostgreSQL processes. Docker inspection showed no
CPU quota or PID limit. Its latest migration was
`20260929_180000_web_search_usage_trace.sql`; the upgrade therefore also includes
the already-committed OMDb pacing and credential-scoped wait migrations.

Deployment results will be appended after the validated build is installed.
Persistent data and routing settings are to remain unchanged; retain the previous
image for rollback. Normal background jobs may resume after the authorized restart.

[Docker's build specification](https://docs.docker.com/reference/compose-file/build/)
distinguishes rebuilding layers without cache from pulling base images.
[Docker resource guidance](https://docs.docker.com/engine/containers/resource_constraints)
supports measuring requirements before choosing limits; the 1,536 MiB Node
old-space ceiling is not a total-process or PostgreSQL memory allowance. No
arbitrary CPU/PID cap or larger heap is introduced in this patch.

## Final recommendation stack and next item

Keep **PostgreSQL 18 + narrow partial index + shared ESM negative checks + existing
bounded scheduler + atomic claims/provider admission + source-fenced commits**.
Benefit: cheap idle discovery without a new queue or service. Cost: extra index
writes and remaining scans when provenance exists but nothing is actually ready.

Next: **generation-aware waiting-work admission**. Target the measured dense,
unchanged-credential backlog so the scheduler need not repeatedly compare every
row's JSON evidence. First measure provider-wide rejection and unchanged-generation
cases with concurrent credential edits. Require exact eligibility equivalence,
restart safety and preserved per-item deadlines; do not infer recovery from age
or introduce a negative cache that can miss a later rotation.
