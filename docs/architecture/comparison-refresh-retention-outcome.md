# Comparison refresh retention outcome

Date: 2026-10-06. [Design](comparison-refresh-retention-design.md).

## Findings

The isolated experiment did **not** show accumulating fitting workers or retained
snapshots across completed refreshes. It did reproduce large temporary memory
usage and subsequent admission deferral without foreground application traffic.
This is not proof that every production memory path is leak-free.

Both initial runs used local image/index
`sha256:c4ea0c852c8dead20c848ffccfea066a4ee2cd821be625d1fe6363a7351cd293`,
built from `f225b3689f35cf65a363b4ed7024a895b6ebc21f`. Only the new diagnostic
harness directory was mounted into that fixed image; production modules were
not overlaid. This is a synthetic lifecycle experiment, not release acceptance.

The fixture used 5,776 unique 1,024-dimensional vectors, ten synthetic libraries,
real PostgreSQL vector reads/decoding, production refresh factories, fitting
workers and model caches. Catalog/state queries and provider inspection were
synthetic. No inference or live database access occurred. Limits were 2 GiB,
two CPUs, 128 PIDs and 1,536 MiB V8 old space, with a private cluster in 512 MiB
tmpfs. Containers were read-only, network-disabled and automatically removed.

## Complete-cycle retention

A separate diagnostic pass requested garbage collection **only in its disposable
synthetic process** after each cycle. The injected clock advanced five minutes
between cycles; real idle waits were two seconds. This isolates reachable
retention but does not prove natural GC timing or elapsed scheduler cooldown.

| Phase after diagnostic collection | Main heap MiB | Process RSS MiB | Raw cgroup MiB | Workers created / exited |
| --- | ---: | ---: | ---: | ---: |
| Baseline | 7.84 | 69.92 | 174.30 | 0 / 0 |
| Cold publication | 171.08 | 251.55 | 363.61 | 2 / 2 |
| Unchanged revalidation | 171.16 | 249.86 | 359.71 | 2 / 2 |
| Changed-source replacement | 171.49 | 252.49 | 364.22 | 4 / 4 |
| Unchanged revalidation | 171.45 | 252.41 | 361.90 | 4 / 4 |
| Second changed-source replacement | 171.65 | 253.73 | 365.06 | 6 / 6 |
| Stopped / cleared caches | 8.63 | 78.05 | 187.76 | 6 / 6 |

Twenty repository snapshots were read and three comparison models built.
Weak references to sampled snapshots, decoded vectors, owned training sources
and owned vectors were dead after collection. Exactly one comparison handle
remained while active and none after stop. Worker heap observations peaked around
212 MiB per observed fit; all workers exited. Process RSS includes workers and
must not be added to their heap measurements as if these were separate processes.

Observed process RSS peaked at about 1,160 MiB and raw container usage at 1,299
MiB during fitting/replacement, despite a post-collection heap floor near 171
MiB. The active caches account for roughly 163 MiB of reachable main-thread heap
above the stopped state in this fixture. Cache weight is an estimate, not a
measurement of all JavaScript overhead or temporary build allocations.

## Natural collection control

Without diagnostic collection, cold publication completed with two workers
created and exited. At its two-second idle observation, process RSS was about
949 MiB, main heap 535 MiB and raw cgroup usage 1,081 MiB. The next four attempted
cycles were deferred by the unchanged memory guard; no additional workers were
created. This control did **not** complete five successful natural refreshes.

The weak references remained alive in the short natural-control window, which
does not establish a strong-reference leak: the separate collected run reclaimed
them. Neither run recorded an OOM kill or memory-limit hit. The local production
observation from the previous round already showed automatic later recovery;
this accelerated experiment must not be presented as a permanent runtime stall.

## Decision and next work

Do not raise limits, loosen admission, disable safeguards or force production GC.
Do not claim allocator fragmentation solely from an RSS/heap gap. The measured
work is repeated full-vector transport, decoding, owned copies, fitting and
fresh verification overlapping with the currently cached model.

First address the independently confirmed incomplete-cache path with a cheap
[readiness preflight](comparison-cache-readiness-design.md). Next, measure and
reduce snapshot/copy lifetime overlap during **complete** refreshes, preserving
owned worker inputs, exact source identity and fresh post-build verification.
Repeat natural multi-cycle observation before choosing a transport/storage rewrite.

## Reproduction

The reusable ESM entry point is
`server/src/scripts/comparisonMemoryStudy/run.mjs`. Run only in a disposable
container built from the desired source revision, never through `docker exec`
in the application container. Replace `IMAGE_ID` with an inspected immutable
local image ID; do not mount appdata, credentials or a Docker socket.

```sh
docker run --rm --network none --read-only --user 1000:1000 \
  --cpus 2 --memory 2g --pids-limit 128 --cap-drop ALL \
  --security-opt no-new-privileges \
  --tmpfs /tmp:rw,size=512m,uid=1000,gid=1000 \
  -e CLASSIFARR_SYNTHETIC_MEMORY_STUDY=1 \
  -e NODE_OPTIONS=--max-old-space-size=1536 \
  --entrypoint node IMAGE_ID /app/src/scripts/comparisonMemoryStudy/run.mjs natural
```

Repeat separately with `collect` for diagnostic retention, or
`incomplete-baseline` and `incomplete-preflight` for scoped-read comparison.
Output is bounded aggregate JSON lines. Main/worker heaps, external buffers,
process RSS and raw cgroup usage are distinct measurements; array buffers are
included in external memory. No heap snapshots or inspector ports are exposed.
