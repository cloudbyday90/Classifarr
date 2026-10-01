# Image-index mixed-load and cancellation outcome

## Issue found and fixed

The new study reproduced a lifecycle gap in a real 50,000-vector HNSW build:
the Node maintenance child exited after SIGTERM, but its PostgreSQL statement
remained active beyond the study's ten-second cleanup deadline. A separate
read-only observation still saw `CREATE INDEX` at 28 seconds of query age with
no maintenance child present. PostgreSQL's client disconnect check was disabled.
This was not a queue claim failure or a reason to lengthen the repair deadline.

The validated embedded Linux worker now opts into one-second socket checks on
its pinned database session. That session is discarded afterward. No global
PostgreSQL configuration, Compose/Unraid template, permission, image representation,
claim fence, automatic retry limit or execution deadline was changed. Failure to
establish the setting prevents DDL. Standalone/external callers retain their
existing behavior; no platform support is assumed for them.

The ESM study is split into foreground workload, orchestration, receipt validation
and report modules. It uses actual ingestion, queue enrichment and local analysis
with synthetic providers, plus bounded image-vector reads. It deliberately does
not run AI classification, routing, external provider requests or live data.
Design, alternatives and official sources are in the separate
[design document](image-index-mixed-load-design.md).

## First fixed-container measurements

Measured 1 October 2026 with 50,000 synthetic 2,000-dimensional vectors and enforced
4 GiB / 2 CPU / 128 PID limits. Each foreground case adds 80 movie/TV items across
four libraries, completes four scans and issues 40 nearest-neighbor reads.

| Case | Repair seconds | Retrieval p95 ms | Scan p95 ms | Reads overlapping build | Sampled container peak MiB |
| --- | ---: | ---: | ---: | ---: | ---: |
| Baseline, no image index/build | — | 897.76 | 223.22 | 0 | 1,825.5 |
| Mixed build | 50.76 | 1,327.95 | 246.08 | 36 | 3,040.0 |
| Deliberately cancelled build | 10.22 to observed cleanup | 1,409.51 | 799.18 | 5 | 1,996.2 |
| Invalid-index recovery | 79.40 | 1,681.49 | 1,120.45 | 40 | 3,086.0 |

Both completed repairs used the acknowledged 512 MiB workspace and verified all
three indexes. Cancellation did not acknowledge success; the invalid index was
observed, the old claim was rejected after rotation, and recovery succeeded.
All 320 source items were enriched, no music entered inventory, original image
vector counts and identity sums were unchanged, and no foreground tasks remained.
No OOM kill, memory-limit hit or PID-limit hit was recorded; owned cleanup passed.

Database idle was confirmed at the first check after observed child exit (the
query/check took 2 ms). This is **not** a two-millisecond signal-to-cancellation
claim: activity is polled at 500 ms. Worker time includes polling and cleanup.
In this first fixed run, cancellation resource samples ended with worker cleanup,
before the foreground drain; the final repeat extends sampling through that drain.

Container CPU p95 was about 2.05–2.06 cores during repairs. Short sampling windows
can slightly exceed the enforced two-core quota; throttling counters remain the
enforcement evidence. Raw memory includes cache, process RSS overlaps shared
mappings, and neither is an application leak measurement. Sequential case order,
growing inventory, caching and other host validation work limit comparisons. No
physical memory exhaustion was injected and no latency/throughput SLA is claimed.

Receipt: `.tmp/resource-study/classifarr-resource-study-76465a1c22256169e3f6994597f82c49/result.json`.
Image: `sha256:2bfd4e499b954e76e6d624f7e9f4a634803c6a4ce0ec6732779a81022347e10e`.
The failed reproduction was project
`classifarr-resource-study-fabf274bc59ac9727be97f552b49edb0`; it also cleaned up.
An earlier fixture-only failure correctly refused to certify missing synthetic
metadata enrichment; its provider configuration was corrected, not the assertion.

## Final-image repeat

The repeat includes telemetry through foreground drain after worker exit. It
again preserved all vectors, fully enriched 320 items, verified three indexes
after each completed repair, rejected the stale claim and cleaned up successfully.

| Case | Repair seconds | Retrieval p95 ms | Scan p95 ms | Reads overlapping build | Sampled container peak MiB |
| --- | ---: | ---: | ---: | ---: | ---: |
| Baseline | — | 1,111.48 | 243.13 | 0 | 1,810.8 |
| Mixed build | 59.91 | 1,549.58 | 533.84 | 40 | 3,022.9 |
| Deliberately cancelled build | 9.25 to observed cleanup | 937.02 | 665.12 | 5 | 1,996.3 |
| Recovery | 57.32 | 969.21 | 823.65 | 40 | 3,094.3 |

Cancellation reached independently observed database idle 103 ms after the
post-exit check began, within the unchanged ten-second cleanup acceptance bound.
Polling granularity still prevents treating this as exact signal latency.
No OOM, memory-limit or PID-limit event occurred. CPU throttling was recorded in
706 of 2,534 elapsed quota periods (about 28%); the experiment does not establish
that the two-core profile avoids contention. Do not globally raise limits from it.

Receipt: `.tmp/resource-study/classifarr-resource-study-866631a07a06f0fe0f08fc71d9ac1753/result.json`.
Image: `sha256:d8fcd9cd868de0772dabdca66ca38ddb9b28fa9fb7d4506188708ee5575e1f9e`.
These local receipts are ignored, regenerable intermediates; the committed
documents retain the design and measured conclusions.

## Validation and PR selection

Focused tests cover workload bounds, no-overlap refusal, foreground failure and
connection-acquisition cleanup, invalid receipts, local opt-in and session disposal.
Database tests cover session-setting isolation and repeated low-headroom deferral
without charging automatic attempts, alongside existing crash cooldown/cap tests.
598 focused tests across 22 suites and 45 real PostgreSQL integration tests across
five suites passed. The embedded isolation drill passed standard, custom UID 2345
and Unraid-style UID 99 profiles: claim fencing, restore quarantine, actual queued
completion, interrupted recovery, fixed failure transport, unchanged host stop
timeout, restart, data preservation and owned cleanup.

All 412 frontend suites / 5,835 tests passed with coverage. Lint, type checks,
documentation lint (1,733 files), CI preflight, naming/language/maintenance gates
and ESM checks passed. Ownership review is 19 owned, 221 separately coordinated
and 490 unresolved; existing unresolved debt was not waived or reclassified.
All 1,603 backend suites passed: 49,023 tests passed and one existing test remained
skipped. Backend coverage is 90.02% statements/lines, 85.34% branches and 91.64%
functions. The combined backend/frontend coverage ratchet passed with no baseline
reductions.

Both the GitHub MCP service and saved GitHub CLI login returned no open PRs for
`cloudbyday90/Classifarr`. No random PR could be selected; none was merged or
closed as a substitute. No release or live deployment change was made.

## Recommendation stack and next component

Keep capacity admission → single concurrent build → session disconnect detection
→ independent database-idle verification in tests → claim-fenced invalid-index
recovery → durable retry limits. Benefit: abandoned local work stops without a
new privileged controller or template change. Cost: small socket-polling overhead;
this does not prevent foreground contention or guarantee remote-network failure
detection.

Next component: **classification-path workload admission and responsiveness**.
The unindexed retrieval baseline already has substantial latency, and this study
does not exercise the AI/routing path. Replay the actual classification retrieval
queries and queue outcomes during index unavailability/recovery, recording query
plans and latency. Use that evidence to choose bounded request coalescing or
backpressure without silently dropping image evidence, weakening retrieval quality,
duplicating routing or extending maintenance deadlines. Do not add another
maintenance scheduler or increase default CPU/memory limits from this one study.
