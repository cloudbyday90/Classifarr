# Owned catalog co-load study — outcome

## Scope and exact artifact

Completed the [approved design](gateway-owned-catalog-coload-design.md) on main,
2026-10-20. Added bounded synthetic-study observations and dependency patches,
not new runtime controls, tables, identities, retry authority or purge authority.
Unraid, Plex and shared Ollama were not targeted. No release, version bump, tag
or PR merge was performed.

Dependency commit: `d9f5b2c5f`. Measurement commit and clean no-cache build source:
`d6656a06a5898a5fb7622109421b88c71e5bd0f0`.

- Tested local image: `sha256:7f1741d92bcd8fc33f6fd01070b8bb5f4ce3f859e0ae905cac16955286512652`.
- OCI revision matched that source. This is local image evidence, not signed
  registry provenance, published multi-platform acceptance or a release receipt.
- Extended sealed-input binding:
  `5d7043883312ea2b7c57bb345e5ae5c4b19aa9614ace49153bac28683ab3968c`.
- Regression binding:
  `b687e8ac74eb9a63d28d7a88ada07b4953cc9b33d5812528771be129660fe528`.

The dependencies and sampler were committed separately. No heavy build or test
ran alongside either timed inference study. Other ordinary local services still
shared Docker Desktop; this was not a dedicated benchmark host.

## Implemented contract

The read-only observer now separates source, coordinator and private catalog
connections from cumulative observed read transactions. It counts only three
fixed diagnostic application names in the fixture database; these labels are
not authentication or proof of ownership. Observer, inference-ledger and pg_dump
connections are excluded from the managed sum.

The parameterized query has fixed row/connection bounds and strict validation.
Private PID/start identities stay internal to bounded sets and never enter the
result. Invalid, duplicate, excessive or missing observations cannot become a
successful zero sample. Existing progress, gap, sample, bin and memory-coverage
requirements remain, with added owner visibility and settled-idle disposal
requirements. The inference sampler takes one process-memory reading per tick.

All timing, workload, SQL/transaction, byte/count, attempt, cooldown, CPU, memory,
PID and isolation limits remain unchanged. Fresh normal installations do not
start this study or enable the optional gateway.

## Observed inference and archive results

Both exact-image studies passed, including source binding and verified cleanup.
The eight-minute regression completed 480 foreground requests and returned 48
expected background busy responses. Peak provider concurrency stayed at one.

The extended traffic window ran from `2026-10-20T11:37:27.260Z`, followed by its
one-minute idle tail; measurement ended at `2026-10-20T12:08:27.342Z`.

| Extended phase | Foreground completed | Expected busy | Foreground p95 | SQL claim p95 |
| --- | ---: | ---: | ---: | ---: |
| Before, 60 seconds | 60 | 6 | 1,266.766 ms | 3.788 ms |
| Archive-active, 1,680 seconds | 1,680 | 168 | 1,267.988 ms | 3.680 ms |
| After, 60 seconds | 60 | 6 | 1,264.627 ms | 3.284 ms |

All 1,800 foreground requests completed, with 180 expected busy responses and no
dropped/failed arrivals. There were 1,800 distinct fingerprints and UUIDv7 request
IDs; provider concurrency stayed at one. Admission ended at 1,801 attempts and
bindings, including the prerequisite fixture admission, with no active request.
No counter or attempt resets were used.

The fixed provider service time was 650 ms with intentionally paired foreground
arrivals. Queue wait is therefore part of end-to-end latency, not SQL claim time.
The timer-based event-loop histogram used its existing 20 ms resolution: p95
20.267 ms, maximum 43.024 ms. Do not interpret its p95 as additional latency above
that resolution or compare it to a different measurement mode.

Two catalog jobs verified at attempt one. Real pg_dump windows overlapped 7 and 9
admitted requests; real pg_restore windows overlapped 6 and 7. This proves overlap
with inference, not simultaneous dump/restore or real LLM performance.

The 3,000 historical failed rows retained exactly 233,849,292 canonical bytes and
SHA-256 `3b541bfb003d4fa7ffe036f5646c2656263991bf6a873209a663327eebeecfb7`.
Physical PostgreSQL storage changed from 245,858,304 to 245,866,496 bytes; unchanged
content is not a claim of identical physical storage. Two verified roots remained,
with dump sizes 233,198,317 and 233,612,809 bytes. Cleanup operations stayed zero
and purge remained unauthorized.

## Connections, coverage and resource limits

All 1,860 source samples were valid; maximum sample gap was 1,086.872 ms. Every
required database and memory field had complete coverage. Peak managed connection
count was three: one source, one coordinator and one private owner. Eight distinct
read transactions were observed, six belonging to the private owner. Maximum
observed owner transaction age was 36.564 seconds, below the unchanged 120-second
operation bound. This is sampled xact_start age, not an exact exported-snapshot
lifetime. Short transactions may fall between samples.

Every one of the 60 idle samples showed zero source, coordinator and private-owner
connections, zero snapshot-bearing owner transactions and zero current observed
transaction age. Cumulative transaction counts correctly stayed at eight/six.

Both loop workers passed coverage, memory-event and PID-event checks. No OOM, observed
limit-hit counter increment or PID-limit event occurred. Values below are MiB;
separately timed component maxima must not be summed.

| Container | Limit, no swap | Sampled total peak | Lifetime total peak | Anonymous peak | File-charge peak |
| --- | ---: | ---: | ---: | ---: | ---: |
| Source, including PostgreSQL | 2,048 | 442.47 | 588.19 | 267.55 | 170.13 |
| Archiver | 256 | **256.00** | **256.00** | 60.28 | 185.66 |
| Catalog verifier | 1,536 | 1,081.89 | 1,083.47 | 165.00 | 904.83 |

The source ended at 381.32 MiB sampled total charge versus 412.59 MiB initially.
Its inference/observer process peaked at 85.73 MiB RSS and 18.76 MiB heap. Archiver
worker/observer RSS peaks were 98.96/66.55 MiB; verifier peaks were 185.46/67.26 MiB.
RSS can include shared mappings and is not equivalent to cgroup anonymous charge.

The archiver reached its configured charge ceiling in one minute bin. That is a
capacity warning, not comfortable headroom, even though the run completed. Its
large file charge is consistent with cache-related pressure, but this run cannot
attribute the peak to cache, the worker or the measuring process independently.
It also cannot prove absence of reclaim stalls or a long-term leak.

CPU accounting was available: sampled archiver/verifier deltas were 48.310/57.324
CPU-seconds, with 9.636/5.571 seconds of throttling-counter growth. Sampling wall
time was 7.602 seconds for the source, 23.853 for the archiver and 24.148 for the
verifier, respectively 0.409%, 1.421% and 1.458% of observed duration. These are
instrumented wall times, not calibrated total observer overhead or causal costs.

This Docker Desktop environment exposed cgroup v1 accounting. Block-I/O and PSI
fields were unavailable for all three containers. They remain absent, not zero;
there is no physical-disk-I/O or reclaim-stall conclusion from this run.

Official [Docker metric guidance](https://docs.docker.com/engine/containers/runmetrics/)
supports separating memory/cache accounting from process RSS. A further MCP
search and open on 2026-10-20 located the
[kernel v1 memory-controller guide](https://www.kernel.org/doc/html/latest/admin-guide/cgroup-v1/memory.html?highlight=swappiness),
which describes page-cache charging, reclaim and approximate usage accounting.
That guide explicitly warns it is outdated. Use it as background, not proof of
the exact current kernel's reclaim behavior or an explanation of these counters.
No cache flush, forced GC, statistics reset or kernel setting change was made.

## Correctness and dependency verification

- Real isolated PostgreSQL: five suites, 68 tests passed, including actual private
  owner visibility, read-only observation and connection disappearance. The first
  run exposed a test-fixture password-spread mistake; explicit isolated credentials
  and a bounded connection setup fixed it. No production configuration changed.
- Focused parser/HTTP/TLS tests: eight suites, 106 tests passed, including all three
  installed Undici copies. Adversarial content encodings reject without process
  failure, and custom TLS identity verification remains effective.
- Full backend coverage: 1,876 suites / 60,290 tests passed, two tests failed on an
  obsolete exact-version expectation and one existing Linux-only fsync test was
  skipped on Windows. Updated that expectation from 6.29.0 to 6.29.1 without
  weakening behavior assertions. The final failed-suite-only rerun passed its
  suite and all eight tests. This is combined evidence, not an original zero-exit
  full coverage command.
- Frontend coverage: 477 files, 7,373 tests passed. The no-cache image's frontend
  build also passed. Coverage ratchet passed without baseline changes: server
  statements/lines 89.18%, branches 86.46%, functions 90.74%; client statements
  87.79%, branches 81.84%, functions 87.50%, lines 89.47%.
- Gateway tooling: 117 passed with one Windows symlink skip; restricted Linux
  execution passed all 118 with no skips. Temporary bundle/container absence was
  checked. All 43 dependency/install-policy tests passed.
- Full lint, both workspace type checks, normal/production Knip, ownership,
  static ESM, mock-shape and copyright checks passed without baseline updates.

The native archive regression additionally passed corruption, missing-marker,
inventory-tamper and legacy-receipt refusal, retention pins, interrupted retirement,
oversized excluded rows and 10,001-job refusal. The separate scheduling/pressure
drill preserved 80,000 frozen bindings while real inference advanced live history
to 80,001, restored the dump, retained attempt two and earlier history, and left
purge unauthorized. Its scheduling observations were simulated, not elapsed days.
Both drills verified cleanup. The soak verifier imports sealed fixtures; the
independent packaged scheduling verifier does not. Neither receives the live
source socket, source credentials or Docker socket.

Randomly selected open [PR #565](https://github.com/cloudbyday90/Classifarr/pull/565)
was implemented locally, not merged. Exact installed runtime versions are dotenv
18.0.8, js-yaml 5.5.0 with argparse 3.0.3, Zod 4.6.7, direct Undici 8.12.3 and the
two Discord-related Undici copies at 6.29.1. The latter patches extend the PR as
explicitly approved. Reviewed lock generation, strict clean installation, complete
dependency tree and full npm audit passed; audit reported zero advisories on
2026-10-20. The official advisory identified affected baseline versions despite
that baseline's clean audit, so a clean audit is not a safety guarantee. Research
and exact official release/advisory URLs are in the design document.

## Local Compose, backup and rollback

Local Compose was recreated from the tested image without rebuilding or pulling.
Container `8fb612ac563938950d0765bd8443ee019f76e658c705e1db17a013c3a42046ae`
started at `2026-10-20T12:10:44.873089934Z`: healthy, read-only root, 2 GiB limit,
no OOM. `/health`, `/api/system/health/ready` and `/` returned HTTP 200. PostgreSQL
reports 18.6, pgvector 0.8.7, and installed dependency versions match the image.
Gateway namespaces remain absent from normal appdata. The capture guard remains
`2|0|0|0|0|2026-10-09 16:50:11.617278-04`.

Before replacement, a new 76,207,790-byte mode-0600 backup was retained at
`data/backups/gateway-owned-coload-20261020-d6656a06.dump`, SHA-256
`6c2c56127713500da23121b442289e47ef792e2d40aadf5db349a865d4c35d09`.
Its archive list passed; this is not a full restore proof for normal appdata.
Rollback tag
`classifarr-local-rollback:605e47232a956fd7a0459357a524536731ba13a2a1add92bde4dd7cff81faa28`
retains image `sha256:c8f6cb6c324fc783981c2205a54fef9901811924a85142995a618dcf588517db`.
Earlier backups and images were kept. All owned study containers, volumes and
synthetic database directories were removed; no Docker pruning or live history
deletion occurred.

## Recommendation stack and next item

| Recommendation | Benefit | Cost / remaining weakness |
| --- | --- | --- |
| Keep private, transaction-scoped ownership and current safety checks | Observed disposal and uninterrupted synthetic inference | Six observed owner transactions; some reached 36.6 seconds |
| Keep patched, exactly reviewed dependency versions | Addresses the official HTTP-client advisory with transport tests | Does not patch Node's separately bundled implementation or prove all dependencies safe |
| Preserve existing limits and schedules | Prevents this measurement from silently changing operational behavior | Archiver charge reached 256 MiB; spare capacity is not established |
| Attribute memory pressure before further check reduction | Separates cache, worker and observer effects | Requires a matched sampled/unsampled study and better I/O/reclaim visibility |

Final stack: patched dependencies → sealed source-bound observations → real
database/HTTP contracts → exact-image regression → normal-cadence co-load →
independent restore/history proof → idle disposal → verified cleanup → backed-up
local Compose evaluation.

Next recommended item: a bounded, matched sampled/unsampled **archiver pressure
attribution** study at the same 256 MiB limit, with portable read-only I/O/reclaim
visibility where supported. Reuse existing qualification runners; review shared
fixtures before adding any new control. Determine whether observer cost or file
charge is material before reducing repeated checks, changing limits or claiming
savings. Keep Unraid/shared Ollama untouched and add no admin buttons. The current
study passed its contract, but does not justify broad performance, disk-I/O,
leak-freedom or production-capacity claims.
