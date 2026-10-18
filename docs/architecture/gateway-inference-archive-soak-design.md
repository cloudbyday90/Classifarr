# Gateway inference/archive soak design

## Scope agreed on 18 October 2026

Measure the optional gateway under sustained synthetic HTTP inference while its
unchanged archive scheduler exports and a separate service verifies restores.
This follows the selective-read study; it adds evidence, not production controls.
No Unraid, Plex, shared Ollama, release, schema or runtime-policy changes.

## Research and recommendation stack

Official sources were discovered with MCP search and opened on 18 October 2026.

| Choice | Benefit | Cost or limitation |
| --- | --- | --- |
| Fixed arrivals, bounded concurrency and explicit dropped arrivals | Avoid slowing the offered workload just because responses slow down | A saturated generator invalidates the comparison |
| Monotonic end-to-end and pre-claim timing | Separates observed request latency from SQL claim time | Pre-claim delay includes parsing/authentication and is only an upper bound on queue wait |
| Packaged five-minute worker/verifier loops | Exercises actual scheduling alongside requests | An eight-minute run cannot establish daily cadence or long-term leak freedom |
| Separate networkless restore sandbox | Restored SQL cannot contact the source or provider | Adds bounded CPU, memory and disk contention |
| Existing ESM/Docker harness, no load-test dependency | Reuses image identity, SQL contracts and cleanup | Less general than a dedicated load-test framework |

[Grafana's open/closed model guidance](https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/open-vs-closed/)
explains why completion-driven traffic can hide degraded response times.
[Dropped-iteration guidance](https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/dropped-iterations/)
requires accounting for arrivals the generator cannot start. These principles are
used without adding k6 or claiming equivalent qualification.
[Node 24.21 performance APIs](https://nodejs.org/download/release/v24.21.0/docs/api/perf_hooks.html)
provide process-relative timing and event-loop observations.
[PostgreSQL monitoring guidance](https://www.postgresql.org/docs/current/monitoring-stats.htm)
distinguishes cumulative database statistics from current activity; database-wide
counters are not attributed exclusively to inference.

Recommended stack: existing immutable-image harness → finite open-arrival ESM
driver → actual gateway HTTP/ledger composition → unchanged scheduled workers →
isolated restore verification → checked aggregate evidence and owned cleanup.

## Workload and observations

- Sixty seconds inference-only, 360 seconds archive-active, sixty seconds
  inference-only afterward. Two foreground installations send a pair every two
  seconds, offset by 50 ms, against a fixed 650 ms synthetic provider. Every fifth
  pair adds background work that should be rejected while busy. Total 480
  foreground and 48 background requests; below the unchanged 120/minute limit.
- At most four in-flight client requests; late arrivals beyond 500 ms or exhausted
  slots are counted, never queued into an unbounded catch-up burst. No retries.
- Real gateway authentication, request validation, keyed fingerprints, UUIDv7
  ledger claims and completion receipts. Loopback HTTP inside a networkless
  disposable container deliberately excludes external/TLS/GPU latency; existing
  TLS/network rehearsals remain separate evidence.
- Fixture-only request-context/ledger wrappers measure pre-claim delay and SQL
  claim duration without modifying admission behavior. No exact queue-duration
  claim. Summaries include counts, p50/p95/p99/max and generator lateness.
- Seed 3,000 historical failed archive records with bounded wide metadata, plus
  one genuinely exported/restored prerequisite archive. Historical failures are
  not fabricated successful restores. Capture/restore the real wide catalog
  while inference continues. Preserve all counters, cooldowns and real clocks.
- Run packaged archive/verifier loops for more than five minutes; report actual
  state transitions and request overlap. Do not accelerate daily/hourly policy.
  A source revision race or exhausted budget is reported, not erased.
- Require successful requests, expected busy rejections, finite samples, no
  generator drops, unique fingerprints and matching provider/durable counts.
  Require a verified catalog and requests overlapping export/restore windows.
  Resource OOM/PID/limit events and worker failures fail the rehearsal.

## Isolation, risks and verification

Reuse the disposable schema-check container and labeled volumes only. Archiver:
256 MiB, 0.5 CPU, 32 PIDs; verifier: 1.5 GiB, one CPU, 64 PIDs. Both have read-only
roots, dropped capabilities, no-new-privileges and network disabled. Only the
archiver receives restricted SQL roles/socket; the verifier gets read-only
archives/catalogs, receipts and a private temporary database. No Docker socket,
real credentials, provider payloads or host ports.

The source fixture shares CPU/memory with its disposable PostgreSQL server, so
results are local contention evidence, not production capacity or a universal
speedup. Short-window tail percentiles have limited sample sizes. Aggregate
resource peaks are not equivalent to process memory leaks.

Test scheduling/accounting and invalid evidence deterministically; run the exact
no-cache image with full cleanup checks. Keep design and measured outcome
separate. Back up and refresh only the normal local Compose service after image
checks; the optional gateway remains disabled there.

Run from the repository root with an immutable local image ID and its exact
40-character source revision:

```text
node scripts/run-gateway-online-archive-rehearsal.mjs <image-id> <revision> --inference-soak
```

Allow roughly ten minutes including setup/restore and cleanup. Exit zero means
all accounting, overlap, verification and cleanup checks passed; a nonzero exit
must be investigated rather than retried with counters reset. Output contains
bounded aggregate JSON records, not request bodies or generated credentials.
