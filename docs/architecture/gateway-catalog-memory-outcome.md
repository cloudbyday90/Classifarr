# Gateway catalog memory attribution outcome

Completed locally on 2026-10-18. Implements the
[measurement design](gateway-catalog-memory-design.md), not a runtime memory fix
or reduction in archive verification. No Unraid, Plex or shared Ollama changes.

## What changed

The isolated qualification runner has two explicit modes:

```text
node scripts/run-gateway-online-archive-rehearsal.mjs <image-id> <source-sha> --catalog-memory
node scripts/run-gateway-online-archive-rehearsal.mjs <image-id> <source-sha> --catalog-memory-baseline
```

Both retain the same wide-history scenario and resource limits. The sampled mode
adds bounded cgroup/process observations through small ESM fixture modules, using
the image's existing readers. The baseline omits sampling. Both report monotonic
worker spawn-to-close duration separately from Docker polling time.

Observations do not grant maintenance permission, change attempts, tune memory,
purge history or enable any optional service. No schema or database was added.
The recovery/evidence workflows kept fixtures separate from application files and
required real restore checks, immutable image identity and owned-resource cleanup.

## Exact tested build

- Code revision: `9a94de2cc140288b6b80a014ab476d1e5305355a` on `main`.
- Local Docker image ID:
  `sha256:091a9e5ca75242bee20df98a0bef7f48b04d3954f2bf116c97cdda0add52598a`.
- Built using local Compose `build --no-cache --require-provenance
  --protect-running-image classifarr`; the image revision label matched the code.
- Docker Desktop Linux AMD64, cgroup v1; Docker VM reported 16 CPUs and
  8,330,235,904 bytes of memory. Archivers retained 256 MiB, no swap, 0.5 CPU and
  32 PIDs. Source PostgreSQL ran in a separate 2 GiB container.

This is a local image ID, not published registry provenance. A pilot against the
previous image helped identify the packaged pg_dump symlink target; its timings
are not mixed into the final comparison below.

## Matched comparison

Ran baseline, sampled, sampled, baseline sequentially on the exact image above.
No build or test suite ran alongside these measurements. Normal local applications
continued running. Host caches were not cleared: a no-cache image build does not
make these cold-cache performance tests.

Every run used 3,001 synthetic job rows with about 233.85 MB of serialized JSON,
mostly padding in failed historical manifests. Generated IDs/timestamps differ
between runs; this is a matched workload shape, not identical database bytes.

| Order / mode | First capture, seconds | Second capture, seconds | First / second restore, seconds |
| --- | ---: | ---: | ---: |
| 1: baseline | 22.392 | 26.592 | 14.278 / 13.492 |
| 2: sampled | 24.527 | 27.812 | 17.202 / 13.947 |
| 3: sampled | 21.992 | 27.892 | 13.704 / 14.021 |
| 4: baseline | 20.687 | 25.535 | 14.492 / 14.164 |

All eight large captures and independent catalog restores passed. Each capture's
kernel lifetime peak was 268,435,456 bytes (256 MiB), including unsampled runs.
The restore containers' lifetime peaks were 527.00–539.93 MiB. No OOM, PID-limit
or memory-limit-hit event was reported by the fixture counters.

Unchanged-history, exhausted-attempt and oversized-evidence refusals also passed
in every run, with preserved source-history fingerprints and zero provider calls
or synthetic live-binding deletions. Each run verified removal of its own
temporary containers and volumes.

## What the observations show

The table uses counter values from the same observation as each sampled maximum,
not unrelated maximum values added together. Reads within an observation are
sequential, not an atomic kernel snapshot.

| Sampled run / capture | Sampled current, MiB | File cache, MiB | Anonymous/swap-cache, MiB | Samples / partial |
| --- | ---: | ---: | ---: | ---: |
| 1 / first | 255.98 | 179.70 | 65.10 | 45 / 18 |
| 1 / second | 255.96 | 178.48 | 68.14 | 51 / 23 |
| 2 / first | 252.47 | Unavailable | Unavailable | 41 / 11 |
| 2 / second | 255.98 | 179.92 | 66.28 | 52 / 14 |

These are cgroup v1 `total_cache` and `total_rss`, not Node heap measurements.
Three sampled maxima had a usable breakdown, dominated by file cache. The fourth
had a valid current reading but no usable breakdown in that bounded observation.
Do not substitute another sample for it.

Across these four captures, current usage was available in 189/189 observations,
the cgroup breakdown in 183/189, worker process memory in 123/189, observer memory
in 171/189, and pg_dump memory in eight observations. All four sampled peaks had
unknown dump presence, so the measurements do not locate an exact internal phase
responsible for the peak. Short-lived processes or spikes may fall between reads.

No whole-sample failure or sample-cap exhaustion occurred, but 66/189 observations
were partial. Pressure-stall counters were unavailable on this host, not zero.
Maximum observed sampling gap was about 620 ms. Cumulative observation wall time
was 1.46–2.09 seconds per large capture; that includes scheduling/throttling and
is not a direct measurement of additional CPU cost. The 50 ms budget is checked
between reads, not a hard timeout on a read already underway.

Separate process RSS/PSS observations are retained in the local summaries. They
must not be added to cgroup usage or to overlapping cgroup fields: shared-page
accounting differs. Source PostgreSQL's separate memory/CPU cost was not measured.

Conclusion: this fixture's high usage cannot be treated as 256 MiB of Node heap.
File-cache occupancy explains much of the three observed breakdowns. This does
not establish zero memory contention, rule out every leak, diagnose an Unraid
crash, or prove that reducing dependency scans will lower the lifetime peak.
Two runs per mode on a shared host do not justify a precise overhead percentage
or universal throughput claim.

## Verification and local evaluation

- 563 focused unit tests across 27 suites passed, including all 36 new memory
  tests and existing gateway/resident-memory tests.
- 321 isolated gateway PostgreSQL integration tests across 18 suites passed.
- Repository lint, server/client typechecks, server Knip, static ESM import checks
  and strict ESM mock-shape checks passed.
- The standard online archive/catalog/retention image rehearsal passed, including
  private restore inputs, corruption/inventory tampering, legacy receipt refusal,
  protection markers, shared pins, resumed retirement and final resource cleanup.
- No-cache Compose build and replacement of only the normal local Classifarr
  container passed. `/health` and `/api/system/health/ready` returned 200 with the
  database connected; `/` returned 200.
- Optional gateway/archive/cleanup/catalog schemas remained absent. The existing
  capture budget remained revision 2, `when_idle`, with zero daily calls/tokens
  and zero reserved calls/tokens; its next-check timestamp was unchanged.

Before local replacement, retained
`data/backups/gateway-catalog-memory-before-20261018.dump` (76,239,107 bytes,
mode 0600; SHA-256
`116cb40eca55e97fab3fd0f99c9c12c458e492a2000723347b3bff3c81737d24`).
`pg_restore --list` succeeded; this is not a claim that the live backup was restored.
The previous local image remains protected by a rollback tag:
`sha256:ffb0204ccceb96c3091cd215d7dbb806525ed9843c9a2a5e9ff39fc173f3723a`.
Ignored measurement/build logs remain under `.tmp/catalog-memory-*`.

Full application coverage, the entire catalog qualification matrix, ARM64,
live cgroup v2 sampling and remote release evidence were not rerun for this
fixture-only change. Both cgroup formats have unit coverage. No release or tag
was created. GitHub MCP returned no open Classifarr PRs, so none was selected,
implemented or merged.

## Recommendation

Next, investigate reducing full failed-job payload transfer during dependency
checks, while preserving whole-history size/count limits, complete catalog
capture, pre/post-export file checks, restore verification and retention pins.
The [scan-reduction review](gateway-catalog-scan-reduction-review.md) records the
official sources, alternatives, expected benefit and required failure tests.

Recommended stack: the existing ESM boundary and read-only PostgreSQL snapshot,
a bounded dependency-specific projection, and differential real-SQL/image tests.
Expected benefit is less transfer and parsing; database cost and elapsed time
must be measured. The complete dump still writes full history, so memory peaks
may remain similar. No validation removal, cross-run trust cache, new admin
function or production activation is included in this recommendation.
