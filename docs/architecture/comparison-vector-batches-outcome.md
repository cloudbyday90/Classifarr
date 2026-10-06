# Bounded comparison vector decoding outcome

Date: 2026-10-06. [Design and official sources](comparison-vector-batches-design.md).

## Implementation

A small ESM vector reader decodes batches before requesting more encoded rows.
The representative/comparison repository uses it inside its existing repeatable-read,
read-only transaction. Both refreshers now pass their existing abort signal into
initial and fresh verification reads. Other consumers retain their existing
capture/decode behavior. No memory safeguard, retry budget, schema, dependency,
vector value, fingerprint algorithm or publication criterion changed.

The batch is at most 256 rows and 262144 components. The final private map still
holds the admitted snapshot. This reduces the lifetime of encoded rows, not the
size of every downstream allocation; runtime improvement requires measurement.

## Verification

- Focused service tests: 12 suites, 187 tests passed. Covers exact values and
  fingerprints, row/component bounds, complete-input validation, corrupt and
  out-of-scope rows, cancellation before and during SQL, and cooperative shutdown.
- Isolated PostgreSQL tests: three suites, 25 tests passed. Concurrent deletion
  and replacement in a later batch remain invisible to the current snapshot and
  visible to the next read. Aborted reads roll back without partial publication.
- Server lint and typecheck passed. Dependency checks, copyright, migration/schema
  naming, static ESM imports and Markdown checks passed.
- Static ownership review detected the changed repository source. Reviewed its
  complete query adapter and bounded reader: same read-only transaction, no new
  protected inventory DML, and unchanged analysis digest. Updated only that
  source digest and its existing review explanation; unresolved debt remains.
- [PR #555 trial](node-types-pr555-outcome.md) failed the unchanged Node-major gate
  and was reverted without installation or merge. No dependency edits remain.
- The first full backend run overlapped the explicit ownership-digest review:
  1713 suites / 53364 tests passed; the one failure was the old recorded source
  digest. The reviewed gate suite then passed all 39 tests; the combined final
  targeted run passed five suites / 103 tests. The clean full coverage rerun
  passed all 1714 suites / 53365 tests in 830.561 seconds. Its one Windows-only
  directory-fsync skip was verified separately in both candidate Linux images.
- The first client run under build/backend contention timed out in the existing
  10-second lint-contract setup (442 files / 6388 tests passed, 21 consequential
  skips). With the build finished, the unchanged full two-worker rerun passed
  all 443 files / 6409 tests. No timeout or assertion was relaxed.
- Coverage ratchet passed with current reports: backend lines 89.75%, branches
  85.67%; client lines 88.78%, branches 80.37%. No coverage baseline changed.

## Exact images and local rebuild

Both candidate images were built without cache from clean commits:

- Runtime change: `5692f49b92f74d1cb9937c2354eca18d54d6ddf5`;
  image/index `sha256:32f57d312947320a71fc2ab66acefff14a84887f8f183b095681f8bb0ce0801e`,
  native manifest `sha256:0eca019d692f262d074254412b18bc18e7ed3b87a34cb66c3dd7cf346c29ac8e`,
  config `sha256:fd8d8018545f02b31a62ab7c6929a8eefe719ac7424e6834a0b66f9ee623eab4`.
- Final image: `d94d1d8ba14e7f78fdef55653e5921ff876df1aa`;
  image/index `sha256:dc99037c045017cc84aac4b6f00f1d3dbc0543f36b7a878562f80cd85c94c704`,
  native manifest `sha256:1ead315e88c335b471e25968328e4cecc40ea743ffd5bf34528459f89ba49340`,
  config `sha256:43aa0eec7573f924acad5689a9d97f5edb7f6ff9c338e067034a21e102f56b64`.
  The second commit only clarifies comments/documentation; no runtime behavior
  differs from the first candidate.

The old-image comparison uses source `b875b1e2`, immutable local image/index
`sha256:280d6ae4766c7b58b95e78c910b0697ca3d23d1fdf5f79b031af82eefc0561f9`.
These are local development images, not evidence of upgrading from a published
release. No release or Unraid change is included.

Before each local replacement, a private custom-format database backup was
checksum/list verified and the previous exact image pinned for rollback:

| Backup | Bytes | SHA-256 |
| --- | ---: | --- |
| Before first candidate | 75669310 | `1d5b51afcc39e4e73111bca0545730a13c8b26421b8b3917d86499b1f8960f3b` |
| Before final candidate | 75658355 | `ca5682a5bc8eab87cf85ceea8e764c36e7642a46d896d642fab5ff27970e149b` |

Backups stay in ignored `.tmp`; archive readability is not a restore rehearsal.
Local inventory remained 5827 rows and migrations 323 across the first replacement.
The existing appdata/media mounts, user 1000:1000 and 2 GiB memory limit remained.
No CPU quota or PID cap was added to the user's Compose configuration.

First-image observation, 14:05:33–14:15:32 UTC: 37 healthy samples, raw cgroup
308.20–444.26 MiB, kernel high-water 809.91 MiB, sampled CPU peak 118.11%, no
memory-limit hits or OOM kills. Short observation is not a sustained-load claim.
Its isolated schema dump/check and native Linux directory-fsync replay passed.

The final image started at 14:18:37 UTC, healthy with zero restarts/OOM kills.
Its independent schema dump/check and native Linux fsync replay also passed;
`database/schema/current.sql` is unchanged. From 14:18:55–14:28:49 UTC, all 37
samples were healthy: raw cgroup usage 409.60–759.25 MiB, kernel high-water
772.88 MiB, sampled CPU peak 143.91% (about 1.44 cores), and 36–49 PIDs/threads.
There were zero memory-limit hits, OOM kills or restarts. The process list showed
the expected supervisor/application and PostgreSQL processes, not accumulating
fit workers; this is not a claim that every host process is controlled.

The bounded read-only local diagnostic still reported readiness `backfilling`.
Its latest durable memory-pressure warning was at 13:58:45 UTC, before either
candidate replacement; the later observed comparison event was deferred for
background work. No subsequent recovery event was observed in that check. Do
not interpret container health or a separate diagnostic process's memory
admission as proof the application's comparison cache is ready. Inventory later
reached 5832 rows during ordinary ingestion; migrations remained 323.

All owned study/schema/fsync containers were removed and their absence checked.
The local Classifarr and the user's unrelated Harmoniarr container remain
running. No Docker prune, user-data deletion or Unraid operation was performed.

## Collected profiling comparison

Reuse the [isolated phase-study procedure](comparison-memory-phases-outcome.md):
5776 synthetic 1024-dimensional vectors, ten libraries, real PostgreSQL transport
and production refresh factories/workers. Each fresh container has 2 GiB memory,
two CPUs, 128 PIDs, 512 MiB private tmpfs, 1536 MiB V8 old-space and a 35-minute
outer deadline. No network, live data, credentials or Docker socket. Optional
representative observer/neighborhood hooks are not included. Diagnostic collection
occurs only at settled points in `collect`, never in the application or `elapsed`.

| Run | First-read heap | Sampled peak RSS | Kernel peak | Collected stopped heap |
| --- | ---: | ---: | ---: | ---: |
| Old image, repeat 1 | 123.94 MiB | 1115.52 MiB | 1255.62 MiB | 8.68 MiB |
| Old image, repeat 2 | 124.17 MiB | 999.55 MiB | 1140.11 MiB | 8.72 MiB |
| Candidate `5692f49b` | 79.63 MiB | 987.57 MiB | 1123.05 MiB | 8.74 MiB |
| Final candidate `d94d1d8b` | 79.05 MiB | 994.09 MiB | 1131.81 MiB | 8.76 MiB |

Each completed run had five successful comparison attempts (ready/revalidated/
ready/revalidated/ready), 20 snapshot reads, three builds and six workers created
and exited. No OOM or limit event. Collected active cache heap remains about
171–172 MiB; this change does not shrink the published model.

The deterministic test proves each encoded batch is decoded before the next SQL
request. First-read heap is lower, but whole-process peaks vary substantially,
including between unchanged old-image repeats. Kernel peak includes PostgreSQL
and tmpfs; one-second process samples can miss peaks. Concurrent host tests/builds
and the local application make elapsed times unsuitable as latency benchmarks.
Do not extrapolate these readings into an application-wide leak-free or fixed
memory-pressure claim. Both candidate reads retained about 44–45 MiB less heap
at the first-read marker (roughly 36%), not after a forced collection at that
marker. Whole-cycle peaks remain near the better baseline reading; do not claim
a material application-wide peak reduction. All tracked scratch objects and
handles were collectible after shutdown in each collected run.

## Natural elapsed cycles

The `5692f49b` image completed five real-time attempts in 1452.36 seconds
(24 minutes 12 seconds), with at least five minutes between cycles, no inspector
and no forced GC. Results were ready, revalidated, ready, revalidated, ready;
20 reads, three builds and six workers created/exited, with zero remaining.
No OOM or memory-limit event occurred.

Before cycles 1–4, natural heap was 171.82, 171.84, 172.26 and 171.95 MiB. Thus
later attempts still proceeded without operator action or a relaxed safeguard.
After the final cycle heap was still 844.36 MiB at two seconds, and 844.74 MiB
two seconds after stopping. Some weakly tracked objects were uncollected then;
there was no post-stop five-minute observation. This short tail is not proof of
a leak or prompt RSS release; collected controls establish collectibility only.

The natural run reached 1090.04 MiB sampled RSS, 1236.06 MiB sampled raw cgroup
usage and 1240.18 MiB kernel peak. Those are **higher** than the prior natural
control's 993.18 / 1125.29 / 1127.01 MiB. Host load and GC histories differ and
old-image collected repeats themselves varied substantially. This does not prove
an application-wide peak improvement or isolate the cause of the higher reading.
Keep this limitation visible; repeat paired natural runs for any future capacity
claim. The demonstrated benefit is bounded encoded retention and reduced
initial-read heap, not a solved memory-pressure warning.

## Recommendation stack

1. Keep bounded decoding with the existing guards and fresh verification. Benefit:
   demonstrated lower initial-read heap and earlier cancellation. Cost: bounded
   parsing now occurs inside the read-only transaction; keep its timeouts and
   investigate slow-storage deployments separately.
2. Next, reduce duplicate normalization of privately owned build vectors. The
   [prior allocation control](comparison-memory-phases-outcome.md) measured about
   46 MiB per normalized copy. Benefit: targets remaining repeated build-stage
   allocation. Cost: must prove unchanged numerical results, corruption checks
   and caller ownership; do not introduce an unchecked skip-validation flag.
3. Evaluate packed transferable worker input only after that comparison. Benefit:
   may avoid the measured clone cost. Cost: explicit buffer ownership/detachment
   and a new worker protocol; it cannot alone eliminate fresh-verification peaks.

No new provider calls, database migration, deployment-template requirement or
security bypass. Keep memory admission, reserve/headroom, normal GC and failure
visibility unchanged. No UI was changed and no new accessibility claim is made.
