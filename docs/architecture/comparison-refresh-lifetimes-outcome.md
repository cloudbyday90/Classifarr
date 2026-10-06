# Comparison refresh phase-lifetime outcome

Date: 2026-10-06. [Design and tradeoffs](comparison-refresh-lifetimes-design.md).

## Implemented

The comparison coordinator now uses a small ESM candidate service with separate
read/ownership and build scopes. The coordinator receives a key and model, not
the initial snapshot or fitting input. The same exact-key verification and
memory safeguards remain in place. No worker protocol, numerical algorithm,
database schema, provider scheduling or representative-hook behavior changed.

The isolated weak-reference regression failed before the change at the fitting
boundary and passed afterward. It proves the original snapshot can be collected
during fitting and the owned input before verification, including unchanged
cache revalidation. Diagnostic GC is confined to a separate test process.

## Paired complete-cycle study

Both runs used the existing synthetic PostgreSQL-backed fixture: 5,776 unique
1,024-dimensional vectors, ten libraries, 2 GiB memory, two CPUs, 128 PIDs and
1,536 MiB V8 old space. Containers were non-root, read-only and network-disabled,
with private temporary databases. Their own image files were used without
source or harness overlays. No provider inference or live database access was
part of the study.

Baseline image/index was
`sha256:a057d278894e6921ce47aeb48190a927a55b37ec5f072f1f013aa4251870cf16`
(source `17bb11d4daf2ff0094dd7ccec9aac8657f7d67c3`). Candidate image/index is
`sha256:5f4406929bca52beaeb5c6699055582880ef631222070877838975fe7570728a`
(source `35eca79a2a6ff1ddc636efa040de2e0bd485b1ec`).

Each collected run completed five refresh cycles: cold publication, unchanged
revalidation, changed-source replacement, revalidation, and another replacement.
Each made twenty snapshot reads and three comparison builds; all six fitting
workers exited. Sampled snapshots and owned vectors were collectible. One
comparison handle remained active until stop; none remained afterward.

| Measurement | Baseline | Candidate | Candidate repeat |
| --- | ---: | ---: | ---: |
| Sampled peak process RSS | 1,169.86 MiB | 1,017.09 MiB | 1,169.00 MiB |
| Sampled peak raw container usage | 1,315.39 MiB | 1,148.98 MiB | 1,307.79 MiB |
| Post-collection active heap range | 171.17–171.58 MiB | 171.13–171.64 MiB | 171.13–171.60 MiB |
| Post-stop collected heap | 8.62 MiB | 8.65 MiB | 8.55 MiB |
| Created / exited fitting workers | 6 / 6 | 6 / 6 | 6 / 6 |
| OOM kills / memory-limit hits | 0 / 0 | 0 / 0 | 0 / 0 |

The first pair suggested about 13% lower peaks, but the candidate repeat was
effectively back at baseline. **A reliable RSS reduction is not established.**
The repeat also completed all five cycles, twenty reads and three builds.
Sampling is periodic and at named phase boundaries, not continuous high-water
measurement. None of these runs qualifies production capacity.
These runs request diagnostic collection only after each cycle, in disposable
processes. The unchanged retained heap is expected: this change shortens
temporary lifetimes, not cache size. Host workload and V8 collection timing can
affect peaks, so the deterministic regression asserts reachability, not RSS.
Retain the small phase separation for its proven ownership/lifetime improvement,
not as a demonstrated solution to peak memory pressure.

## Natural-collection control and limitation

Without diagnostic collection, the candidate completed cold publication and
both workers exited. At its idle observation, heap was 396.90 MiB, RSS 939.04
MiB and raw container usage 1,070.72 MiB. All four subsequent attempts deferred
under the unchanged memory guard, with no further snapshot reads or fitting.
There were no OOM or memory-limit events.

The fixture advances its scheduler clock five minutes but waits only two real
seconds between attempts. This is **not** five successful natural cycles or
proof of a permanent stall. Nor does the lower collected-run peak eliminate the
remaining temporary-memory problem. Representative observer/neighborhood hooks
are not wired in this fixture, and other application caches are outside it.

## Validation

- Sixteen focused suites / 193 tests passed, including cancellation at the new
  phase boundary, changed initial state, freshness, cache reuse and failure stages.
- Backend lint, type checking, normal/production dependency checks, copyright
  and the inventory ownership gate passed; no baseline was regenerated.
- Full backend coverage passed 1,713 suites / 53,323 tests, with one Windows-only
  directory-fsync skip. Its complete/exclusive-copy and unchanged-source
  assertions passed in a separate Linux container using the candidate module
  (native assert replay, not a Jest run).
- Three isolated PostgreSQL suites / 14 tests passed, including concurrent
  cache deletion and representation/freshness scope. No live database was used.
- ESM import/mock checks, migration integrity and Markdown checks passed.
  Coverage ratchet passed without baseline edits: server lines 89.75%, branches
  85.66%. The new candidate module has 100% reported coverage. The unchanged
  client report from the preceding verified run was reused; no client test
  rerun is claimed. The no-cache build rebuilt the frontend successfully.
- Random PR #556 was applied and tested locally, then rejected by the Node 24
  compatibility gate. See its [separate outcome](node-types-pr556-outcome.md).

## Local rebuild and preservation

Compose was rebuilt with `--no-cache --require-provenance` from clean `main`
revision `35eca79a2a6ff1ddc636efa040de2e0bd485b1ec`, native amd64/AVX2.
The candidate image above has native manifest
`sha256:ced9d02576d7c138f52641eaa0d86937c793b0534f3261d08d5843ababa0f287`
and image config
`sha256:357b48463be0c2550bf24485c224a3d0296c2c369aa19ecb5aa1fd54ec54a0a1`.

A 75,684,050-byte database backup passed matching SHA-256 and archive-list
checks before replacement. The helper's subsequent rollback-tag step failed:
overwriting the shared build tag had removed the preceding image index from
Docker Desktop's image lookup. The running container was not changed by that
failure. An already-retained `d4bfc31f...` image was inspected as the fallback;
its application services match the previous image, but its diagnostic harness
predates the private-lock cleanup. It is not an identical-image rollback.
Archive verification is not a restore rehearsal. Future rebuilds should pin
the prior image **before** reusing a tag; the candidate now uses a distinct tag.

Local replacement started 2026-10-06 at 12:40:44 UTC (08:40:44 EDT), healthy with
no restart or OOM kill at the post-start check. Inventory remained 5,820 rows,
migrations 323, and pending/processing queue rows zero across replacement.
The existing mounts, UID/GID and 2 GiB limit matched; no hard CPU quota was
added. Schema dump and independent check both passed in disposable candidate
databases; the committed schema was unchanged and temporary resources cleaned.

### Ten-minute local observation

Thirty-seven samples from 12:41:57 to 12:51:50 UTC (08:41:57–08:51:50 EDT)
all reported healthy, with zero memory-limit hits or OOM kills. The container
had zero restarts. Raw usage ranged from 306.92 to 1,180.33 MiB, with a kernel
high-water mark of 1,199.86 MiB; the final sample was 1,180.21 MiB. The temporary
footprint therefore remains material in ordinary local operation.
The comparison log moved from waiting for other background work at 12:41:45 UTC
to automatic recovery at 12:51:19 UTC, without an operator-triggered refresh.

Peak sampled CPU was 299.99% (about three cores), and Docker's combined
process/thread count ranged from 37 to 48. The inspected process list showed
the application, supervisor, PostgreSQL and init, without accumulating fitting
processes. This does not prove every host process or workload is bounded.
The short observation is not sustained-load, Unraid, ARM or release acceptance.
All isolated memory-study and schema-check containers were removed.

No release, remote PR merge or Unraid deployment is included.

## Next item

Instrument fitting internals to distinguish worker cloning, control-vector
normalization and community-discovery scratch allocations. Include kernel
high-water counters alongside phase samples where available. Then choose the
next bounded copy/lifetime change and repeat natural elapsed-time observation.
Do not replace vector storage or raise memory limits based on RSS alone.
