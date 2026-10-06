# Comparison cache readiness outcome

Date: 2026-10-06. [Design and tradeoffs](comparison-cache-readiness-design.md).
No release or Unraid deployment was performed.

## Cause and deployed observation

The Unraid report at 06:18:45 EDT classified the failure as
`cached_vectors_incomplete`, not `memory_pressure`. Read-only inspection showed
complete movie-library vector coverage but incomplete TV-library coverage.
For TV Shows, coverage advanced from 67 → 243 → 835 → 964 of 964 usable
identities during this investigation. The inspected report had no scheduled
input retries. Existing automatic backfill completed that library without a
reset, settings change, manual recovery or new code deployment.

Import/metadata readiness and optional description-vector readiness are separate
contracts. A completed import can therefore coexist with this warning. It is
not an ownership error. TV Shows completion does not independently prove that
every other library or the global comparison profile is ready.

## Change

Comparison reads now check scoped hash presence before loading vector payloads.
Missing data fails early with sanitized unique-description counts and directs
the operator to Library evidence coverage. Counts are a snapshot of the failed
attempt, not a live per-library total; the existing log deduplication remains.
Current coverage is available in the read-only library view.

The same-transaction presence check preserves representation/freshness scope.
Payload validation, separate post-build verification, default partial
representative profiles, bounded retries, timeouts, memory admission, cache
limits and ordinary retrieval fallback remain unchanged. No schema or API
contract changes were needed. The SQL ownership-review entries were individually
reviewed; indirect-query parser limitations remain explicit.

## Incomplete-cache experiment

Two fresh isolated containers used the rebuilt candidate's actual modules,
5,776 synthetic descriptions and 4,776 cached 1,024-dimensional vectors.
The control exercised the default repository read followed by the existing
completeness guard; the candidate opted into the new preflight.

| Observation at refusal | Control | Preflight |
| --- | ---: | ---: |
| Decoded vectors | 4,776 | 0 |
| Main-thread heap | 106.02 MiB | 20.05 MiB |
| Process RSS | 222.55 MiB | 101.18 MiB |
| Raw container usage | 332.70 MiB | 206.48 MiB |
| Observed operation time | 824 ms | 80 ms |

Both refused incomplete publication with `cached_vectors_incomplete`; the
preflight also reported 5,776 eligible, 4,776 cached and 1,000 missing. These are
synthetic observations, not latency guarantees or full-workload capacity
measurements. A second pair reproduced the result: 217.07 MiB control RSS versus
97.70 MiB preflight RSS, with the same 4,776 decoded vectors avoided. Timings
varied (1,368 versus 90 ms); do not generalize them to production latency. None
of the four runs started a fit worker or performed inference. No OOM or
memory-limit event occurred, and all four containers were removed.

The [whole-refresh retention outcome](comparison-refresh-retention-outcome.md)
records the separate complete-cache findings. This preflight does **not** remove
the high temporary footprint of successful full refreshes or prove that memory
pressure can no longer recur.

## Verification

- Eight focused backend suites / 155 tests passed, including the individually
  updated ownership review. The initial full run started before that review was
  updated and failed only its drift check. The full rerun passed 1,712 suites /
  53,298 tests, with one Windows-only skip. That Linux directory-fsync case's
  complete-copy, unchanged-source and exclusive-target assertions passed in an
  isolated Linux container using the candidate's real module (native assert
  replay, not a Jest suite). A subsequent diagnostic-only cleanup change adds
  five tests for private lock acquisition, contention, callback and unlock
  failure, ensuring the client is always released; it does not change runtime
  services. The final focused replay passed all eight suites / 160 tests.
- Full client coverage rerun passed 443 suites / 6,409 tests. The first parallel
  run timed out in unchanged ESLint configuration setup, leaving 21 cases skipped;
  the isolated lint-contract replay passed all 25 cases with the normal timeout,
  then the full rerun passed without skips. No timeout was raised.
- Coverage ratchet passed without baseline changes: backend lines 89.74%,
  branches 85.65%; client lines 88.78%, branches 80.37%.
- Three isolated PostgreSQL suites / 14 tests passed. Concurrent cache deletion
  cannot make presence and payload reads disagree within a snapshot; a later
  snapshot refuses it. Expired and different-model rows do not count as present.
- Tests cover missing/empty/corrupt caches, refusing both initial and post-build
  missing data, bounded retry, memory deferral, log allowlists and throwing getters.
- Backend/client lint and type checks, Knip, ESM import/mock checks and migration
  checks passed. The external `postgres` binary used only by the private fixture
  is explicitly recognized in Knip; it is supplied by the Docker image, not npm.
- The current open PRs are #555 and #556, both Node 26 type updates against the
  supported Node 24 runtime. The preceding random #555 trial already failed the
  compatibility gate. Neither is eligible for this runtime fix; neither was
  merged or incorporated by bypassing that gate.

## Local rebuild and database preservation

Built with Compose `--no-cache --require-provenance` from clean `main` revision
`421cf28ab2a7f965cbf631e45b8a34a8738f2aa0`, native amd64/AVX2:

- Image/index: `sha256:d4bfc31f002a1362bb0529796fc0a8c88456539400375e71b3543adf6b13d3d6`.
- Native manifest: `sha256:d09a45b733850a8b7328a59140771c8032a7b232ab7ee2b2da7f7cf3faf8687f`.
- Image config: `sha256:42c42fe2886768d7c68fa86a60e7d010c206e76ab016b314517111941cd174e3`.
- Local replacement started 2026-10-06 at 11:50:47 UTC (07:50:47 EDT).

A fresh 75,703,466-byte database archive passed checksum comparison and
`pg_restore --list`; the previous image has a local rollback tag. Archive
readability is not a restore rehearsal. The same local mounts, UID/GID,
configuration and 2 GiB memory limit were preserved. Compose still has no hard
CPU quota; application admission/concurrency controls were not changed.
Inventory stayed at 5,812 rows and migrations at 323 across replacement, with
zero pending/processing queue rows at both checks.

After rebuilding, schema dump and independent check both passed in disposable
candidate-image databases. `database/schema/current.sql` was unchanged; both
schema containers and their dedicated temporary directories were cleaned up.

### Bounded live observation

The first rebuilt image above was observed from 11:52:03 to 12:11:55 UTC in
73 samples. Every sample reported healthy; there were no container restarts,
OOM kills or memory-limit hits. Raw usage ranged from 309.26 to 1,252.11 MiB
at sample time, with a kernel high-water mark of 1,286.59 MiB. It later fell to
561.16 MiB without diagnostic collection. The decline alone does not establish
which collection or allocator behavior caused it.

Peak sampled CPU usage was 168.2% (about 1.68 cores); Docker's combined
process/thread count ranged from 35 to 50 and returned to 38. The inspected
process list contained the application, supervisor, PostgreSQL and init; no
accumulating fitting processes were observed. Comparison work recovered from a
busy state automatically during the observation. These twenty minutes are not
a sustained-capacity qualification, an Unraid test or an ARM qualification.

### Final diagnostic-cleanup image

After the private diagnostic-lock cleanup was hardened and its tests passed,
Compose was rebuilt again with `--no-cache --require-provenance` from clean
`main` revision `17bb11d4daf2ff0094dd7ccec9aac8657f7d67c3`:

- Image/index: `sha256:a057d278894e6921ce47aeb48190a927a55b37ec5f072f1f013aa4251870cf16`.
- Native manifest: `sha256:dd2a12a230ff35403e397bdeedd3e23f7b3bf6669634ffe7b782e404f3ba5c9d`.
- Image config: `sha256:4c527a0686d7482bf584e9636c30ddde222911760694e5235625c83ac1eaa63d`.
- Local replacement started 2026-10-06 at 12:13:06 UTC (08:13:06 EDT).

A second 75,688,059-byte database backup passed checksum and archive-list
checks; the preceding image was retained under a rollback tag. The final
container is healthy with no OOM kill or restart. Its checked inventory was
5,818 rows, with 323 migrations and no pending/processing queue rows. Plex sync
remained active between replacements; this later count is not a same-instant
before/after preservation assertion.

Schema dump and independent schema check passed again using disposable final-
image databases, without changing the committed snapshot. The Linux native
directory-fsync replay and the natural memory-study control passed on this
image. All diagnostic containers were removed. The runtime service patch is
identical to the first image; the twenty-minute observation above belongs to
that earlier image, not this later replacement. No full refresh memory limit
was raised and no production collection was forced.

## Next item

Reduce temporary full-snapshot/model-copy overlap during successful refreshes,
then repeat natural complete-cycle measurements. Preserve exact identities,
owned worker inputs, fresh verification and all memory safeguards. Do not
accelerate provider backfill or rewrite model storage without measured evidence.

The first [phase-lifetime follow-up](comparison-refresh-lifetimes-outcome.md)
is now implemented and measured. Its remaining work is to separate internal
fitting/normalization costs and observe natural elapsed-time recovery.
