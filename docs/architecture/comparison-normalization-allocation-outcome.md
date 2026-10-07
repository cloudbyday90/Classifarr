# Comparison normalization allocation outcome

Date: 2026-10-07. [Design, official sources and tradeoffs](comparison-normalization-allocation-design.md).

## Scope and decision

Replaced callback-based norm/division/cache comparison with a small shared ESM
arithmetic module. Validation still runs on every call, exact cache checks still
detect mutation, and both normalization passes remain. No API, schema, deployment
template, retry, ownership, memory-admission or GC policy changed. This targets
allocation churn; it does not declare the reported memory-pressure condition fixed.

The first candidate used growing output arrays. It reduced sampled allocations
but increased end-of-build heap and survivor estimates. The final candidate uses
fixed-length arrays, filling every slot before returning. Measurement, not the
general assumption that loops are faster, determines the recommendation.

## Baseline and first candidate

Baseline is the [previous cold profile](comparison-cold-allocation-outcome.md),
image `sha256:0f6b0db29d5fc7ebb9f44fab5f589668ee5985712dc870ca3058b542a3ae9e8d`.
The growing-array candidate is source `a18953e1b59bce6e925ebab4478cf1e6aee6e761`,
image `sha256:2246e3910ad36e29a2fc22cbb1395e28464e431fd48c44991cf3e4229543b12a`.
Both use 5,776 descriptions, 1,024 dimensions and ten libraries. Each mode performs
three independent cold builds and checks identical summaries, keys and weights
within that run. Numeric equivalence across implementations is checked separately
against the original arithmetic, not inferred from those within-run checks.

All numbers below are MiB; peaks are independent, not additive.

| Measurement | Baseline | Growing-array candidate |
| --- | --- | --- |
| Sampled allocations, cycles 1 / 2 / 3 | 1768.75 / 2085.14 / 2469.61 | 745.41 / 1123.37 / 1108.32 |
| Sampled survivors, cycles 1 / 2 / 3 | 51.99 / 55.44 / 49.87 | 73.68 / 65.60 / 72.80 |
| Natural peak main heap | 332.96 | 353.84 |
| Natural peak raw container | 696.11 | 719.76 |
| Natural two-second idle heap, cycles 1 / 2 / 3 | 189.57 / 180.03 / 180.02 | 202.31 / 200.91 / 209.17 |

Sampled allocations include collected objects, not just objects still alive.
Survivors are not a strong-retainer graph. Sampling changes GC; never treat a
sampled-versus-natural peak difference as improvement. Source reads and worker
allocations are outside main-thread allocation sampling. Normalization file labels
also include allocations in callees (and the similarity module's cosine function).
Combine shared_normalization, vector_normalization and normalization_arithmetic
when comparing; moving code into a new file must not hide its cost.

## Validation and environment

Regression-first: the old implementation passed the independent numeric oracle
but failed the no-callback traversal test. Focused final checks: 15 suites and
242 tests passed. Tests cover deterministic non-periodic vectors, dimensions up
to 16,000, mixed/extreme magnitudes, signed zero, repeated normalization, frozen
input, mutated input/output, missing output slots and rejected float32 underflow.
The oracle retains the original reduce/map arithmetic and checks Object.is at
every index; it does not call the rewritten implementation for expected values.

Both full backend runs passed 1,736 suites and 53,913 tests, with one
Windows-only skip (291.4 seconds first; 479.0 seconds final, overlapping the build).
The actual final Linux image separately passed directory-fsync,
exclusive-copy and unchanged-source checks. Backend typecheck/lint, development
and production dependency checks, copyright, static imports, ESM mock-shape and
Markdown checks passed. The inventory ownership gate reported no unreviewed
drift; its existing unresolved paths remain unresolved, not newly authorized.

The final no-cache image is from source
`883c1dfec8d445a5cc132532b61560260b978ed2`; its OCI revision matches:

- Image/index: `sha256:527d87727094890b958ba9c14940748faf9deb7597f3e2c61e92f7a0870b4e90`.
- Native manifest: `sha256:8f675b4fbc4aafc14978b974fe608008010ffa8635ece5b0f6c31ed2b22209f7`.
- Configuration: `sha256:1ec1cb34451726f4ec5229e1b272cfcb76d8ad93c5fb295749fa4c7fdfe93337`.

Docker Desktop became unavailable after that build and recovered with new desktop
processes at 13:12 UTC, without an agent restart command. Existing local Classifarr
and Harmoniarr containers restarted under their existing policies. The cause was
not established; do not attribute it to this patch or claim the interrupted check
passed. The schema runner refused before creating a container. After recovery,
the final-image Linux check, isolated schema dump and independent schema check
passed. Schema includes 22 seeds through
`20261005_180000_ingestion_compatibility_fence.sql`; tracked schema is unchanged.
Only later, uninterrupted profile runs count as final performance evidence.

## Random PR trial

Fresh enumeration found two open PRs; random selection chose
[#555](https://github.com/cloudbyday90/Classifarr/pull/555), immutable head
`5545605b53c854de8847b44e24fa083ff4218080`. Applied its exact client manifest/lock
diff for Node declarations 24.19.1 to 26.6.4 and undici-types 7.24.6 to 8.9.0.
Registry metadata confirmed integrity and no package scripts/peers. The runtime
alignment gate failed (7/8 passed); restored both files and reran it (8/8 passed).
No install, merge, retained dependency change or installed-candidate audit/build
claim. PR remained open at the same head. Keep Node 24 declarations while the
application and image remain on Node 24.

The recovery-change skill required bounded image evidence and unchanged safety
gates. The dependency-update skill kept the PR trial behind runtime compatibility.

## Exact-source CI

For final implementation commit `883c1dfe`, the
[main pipeline](https://github.com/cloudbyday90/Classifarr/actions/runs/37626290179)
completed successfully: build/test, database, fresh-install/published-upgrade and
acceptance-readout jobs passed. Release publication, image push and promotion jobs
were skipped as intended. This is not a release or a published-image receipt.
Documentation-only follow-up commits are separate from the measured image source.
OSV Full, CodeQL for JavaScript and Actions, filesystem/secret and deployment
misconfiguration scans, copyright and queued-work resource-safety checks also
passed for that exact commit.

## Final fixed-length cold profiles

| Measurement | Final candidate |
| --- | --- |
| Sampled allocations, cycles 1 / 2 / 3 | 987.90 / 1229.61 / 1193.32 MiB |
| Combined normalization labels, cycles 1 / 2 / 3 | 407.67 / 594.28 / 547.73 MiB |
| Sampled survivors, cycles 1 / 2 / 3 | 53.91 / 60.56 / 50.49 MiB |
| Natural peak main heap / process RSS | 209.84 / 454.00 MiB |
| Natural peak raw container / kernel peak | 568.22 / 573.09 MiB |
| Natural peak worker heap | 200.86 MiB |
| Natural two-second idle heap, cycles 1 / 2 / 3 | 182.66 / 186.12 / 173.73 MiB |

Across all three cycles, sampled allocations fell about 46% overall and the
combined normalization labels about 62% relative to baseline. Natural main-heap
and raw-container peaks were lower in this fixture. Survivor estimates remained
near baseline, without the first candidate's higher end-of-build heap.
The final candidate allocates somewhat more than the growing-array candidate in
the sampled runs, trading some churn for lower observed live memory.

Natural builds took 18.073, 16.589 and 16.002 seconds; sampled builds varied from
16.4 to 27.9 seconds. This small, sequential, non-randomized study does not establish
a general speedup or an exact production-memory reduction. The host was not idle:
local Classifarr and Harmoniarr continued in separate cgroups. No build or full
test jobs overlapped final profiles. The baseline predates the Desktop restart;
host/runtime history is a limitation even though fixtures and limits match.

All nine final builds completed local discovery with identical within-run
summaries/keys/weights. Each mode created and exited three workers, with zero
remaining workers, OOM kills or limit hits. Weak observations stayed at one
source/vector/handle and two community vectors across cycles; natural runs also
observed two community-row arrays. Older generations did not accumulate in these
observations. This is not a proof that all application paths are leak-free.

Final private records are `.tmp/normalization-sized-cold-{natural,allocations,survivors}.json`.
Captured stdout SHA-256 values:

- Natural: `e2eb96935679a03a1a9d3aad324f2c96cfa6ca860479dca4729fb907dfd4c417`.
- Allocations: `6de055ccc5a8ff6dd14b55278d9cd56b6b8e4b61fef8c99bc5960cc0ffeb1b8c`.
- Survivors: `524d2d2203cdf98e442824f1be61f18a2c1083f322ceb3b46d2a050ecf1bcdf6`.

All cold containers used random owned labels, no network or appdata, non-root
read-only roots, dropped capabilities, no-new-privileges and disposable tmpfs,
with 2 GiB/two CPUs/128 PIDs. Cleanup passed and a separate label query was empty.
No raw profiles, payloads, vectors or credentials were persisted in tracked files.

## Concurrent workload and local deployment

The final-image `comparison-catalog` run passed in 1,006,880 ms (16.8 minutes).
Project: `classifarr-resource-study-9d2f7a31e2404b06c1e28178ab7f3222`.
It used the real entrypoint, isolated synthetic PostgreSQL, import and metadata
services, scheduled refreshers and both real comparison consumers. The internal
network had no published ports; normal resource admission and real intervals stayed
enabled. No live credentials/appdata or external provider requests were used.

- Twenty waves and 178 scans completed 5,776 items across ten libraries; all
  descriptions were cached. Zero pending/failed items, service errors, routing
  side effects or handoffs remained.
- Work drained at 621,785 ms. Representative publication at 633,469 ms was followed
  by `up_to_date` at 992,545 ms; comparison `ready` at 682,332 ms was followed by
  `revalidated` at 1,005,834 ms. Both exceeded a real five-minute interval.
- Five comparison builds and 31 reads; 13 workers created and exited, zero active.
  Both consumers prepared nine times and committed three times, with 16 processed
  observations, zero errors/invalid inputs/pending work, and groups cleared from
  80 to zero at stop.
- Admission still deferred ingestion 32 times and queue work 60 times for memory
  pressure. Discovery had no memory refusal, so `pressureRecoveryObserved=false`:
  this proves workload completion, not recovery from a comparison-pressure event.
- Zero OOM kills or memory-limit hits. Peaks: main heap 623.86 MiB, process RSS
  792.13 MiB, worker heap 197.27 MiB, raw container 1174.98 MiB, kernel 1179.05 MiB.
  The largest main-heap phase was `recovery_community`. The earlier comparable
  catalog run reached 636.97 MiB main heap and 1176.76 MiB raw container: the
  whole-workload peak is essentially unchanged, despite cold allocation savings.

At final warm comparison revalidation, weak observations showed zero source
snapshots/decoded vectors/owned sources, one comparison handle, two community
vectors and two representative models. No workers remained. Heap was 378.71 MiB
and RSS 624.07 MiB; stopping consumers cleared their groups but does not force
immediate GC. These weak observations and 147 major-GC records are not a full
strong-retainer graph. Do not subtract reusable V8 pages from admission usage.

The runner validated startup budgets, completion, healthy shutdown and cleanup;
independent container/volume/network label queries were empty. Only disposable
synthetic resources were removed. Private evidence is under `.tmp/resource-study/`
with the project name above. SHA-256:

- Receipt: `3bb26824437143808b91b0af617a33c14bd48dc1680f28a989dc397a66991b9d`.
- Phase trace: `fabc25778abcd89455433526fab529962306faa70c9a7bb334d6bc9531c2ec3d`.
- GC trace: `34d08d28cfbf99b555b9185441a0715b29a1dc71199f01ecee3da2e5a75daa43`.

Before local replacement, a 75,558,959-byte backup passed checksum and archive-list
checks (not a restore test):
`.tmp/pre-memory-fingerprint-dc174e0a-ad7d-4b6f-aece-7f4c6e5847b8.dump`.
Exact old-image rollback tag:
`classifarr:pre-memory-dc174e0a-ad7d-4b6f-aece-7f4c6e5847b8`.
Only the local Classifarr test service was recreated from the measured image,
starting at 13:42:42.076 UTC. Health passed. User `1000:1000`, read-only root,
2 GiB memory limit, heap cap, capabilities, no-new-privileges and data/media mounts
were unchanged. Unraid was not accessed. Harmoniarr was not reconfigured or
explicitly restarted; its earlier restart accompanied the Desktop interruption.

The five-minute observation produced 19 healthy samples from 13:43:41.818 through
13:48:38.257 UTC. Raw container usage ranged from 308.64 to 1020.45 MiB, ending at
397.86 MiB; lifetime kernel peak was 1053.25 MiB. Zero OOM kills, memory-limit hits
or restarts. These include normal background work and cannot establish a controlled
local memory improvement or long-term stability.

Read-only checks found readiness initially `ready` and finally `backfilling`.
The newest stored comparison memory warning was 13:28:45.014 UTC, before the
replacement. The bounded file-log scan found a post-restart wait for other
background work at 13:43:45.046 UTC, not a new memory warning. This window does
not prove local metadata/backfill or warm-refresh completion. The diagnostic
helper's own admission result is not the running web daemon's heap measurement.
Private observations are `.tmp/normalization-local-memory.jsonl` and the initial/
final bounded diagnostic logs. No real data was deleted; the backup and old image
remain available. No version, tag, release or new branch was created.

## Recommendation stack and next item

Keep unchanged validation, exact indexed arithmetic with fixed-length output,
exact build-local cache reuse, independent freshness checks and existing admission
limits. Benefits: substantially less sampled cold allocation without changed
numbers or validation. Costs: more explicit arithmetic code and no demonstrated
reduction in the complete concurrent workload's peak. Reject the growing-array
candidate's higher observed live-memory cost; do not use approximate checks or forced GC.

Next: attribute allocations inside the **actual concurrent community-build and
warm-verification phases**, rather than extrapolating the cold fixture to the
remaining 624 MiB main-heap peak. Membership validation and normalization arithmetic
remain sizeable sampled components; isolate their contribution before choosing
another fix. Retain every memory safeguard and security boundary.
