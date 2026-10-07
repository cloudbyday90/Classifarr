# Representative consumer profiling outcome

Implementation date: 2026-10-07. See the
[design, research and tradeoffs](comparison-consumer-profile-design.md).

## Implemented

The isolated catalog study now attaches the production shadow-comparison and
neighborhood-recovery factories. At most two synthetic unseen queries are
generated per admitted representative preparation, without routing authority or
external traffic. Preparation and synchronous publication receive separate
main-thread heap/process-RSS checkpoints; normal asynchronous measurements still
cover workers, container memory and resident attribution. Weak references track
staged batches and model objects without owning their snapshots.

The v2 catalog receipt requires real consumer activity, no invalid input or
observer errors, published readiness, cleared consumers at stop, and a later warm
cycle for both representative and comparison work. v1 results do not establish
coverage of these consumers. Ordinary production behavior, safeguards, limits,
retry policy, deployment configuration and garbage collection are unchanged.

The recovery-change skill guided regression-first tests and explicit completion
evidence; the dependency-update skill kept the unrelated PR trial bounded.

## Verification

- Regression-first run: the new module was absent and two boundary assertions
  failed; ten existing assertions passed.
- Focused study tests: seven suites, 124 passes before the final added lifetime
  and bounds cases. The subsequent consumer/lifetime run passed two suites and
  eleven tests, including real-consumer snapshot collectability before verification.
- Real PostgreSQL integration: two suites, 22 passes.
- Backend lint/typecheck, development/production dependency checks, copyright,
  static-import checks and Markdown checks passed.
- Full backend suite: 1,731 suites and 53,810 tests passed, with one Windows-only
  skip, in 518.639 seconds. The separate Linux image check covers that filesystem
  operation. No coverage-baseline refresh or security-gate relaxation was needed.
- The exact-image catalog study passed, including owned cleanup; details below.

The lifetime subprocess deliberately uses GC as a reachability assertion; the
catalog measurement does not force GC. The Linux candidate-image check passed
directory fsync, exclusive copy and source preservation using the actual image
module, without network or appdata.

## Random open PR

Fresh enumeration found #555 and #556. Random selection chose
[#556](https://github.com/cloudbyday90/Classifarr/pull/556), immutable head
`9d74537d7917c248d15926f37b2e40ceba7559a4`. Applied its exact server manifest and
lockfile changes: `@types/node` 24.19.1 to 26.6.4, and `undici-types` 7.24.6 to
8.9.0. Registry metadata confirmed integrity and the dependency, with no scripts
or peers. The existing runtime gate failed one of eight checks because Node 26
declarations disagree with deployed Node 24.21.0. Reverted before installation;
all eight restored checks passed. No installed-candidate audit/build claim, merge
or retained dependency change.

Fresh server outdated results also list dotenv 18.0.6, express-rate-limit 8.7.1,
js-yaml 5.4.3 and knip 6.40.0; those need their own scoped reviews.

## Candidate image

Clean implementation commit: `9e33fadb4bcc0d2aec11a36a5e8b80c4d1d7c6be` on main.
Local Compose built with `--no-cache --require-provenance` and pinned
Node 24.21.0/npm 12.2.0. OCI revision matches that implementation commit.

- Image/index: `sha256:36be70f7f58448b7daeb988fa8b93c937b622e491508ba8f982258b9ebdabfc7`.
- Native manifest: `sha256:19371d22e6733329a92e26b22f51c94c5c472b97170c38257ddc540a892ec891`.
- Configuration: `sha256:582ffc560daee6c3b6309d26776efb50cd3b698b46bacc92ee8c63564f2cbe52`.

The previous image was pinned as `classifarr:pre-consumer-profile-fc9ec82f` before
replacing its mutable tag. After rebuilding, the isolated schema dump and
independent check passed through `20261005_180000_ingestion_compatibility_fence.sql`
with 22 data seeds. The tracked schema is unchanged. Both owned schema-check
containers were removed and the empty label inventory was checked.

No memory improvement is claimed by this instrumentation change.

## Complete catalog measurement

Project: `classifarr-resource-study-02aab038ff3db9f98866c3abb5337596`.
Duration: 1,082,295 ms (18m02.295s). No other local build/test workload was run
during the measurement. The separate ordinary local Classifarr and Harmoniarr
containers remained running; this is not an otherwise idle host or a matched A/B.

- Twenty waves, 191 admitted scans and 19 scan deferrals; ten libraries/owners,
  all 5,776 inventory items completed and descriptions cached. No pending/failed
  work, routing, handoff gaps or service errors remained. Drain: 637,885 ms.
- Post-drain representative publication: 652,119 ms; unchanged warm publication:
  1,008,308 ms. Comparison ready: 776,426 ms; revalidated: 1,081,707 ms.
  Both real five-minute intervals elapsed without forcing clocks or GC.
- Ten preparations and ten verified commits for each consumer, including growing
  catalog and warm work. Twenty observations processed, zero invalid inputs,
  errors or pending observations; 80 readiness groups before stop and zero after.
  The diagnostic decisions never affected routing.
- Twenty-eight reads, four comparison builds, thirteen workers created/exited,
  zero active workers and admission holders at finish. Ingestion/queue overlap
  observations: 11/85. Ingestion had 19 and queue work 105 memory-pressure refusals;
  discovery had none. `pressureRecoveryObserved` is false: workload completion is
  not proof of comparison recovering from memory pressure in this run.
- Zero OOM kills or memory-limit hits. Independent sampled peaks in MiB: Node
  RSS 794.46, main heap 627.69, worker heap 203.67, raw container 1176.24 and kernel
  peak 1179.61. These independent peaks must not be added together.

The trace contains 197 records, including 100 complete resident observations and
one partial observation. Synchronous consumer boundaries deliberately have no
worker/container/proc-walk reading. Major GC produced 151 events from 14 source
tokens; largest source-local reusable page pool: 354 MiB. This is real memory,
not a deduction from admission accounting.

### Warm representative cycle

All figures below are MiB. The earlier idle sample and later idle sample bracket
one unchanged-source representative cycle, not two different implementations.

| Boundary | Main heap | Physical V8 heap | Process RSS | Raw container |
| --- | ---: | ---: | ---: | ---: |
| Earlier idle comparison, 957,979 ms | 219.16 | 221.63 | 328.28 | 691.11 |
| First full read, 1,005,022 ms | 431.19 | 489.71 | 602.86 | 980.65 |
| Shadow preparation start/end | 448.27 / 442.43 | 490.91 / 496.18 | 630.44 / 610.12 | — |
| Neighborhood preparation start/end | 442.43 / 368.83 | 496.18 / 494.70 | 610.12 / 603.84 | — |
| Streamed verification, 1,008,249 ms | 433.64 | 502.28 | 610.26 | 988.56 |
| Shadow commit start/end | 435.59 / 436.15 | 502.28 / 502.28 | 611.33 / 611.46 | — |
| Neighborhood commit start/end | 436.15 / 448.62 | 502.28 / 502.72 | 611.46 / 611.68 | — |
| Representative up to date | 448.66 | 502.72 | 611.68 | 989.88 |
| Later idle representative, 1,062,987 ms | 218.99 | 237.64 | 612.57 | 986.89 |

Shadow preparation took approximately 44 ms; neighborhood preparation 1,162 ms.
Their commits took about 1 ms and 40 ms. Endpoint differences are **not allocation
totals**: natural GC occurred during preparation, including a major collection
between neighborhood boundaries. The neighborhood commit's observed heap delta
was 12.47 MiB. The much larger warm-cycle rise was already present at the full
read, before either consumer started. This supports investigating that read next,
not removing geometry validation or assuming the consumers leak.

At warm publication one snapshot, one decoded-vector reference and both staged
callbacks were still observable. At the later idle sample all four categories
were zero. Owned fitting inputs were also zero. Model/community references
remained, as expected while caches were active. The two `representativeModel`
weak-reference entries can refer to the same reused object; these are not unique
model counts. Immediate stop still observed model/community and two verification
metadata references, so this does not prove every object is collected on shutdown.

Final comparison revalidation sampled 384.71 MiB main heap / 624.80 MiB RSS /
1004.64 MiB raw container; immediate stop sampled 386.80 / 625.37 / 1005.14.
There was no added post-stop idle soak. The fixture exercises actual consumer
preparation/publication, not a complete priority-refill workload or production
semantic accuracy.

The preceding consumer-free image study peaked at 667.25 MiB RSS and 1050.41 MiB
raw container. This expanded run is higher, but also has different scheduling,
scan admissions, builds and thirteen rather than nine workers. It is **not** a
matched before/after performance comparison and establishes no improvement or
causal regression percentage.

Private evidence is under `.tmp/resource-study/` in the project directory above.

- Phase trace SHA-256: `7be81fab5c4f1c2266b27cbc4609b86772e8ca8057eb37383e16f8fece3d3f0a`.
- GC trace SHA-256: `3f9ed8aa8d2012a83e0c0de4c0f42e23037b4497bedacb9fb8b67082948b9946`.
- Receipt SHA-256: `5f94c42a6289a040b7afd44d7e58bf2bd7fb6a01e23515702b2b090e427c72f4`.

Owned cleanup passed and empty container/volume/network inventories were checked
independently. Only regenerable synthetic study data was removed.

## Local baseline

Before this round's replacement, the existing fc9ec82f image had logged automatic
comparison recovery at 10:16:19.706 UTC. A bounded read-only check returned
background readiness `ready`; the latest stored warning remained 09:58:45 UTC,
before that image's restart. This is not sustained stability or proof that this
profiling change improves runtime memory. The helper process's own admission
reading is not a measurement of the web daemon.

## Rebuilt local Compose

A fresh 75,566,679-byte local database archive passed checksum and archive-list
checks; this was not a restore rehearsal. The exact previous image was separately
pinned as `classifarr:pre-memory-e872b7f5-0daa-48ca-8d97-61758089a899`. Backup:
`.tmp/pre-memory-fingerprint-e872b7f5-0daa-48ca-8d97-61758089a899.dump`.

Only local test Classifarr was recreated, without another build, at
11:00:47.893 UTC. It runs the measured candidate image as `1000:1000`, with the
existing mounts, read-only root, no-new-privileges, capability restrictions and
2 GiB limit unchanged. Unraid and Harmoniarr were untouched.

The five-minute observer returned 18 healthy samples from 11:01:30.456 through
11:06:14.098 UTC. Raw container usage ranged from 331.89 to 637.72 MiB and ended at
402.40 MiB. Kernel lifetime peak since recreation was 742.51 MiB. Zero OOM kills,
restarts or memory-limit hits. This is a short observation, not a matched memory
improvement or sustained-stability claim.

Initial and final bounded read-only checks still found the latest comparison
warning at 09:58:45 UTC, before recreation. The observed post-start event was
waiting for background work at 11:01:45 UTC; readiness remained `backfilling`.
Consequently this local window does not establish finished backfill or a completed
warm refresh. The isolated catalog study, not this short local window, supplies
the complete-cycle evidence.

## CI and handoff

[CI passed](https://github.com/cloudbyday90/Classifarr/actions/runs/37608820415)
for implementation commit `9e33fadb`: build/tests, database integration, fresh
installation/published upgrade and acceptance readout. OSV, Trivy, CodeQL,
resource-capacity, secrets and copyright workflows also passed for that commit.
Image publishing, release-candidate publication and promotion were skipped.
Later documentation commits do not change the tested image's implementation.

No release, tag, version change, new branch or Unraid deployment.

## Recommendation stack

1. Keep this expanded profiler and all memory safeguards. It now measures real
   optional consumers, but it is deliberately not a production memory fix.
2. Next prototype **bounded warm representative preparation**: avoid the first
   full vector map when reusing an exactly verified model, while retaining two
   independent reads, source/config/revision checks, corruption detection, fresh
   novelty/readiness metadata and geometry validation. Streaming geometry checks
   need an explicit consumer contract and differential tests before adoption.
3. Keep a full fitting read for changed/cold models. Do not infer that cached
   models allow skipping source validation, or subtract reusable pages from limits.
4. Review the pending patch-level dependency updates separately after this memory
   work; keep Node 24 declarations aligned with the deployed runtime.

| Next option | Benefit | Cost / recommendation |
| --- | --- | --- |
| Stream warm preparation while preserving checks | Targets the observed early heap rise | More complex source/consumer contract; prototype next |
| Optimize only neighborhood commit | Smaller, scoped allocation target | Observed delta was about 12 MiB; lower priority |
| Relax admission or force production GC | Might allow more attempts | Hides pressure or changes latency; do not adopt |
