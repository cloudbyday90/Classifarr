# Comparison quiescent residency outcome

Date: 2026-10-07. See the [design and official sources](comparison-quiescent-residency-design.md).

## Change and limits

The existing opt-in catalog diagnostic now records bounded, aggregate Linux
mapping counters before/after natural major GC and across a two-minute quiet
window. Workers must have exited, consumers must be stopped and admissions
drained. Five observations distinguish writable anonymous mappings, virtual
reservations, executable memory and other fixed categories; virtual-size buckets
are not allocator ownership or allocation-size measurements. Read failures are
explicitly unavailable. No raw addresses, filenames or process identities are
saved in receipts.

Production services, memory safeguards, scheduler/retry policies, schema and
deployment templates are unchanged. No forced GC, heap dump, allocator switch,
cache purge or remote inspector was introduced. Mapping reads and memory counters
are observational, not atomic; the observer itself performs bounded allocations.

The recovery-change skill kept the implementation diagnostic-first. The
dependency-update skill required a runtime-compatible PR trial, and the
release-evidence skill kept source CI, local image and runtime observations
separate. No release, tag, PR merge or Unraid change is part of this work.

## Validation

- Full backend unit suite: 1,744 suites, 54,154 tests passed in 312.850 seconds;
  one Linux-specific case skipped on Windows. The rebuilt image separately passed
  the Linux directory-fsync/exclusive-copy probe, including unchanged source and
  existing-target refusal. This is filesystem evidence, not a restore rehearsal.
- Focused diagnostic suite: 146 tests across five suites passed, followed by a
  54-test catalog retest after adding the receipt-correlation case.
- Backend lint/typecheck, copyright, static imports, both Knip modes, ownership
  gate, Markdown and 40 tooling/install-policy tests passed. Only the changed
  resource-study launcher digest was refreshed after reviewing its timeout and
  required-evidence changes; unresolved ownership debt remains unresolved.
- A read-only, non-root Linux parser smoke passed with real smaps input. Unit
  cases cover read failure/cleanup, byte/line/mapping limits, malformed and
  truncated counters, privacy, timing, resumed work and missing receipt refusal.
- No-cache Compose build passed. Disposable image schema dump and independent
  schema verification both passed and cleaned up; `database/schema/current.sql`
  is unchanged. No live database was used to generate the schema snapshot.

The full PostgreSQL integration suite was not rerun locally in this diagnostic-only
round; no SQL or production behavior changed. Remote results are recorded below.

## Random PR trial

Fresh random selection from two open PRs chose
[#556](https://github.com/cloudbyday90/Classifarr/pull/556), head
`9d74537d7917c248d15926f37b2e40ceba7559a4`. Its exact server manifest/lockfile diff
was applied locally: Node typings 24.19.1 to 26.6.4 and undici-types 7.24.6 to
8.9.0. Registry integrity/dependency metadata matched. The Node-24 runtime gate
passed 8/8 before, failed 1/8 during the trial, and passed 8/8 after reverting.
No installation, retained dependency update or merge is claimed. Keep Node-24
typings until a separately tested runtime upgrade; do not weaken the gate.

The current outdated-package check also found newer dotenv, express-rate-limit,
js-yaml and Knip versions. Those belong in a separate scoped dependency review;
outdated alone does not establish a vulnerability.

## Exact image and study

Source: `770fde0a3ce11f49d34848b7d2d9ed779066c31c`, pushed to `main`.
Inspected local Docker image ID:
`sha256:7d3e1a8e1331eeadba5290dc577f0d367de6c7579f2644b362bb91fe2662d8b6`.
Its OCI revision matches; this is a local image, not a published release digest.
The pinned Node 24.21.0 / Alpine 3.24.2 / pgvector 0.8.7 baseline is unchanged.

The full synthetic catalog observation completed in 1,292,359 ms (21.54 minutes).
Its owned project was
`classifarr-resource-study-fdadd4b77a8c30b045a2ff0e8af77a6c`, with 2 CPUs,
2 GiB memory, 128 PIDs, an internal network and disposable data. Allocation
sampling and textual GC tracing were disabled. No provider credentials, live
appdata, forced collection or resource-limit changes were used.

- All 5,776 items completed import and metadata work across ten libraries;
  all 5,776 description vectors were cached. There were no pending/failed items,
  service errors, routing actions or handoffs.
- Twenty waves exercised 192 scans, 33 refresh reads and four comparison builds.
  All twelve workers exited. Both consumers stopped with zero pending work and
  zero retained groups; all admissions drained.
- Existing safeguards deferred ingestion 18 times and queue work 59 times for
  memory pressure. Discovery did not defer for memory pressure, so the receipt's
  `pressureRecoveryObserved: false` is not a discovery-recovery pass.
- Peak container memory was 1,249.59 MiB; peak process RSS was 893.56 MiB.
  No OOM kill, memory-limit hit or PID-limit hit occurred.
- Cleanup passed, independently confirmed by the absence of containers,
  networks and volumes carrying this exact project's label.

The ignored local `result.json` under `.tmp/resource-study/` and this project
directory has SHA-256
`35e5640e9a52035183915173126ab7e9ceafabef54e9d886eae953de10cf8dcd`.
Its 201-row sibling `comparison-trace.json` has SHA-256
`fcf05f47d0ddacaf5e27ccb47eb4d4f3a84f64512aef45207917b0e17164c1a0`.

## Finding: delayed anonymous-mapping release

A natural main-thread major GC was observed 60.853 seconds after observation
started. All seven remaining objects tracked by sampled weak references were collected:
comparison handle, community vectors, verification metadata and representative
models. Main-thread heap usage fell from 373.57 MiB to 39.74 MiB. The immediate
post-GC RSS reading was still high; that boundary alone was not the final state.

All five subsequent mapping observations completed over a 120,264 ms quiet
window. Values below are MiB except time and mapping counts; offsets are rounded
from the first quiet sample, not from process startup.

| Offset (seconds) | Process RSS | Main heap used | V8 physical heap | Writable anonymous RSS | Writable mapping count |
| --- | --- | --- | --- | --- | --- |
| 0 | 594.70 | 41.46 | 81.50 | 526.85 | 2,121 |
| 30 | 594.39 | 41.15 | 44.75 | 527.59 | 2,118 |
| 60 | 594.50 | 40.74 | 44.26 | 527.68 | 2,118 |
| 90 | 594.75 | 41.12 | 44.75 | 528.92 | 2,117 |
| 120 | 137.56 | 39.88 | 42.43 | 70.84 | 315 |

Most of that fall was in writable anonymous mappings larger than 64 KiB and no
larger than 1 MiB: count 2,065 to 254, RSS 516.35 to 60.93 MiB. PostgreSQL PSS
stayed about 117.8 MiB and cgroup file-cache accounting stayed about 291.1 MiB.
The 17.58 GB of reserved anonymous virtual address space had zero RSS throughout;
it was not consumed RAM. Raw cgroup usage fell from 928.99 to 458.46 MiB.

This run demonstrates delayed resident release between the last two observations,
not persistent retention of the sampled application objects. It does not identify
the allocator responsible, locate the precise release instant, rule out all leaks,
or diagnose Unraid. Read boundaries are non-atomic, and bounded diagnostic
allocations remain part of the experiment.

The next hypothesis is runtime page-pool/reducer behavior, not a proven cause.
Node 24.21.0's pinned
[V8 allocator](https://github.com/nodejs/node/blob/v24.21.0/deps/v8/src/heap/memory-allocator.cc)
uses pooled data pages, and its
[memory reducer](https://github.com/nodejs/node/blob/v24.21.0/deps/v8/src/heap/memory-reducer.cc)
can schedule additional memory-reducing GC work. The actual image exposes the
memory-reducer and decommit-pooled-pages flags but not the newer page-pool timeout
flags found in current V8 sources. Do not transfer current-main timing assumptions
to this pinned runtime or present mapping sizes as allocator attribution.

## Local Compose evaluation

Only the local testing service was recreated from the tested image, preserving
its existing mounts, non-root user, read-only root, no-new-privileges and 2 GiB
limit. Its health endpoint reported healthy with the database connected.
Nineteen observations from 21:36:06.807 to 21:41:07.024 UTC remained healthy, with
zero restarts, OOM kills or memory-limit hits. Raw container usage ranged from
524.23 to 879.57 MiB; the kernel high-water reading was 894.49 MiB. This active
local installation is distinct from the stopped synthetic workload above.

The read-only library check reported ongoing backfill at the final checkpoint.
The latest recorded comparison warning remained 18:04:45 UTC, before recreation;
the latest recovered log event also predates this image. These checks establish
startup health, not completion of all local background work or resolution of a
production Unraid incident.

The first backup attempt stopped safely because Docker could not resolve the
previous running image's manifest after the build tag changed. A non-pausing
rootfs snapshot attempt failed for the same missing manifest. No data restore,
image prune or deletion was used to work around it. A separately retained,
runnable image at source `b1c7ff7e976538b078b5cc61b5a147e1e38d2b4f` had identical
production source to the old container; intervening differences were tests/docs.
It was explicitly selected as the rollback source, not represented as the exact
old image. The helper then produced and checksum-verified a readable 75,602,174-byte
database archive before recreation. The archive and rollback reference remain
local. This was not a full app-data backup or a restore rehearsal.

## Remote evidence

The prior queue-fixture source run
[37683016793](https://github.com/cloudbyday90/Classifarr/actions/runs/37683016793)
completed successfully, including its database job. That closes its pending CI
follow-up without retroactively proving the precise historic failure cause.

Current source [CI](https://github.com/cloudbyday90/Classifarr/actions/runs/37686768245)
completed successfully, including the database job. Resource Capacity Regression,
OSV, Trivy, CodeQL, Gitleaks and copyright also passed for this exact source.
These results cover `770fde0a`, not the later documentation-only outcome commit;
neither the prior source's pass nor the local build substitutes for current CI.

## Recommendation stack

1. Keep production safeguards and cache/allocator policies unchanged. The measured
   late drop removes the evidence for an immediate persistent-residency fix.
2. Correlate the delayed small-mapping release with the pinned Node-24 runtime in
   an isolated repeat using the existing GC-trace mode plus this observer. Benefit:
   a specific, testable explanation for the delay. Cost: another bounded run and
   instrumentation overhead. Do not enable forced GC or remote inspection.
3. Then optimize the already measured temporary-allocation hot spots, such as
   representative membership/fingerprinting, with equal-result and peak-memory
   evidence. This targets workload peaks instead of guessing at cache ownership.
4. Review remaining dependency updates in a separate compatible batch. Keep the
   Node-26 typings PR unapplied while the runtime remains Node 24.
5. Pin and verify the running rollback image before replacing a build tag next
   time. The fallback worked here, but an older source-equivalent image is weaker
   rollback evidence than the exact pre-change artifact.
