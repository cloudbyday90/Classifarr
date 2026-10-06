# Comparison memory phase investigation outcome

Date: 2026-10-06. [Design, sources and tradeoffs](comparison-memory-phases-design.md).

## Implemented scope

Small ESM diagnostic modules now distinguish worker fitting, broad-control
construction, local-community discovery and quality work. The isolated study
records monotonic elapsed time and the kernel's cumulative cgroup high-water mark,
including explicit null when unavailable. Its new `elapsed` mode uses real time
and five-minute waits; existing fast modes still use an injected scheduler clock.
No production algorithm, admission threshold, GC, cache, ownership or retry policy
changed. No schema, dependency or UI contract changed.

## Collected control

Source `e485b279b8b1bade4eb5541d5050c50b8d80033b`, built without cache:

- Image/index: `sha256:68aca43cb689bf5c75f1acadad0fd8566dd3d21ff71b929b0d00054c156acfd1`.
- Native manifest: `sha256:b30b4d06bde0cf9299f63bcd74bc6c5f88bcb7d015379e3dcb212446f59ab6e8`.
- Config: `sha256:1cdfcb36c11190b2c7fade03f42d6c4e692147ed072c1e34376c2c81a4e18e8b`.

The synthetic fixture has 5776 unique 1024-dimensional vectors and ten libraries.
It uses real PostgreSQL vector transport, transactions and advisory locking, plus
the production refresh factories, fitting workers and memory guards. Catalog and
provider identity are synthetic; optional representative observation/neighborhood
hooks are not wired. There are no external provider calls or live app-data mounts.
Limits: 2 GiB, two CPUs, 128 PIDs, 512 MiB private tmpfs, 1536 MiB V8 old-space;
non-root, read-only root, no network/capabilities, 35-minute outer deadline.

Five collected cycles completed in 247 seconds: ready, revalidated, ready,
revalidated, ready. There were 20 snapshot reads, three comparison builds and
six workers; every worker exited. Diagnostic GC occurred only at settled points
in this disposable run. Injected clock changes are not elapsed cooldown evidence.

| Measurement | Observed |
| --- | ---: |
| Highest sampled process RSS | 997.48 MiB |
| Highest sampled raw cgroup use | 1129.67 MiB |
| Kernel cumulative memory peak | 1136.55 MiB |
| Highest sampled RSS within a comparison worker-fit interval | 897.02 MiB |
| Highest sampled active worker heap | 214.02 MiB |
| Collected active heap range | 171.20–171.68 MiB |
| Collected heap after stopping both refreshers | 8.66 MiB |
| OOM kills / memory-limit hits | 0 / 0 |

Sampled original snapshots, decoded vectors, owned inputs and community scratch
rows/vectors were all collectible at every settled point. One active comparison
handle remained until stop, then none. This is bounded retention for the sampled
fixture, not a leak-free claim for the entire application.

The highest RSS sample was in unchanged revalidation, without a new worker in
that cycle. Changed-cycle verification also reached about 843 MiB main-thread
heap. Worker cloning is therefore not established as the dominant peak. Earlier
worker allocation can still influence allocator retention; RSS alone does not
assign exact ownership. Code inspection confirms independently normalized broad
vectors, community rows and graph input, but does not quantify their exclusive
cost. The stronger next lead is complete snapshot loading/verification.

Phase summaries cover the interval after each named marker. Repository read
markers are emitted after the read; the interval following `build_end` includes
the fresh verification read. Kernel peak values are cumulative for the disposable
container, not phase-local peaks. One-second samples may miss process-level peaks.

## Vector-copy allocation control

The subsequent diagnostic-only addition is source
`b875b1e2c33bd586711aacd45a012254b66f67f2`. It adds `copies` mode without changing
the elapsed harness or production services. A second no-cache build produced:

- Image/index: `sha256:280d6ae4766c7b58b95e78c910b0697ca3d23d1fdf5f79b031af82eefc0561f9`.
- Native manifest: `sha256:c5dd2e802b606650e0cfa8dcfe50f075e4c7cec40d9301f0bb437ea119eb5d56`.
- Config: `sha256:ae9c4e23e98e52cab11f74c756a01d3193d6471c126ae74ef976676dde4e2dec`.

The same synthetic fixture was measured with diagnostic GC after each allocation,
deliberately keeping all earlier maps alive until leaving the measuring scope.

| Retained state | Heap | Increment |
| --- | ---: | ---: |
| Fixture baseline | 7.86 MiB | — |
| Decoded snapshot | 56.00 MiB | 48.14 MiB |
| Plus owned fitting input | 102.51 MiB | 46.51 MiB |
| Plus structured-cloned vector map | 238.95 MiB | 136.44 MiB |
| Plus normalized map | 284.58 MiB | 45.63 MiB |
| Plus independently normalized duplicate | 330.20 MiB | 45.62 MiB |
| After leaving the copy scope | 7.53 MiB | — |

All five maps contained 5776 vectors. Kernel peak was 585.27 MiB; no OOM or
limit hit. This is a same-isolate structured-clone allocation control, not a
measurement of worker-message serialization alone. It identifies a substantial
clone cost and repeated normalization cost on this Node build. These numbers
must not be added to predict production peaks: actual lifetimes overlap
differently. Releasing every map returned collected heap to baseline.
An independent repeat matched each retained-heap reading within 0.01 MiB, including
136.43 MiB for the clone and about 45.6 MiB for each normalization.

## Verification to date

- Full backend coverage run at the phase-study revision: 1713 suites, 53331 tests
  passed, one Windows-only directory-fsync skip. A native Linux candidate-image
  replay of exclusive copy, directory fsync and unchanged source passed.
- Final focused diagnostic tests, including copy control: two suites, 85 tests
  passed. Isolated PostgreSQL checks: three suites, 37 tests passed.
- Server lint/typecheck, normal/production dependency checks, copyright,
  inventory ownership, ESM and migration/schema naming gates passed. No baseline
  was loosened. Coverage ratchet passed with current backend/client reports;
  backend lines 89.75%, branches 85.66%. Markdown checks passed.
- Initial client run under concurrent build/backend load: 442 files passed,
  one lint-contract setup timed out at its unchanged 10-second limit; its 21
  cases were consequently skipped. Isolated lint-contract retry: two files,
  25 tests passed unchanged. Full client coverage rerun with two workers: all
  443 files and 6409 tests passed, with unchanged assertions/timeouts. Client
  lines 88.78%, branches 80.37%.
- Random open [PR #555](node-types-pr555-outcome.md) was applied locally, rejected
  by the existing Node-major gate and reverted. No merge or dependency install.

## Local rebuild evaluation

The first no-cache image (`e485b279`) replaced local Compose and became healthy.
Schema dump and check used separate disposable candidate-image databases and
left `database/schema/current.sql` unchanged. Inventory was 5823 before and after
replacement; 323 migrations remained recorded. Local appdata and media mounts
were preserved. Unraid was not modified.

The 09:16:08–09:26:05 EDT observation collected 37 samples, all healthy, no OOM
or limit hits. Raw cgroup usage ranged 326.77–894.13 MiB; kernel peak 934.64 MiB;
sampled CPU peaked at 98.62% (about one core). Docker PIDs/threads ranged 37–48.
The observed process list comprised init, Node supervisor/application and
PostgreSQL. This short window did not reveal accumulating processes; it cannot
rule out all longer-lived problems. Compose retains its 2 GiB limit and user
1000:1000, with no configured CPU quota or PID cap. No constraints were changed.

The pre-rebuild custom-format backup was checksum/list verified, 75,670,824 bytes,
SHA-256 `3c7ed4e75f2612b2e050547092e6c673ef634ff48f74539fb1a9c04e6f599e5a`.
Original image `5f440692…` was pinned before building. Backups remain private
under ignored `.tmp`; archive readability is not a restore rehearsal.

The final `b875b1e2` image was also built without cache, deployed locally and
became healthy at 09:28:20 EDT. Its independent schema dump/check again passed
without a schema diff; its native Linux fsync replay passed. The intervening
database backup was 75,670,172 bytes, checksum/list verified with SHA-256
`4bccd6deb3e3d8ebff27d5def86926949cc477c861aca59647d47d511607ac13`;
the previous exact image was pinned for rollback. Inventory was 5827 after the
second replacement; ordinary local ingestion continued between observations.

Final-image observation, 09:29:19–09:39:09 EDT: 37 healthy samples, raw cgroup
369.99–828.04 MiB, cumulative kernel peak 855.89 MiB, sampled CPU peak 100.24%,
37–48 PIDs/threads, zero limit hits, OOM kills or container restarts. These numbers
are a short window, not a claimed improvement: no runtime allocation code changed.
All owned study/schema/fsync containers were removed; local Classifarr and the
user's unrelated Harmoniarr container remained running.

## Natural elapsed cycles

The fixed `e485b279` image completed the separate elapsed study in 1409.9 seconds
(23 minutes 30 seconds), with no inspector session or forced GC. It exercised
five real attempts with at least five minutes between cycles:

| Cycle | Input | Comparison result | Heap before attempt |
| --- | --- | --- | ---: |
| 0 | Cold | Ready | 9.34 MiB |
| 1 | Unchanged | Revalidated | 171.65 MiB |
| 2 | Changed | Ready | 171.61 MiB |
| 3 | Unchanged | Revalidated | 171.69 MiB |
| 4 | Changed | Ready | 171.68 MiB |

There were 20 snapshot reads, three builds, six workers created/exited and zero
remaining workers. No OOM or limit event occurred. Highest sampled process RSS
was 993.18 MiB; raw cgroup peak sample 1125.29 MiB; kernel high-water 1127.01 MiB.
The comparison worker-fit interval reached 911.61 MiB RSS, still below the
verification/publication region.

Natural reclamation returned heap to about 172 MiB between attempts. This
contradicts a permanent stall in this fixture, and shows why the prior two-second
injected-clock control could defer while real five-minute attempts succeed.
It does not guarantee recovery under continuous competing application work.

After the final cycle, heap was still 841.76 MiB at two seconds and 842.13 MiB
two seconds after cache shutdown. Some weakly observed inputs/handles had not
yet been collected. No post-stop five-minute wait was measured. Do not interpret
that short uncollected tail as proof of a leak or claim that stopping immediately
returns RSS to baseline. The separate collected run establishes collectibility.
No reliable runtime memory reduction is claimed from this diagnostic-only work.

## Reproduction and recommendation

Use an inspected immutable image containing these scripts. Each invocation is a
new disposable container; never run it inside the application container or attach
appdata, provider credentials or the Docker socket.

```sh
docker run --rm --no-healthcheck --network none --read-only --user 1000:1000 \
  --cpus 2 --memory 2g --pids-limit 128 --cap-drop ALL \
  --security-opt no-new-privileges \
  --tmpfs /tmp:rw,size=512m,uid=1000,gid=1000 \
  -e CLASSIFARR_SYNTHETIC_MEMORY_STUDY=1 \
  -e NODE_OPTIONS=--max-old-space-size=1536 \
  --entrypoint timeout IMAGE_ID -s TERM 2100 node \
  /app/src/scripts/comparisonMemoryStudy/run.mjs elapsed
```

Use `collect` for the fast GC-assisted lifetime control, or `copies` for the
separate incremental allocation control. Neither is evidence of natural timing.
Kernel peaks include private PostgreSQL/tmpfs and other container charges, whereas
RSS spans the Node process and worker heaps are thread-local. Background host
tests/builds and the local app were also running during parts of this investigation;
this is not an isolated latency benchmark or release capacity qualification.

Recommended next stack:

1. Investigate bounded vector read/decode transport during fresh verification.
   Benefit: targets the largest observed phase, including unchanged revalidation.
   Cost: must retain repeatable-read consistency, exact values, corruption checks,
   cancellation and bounded transactions; do not reuse stale snapshots.
2. Evaluate reuse of privately owned normalized vectors across build stages.
   Benefit: avoids repeated roughly 46 MiB allocations in this fixture. Cost:
   must preserve numerical results, validation and caller ownership.
3. Evaluate packed transferable worker input separately. Benefit: the observed
   cloned map costs roughly 136 MiB. Cost: transfer detaches buffers and needs a
   private ownership protocol; it does not eliminate verification peaks.

Keep all admission safeguards and normal GC behavior. Do not claim a runtime
memory reduction until a proposed change passes equivalent same-fixture repeats.
