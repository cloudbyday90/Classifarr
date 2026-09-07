# Inventory read performance outcome

Date: 2026-09-07. See the separate
[design, alternatives and official research](inventory-read-performance-design.md).

## Result

Health and automatic fair sampling now project only the observation section.
Overlap materializes its JSONB input before the existing SQL projection reads it
repeatedly. The change is confined to two small ESM query modules. The canonical
allowlist, byte limits, identity validation, unknown states, timestamps, queue
precedence and sampling fingerprints remain intact.

There is no new operator workflow, provider call, API contract, schema migration,
dependency or UI change. Existing row/library caps and read-only authenticated
routes remain in force. This continues passive discovery of existing library
content; it does not generate independent labels or change classification routing.

## Local measurements

The baseline was clean revision `ba80c5f77f8b97c379bce2c88f558902d8f55145`,
following the previous release-to-current Compose review. Local PostgreSQL 18.6
held 6,692 inventory rows across ten active libraries. Profiling used one
repeatable-read, read-only transaction and a five-second statement timeout.
No provider calls, configuration changes or database writes were requested.

Initial `EXPLAIN (ANALYZE, BUFFERS, SERIALIZE TEXT, FORMAT JSON)` findings:

| Measurement | Health | Overlap |
| --- | ---: | ---: |
| ID selection | 4.872 ms | 2.549 ms |
| Metadata projection CTE | 2,002.284 ms | 1,783.189 ms |
| Total execution including serialization | 2,272.483 ms | 2,113.914 ms |
| Root shared buffer hits | 171,921 | 140,704 |
| Serialization | 28.985 ms | 42.220 ms |

Both plans had zero shared reads and zero temporary spill blocks in this warm
sample. Existing selection and queue indexes were effective. Most projection
buffer activity occurred above the inexpensive row fetch/join nodes.

Two experiments compared alternatives against the original SQL in the same
database snapshot with a fixed transaction clock. Each alternative returned
identical complete snapshots and identical API responses. Only the unordered
inventory arrays were sorted for snapshot comparison. The second experiment's
three-run medians for the selected expressions were:

| Read | Original query | Optimized query | Original service | Optimized service |
| --- | ---: | ---: | ---: | ---: |
| Health | 1,900 ms | 736 ms | 1,964 ms | 786 ms |
| Overlap | 2,207 ms | 829 ms | 2,388 ms | 999 ms |

Service time includes query transfer, JSON parsing and aggregation. In this
comparison the reductions were about 60% and 58%, respectively. Large differences
between individual warm runs show why these are local measurements rather than
latency guarantees. The first experiment also found that extracting three
provider sections for overlap was slower than materializing one value.

Private plans and timings remain under ignored `.tmp/`; no media payloads,
credentials or labels are committed. To reproduce, capture the SQL and bound
parameters through each reader's injected database adapter, run the EXPLAIN
above in a read-only transaction, then time three service calls on the same
connection. Use a fixed observation clock only for equivalence comparisons;
production queries retain `statement_timestamp()`.

## Validation and delivery

- Complete backend unit suite: **31,137 tests across 1,091 suites**, passing in
  212.675 seconds with two workers and 512 MB idle worker recycling.
- PostgreSQL integration: **95 tests across six suites**, including health,
  overlap, fair sampling, scan diagnostics, acquisition history and the new
  projection equivalence suite. The new suite's initial privacy assertion also
  matched an intentionally public fixture library name. Renaming that fixture
  resolved the collision; all **49 projection tests** passed on the focused rerun
  in 82.078 seconds. The five existing suites passed on the initial run.
- Existing Chromium health and overlap regressions: **two tests passed** in
  14.4 seconds, covering automatic reads, keyboard disclosures, native table
  captions, contrast and mobile scrolling without write requests.
- Server typecheck, scoped ESLint including the new integration file, production
  dependency checks, ESM static-import/mock-shape checks, Markdown lint and
  whitespace validation passed.

No client source or endpoint changed, so the full client suite and combined
coverage ratchet were not rerun.

The no-cache Compose build passed from clean source revision
`98965c7278fc34ca428decb406e4513aba1c4ecc`. Both dependency installs reported zero
audit vulnerabilities. The previous image was retained locally as a rollback
reference. Recreation preserved the existing data volume, and the running image
reports that same source revision. This outcome update is documentation only.

After health readiness, all seven authenticated smoke reads returned 200.
Health took 771 ms and overlap 1,040 ms, both available with 6,692 rows and ten
selected libraries. Their responses retained `Cache-Control: no-store`. Anonymous
overview/health/overlap reads returned 401; unexpected query parameters on health
and overlap returned 400. The smoke helper requested zero writes and retained
6,775 history records, ten libraries, zero feedback records and 249 migrations.
The initial HTTP probe preceded listener readiness and was rerun successfully
after the container became healthy.

Plans collected from the rebuilt application on the real local database showed:

| Measurement | Health | Overlap |
| --- | ---: | ---: |
| Metadata projection CTE | 613.729 ms | 396.551 ms |
| Total execution including serialization | 916.794 ms | 644.806 ms |
| Root shared buffer hits | 45,978 | 14,771 |
| Three-run median query time | 765 ms | 728 ms |
| Three-run median service time | 865 ms | 948 ms |

Shared buffer hits fell about 73% and 90% from the baseline, respectively. There
were no shared reads or temporary spills in these warm plans. API response sizes
remained 7,469 and 89,345 bytes. This post-restart measurement is separate from
the frozen-snapshot equivalence experiments; background acquisition remained
enabled, so it is not a claim that stored metadata stayed unchanged over time.

The startup and smoke log sample contained 442 informational records, seven
slow-query warnings, one existing metadata-provider configuration warning and
zero error/fatal records. The optimization reduces cost but does not remove all
slow-query warnings. The existing duplicate active OMDb/TMDb configuration remains
a separate follow-up; credentials and provider selection were not changed.

## Open PR availability

GitHub MCP returned no open pull requests at task start and final readback. There was no population
from which to randomly select a PR; no closed PR was substituted or merged.

## Recommendation stack and next item

Keep indexed population bounds, targeted JSONB materialization, one canonical
allowlist, explicit byte limits, ESM validation and the existing Vue aggregates.
The benefit is lower passive-read cost with no extra maintenance. The tradeoff
is dependence on measured PostgreSQL execution behavior, so reprofile after a
major engine or payload-distribution change. The design document compares other
options and cites PostgreSQL, W3C and OWASP guidance.

Next, resolve the duplicate-active-provider configuration warning documented in
the [local Compose review](local-compose-september-review.md). Trace selection
and configuration writers, make selection deterministic, and prevent new
ambiguous active states while preserving existing credentials. Do not silently
disable an existing credential to remove a warning. Other callers of the shared
projection, including per-library profile reads, are a separate measurement
opportunity; this result is not evidence to change every caller blindly.

Readiness and frozen-study preflight still gate review-only semantic
counter-evidence. Observation counts and successful query optimization do not
establish a measured classifier error profile. No release is created.
