# Comparison streaming verification outcome

Date: 2026-10-06. [Design, options and official research](comparison-stream-verification-design.md).

## Implementation

Comparison refresh now uses an independent `readVerification` transaction that
validates and fingerprints every exact vector in bounded batches without returning
a decoded vector map. Shared metadata canonicalization and float64 hash encoding
keep fitting and verification keys identical. Initial fitting reads and caller
ownership are unchanged. No memory threshold, hysteresis, deadline, retry, cache
capacity, database schema or deployment-template change.

The existing resource-study adapter now calls the production verification method
and keeps the same read/build counters. Workload, limits, schedules, deadlines and
acceptance are unchanged; actual timing and build counts can still differ.

## Verification

The original full-map reader deliberately fails the isolated completed-batch
collectibility assertion. The streamed implementation passes it. Diagnostic GC
is confined to that standalone test, not the application or natural image study.
Canonical parity includes a frozen key from pre-change commit `e376a142`, empty
and shared sources, orphan vectors, ordering, exact changes, malformed/foreign/
duplicate/missing rows, row/component bounds and cancellation.

Three isolated PostgreSQL suites / 15 tests passed. Both full and streamed reads
retain the active repeatable-read view during concurrent deletion/replacement;
subsequent reads detect the committed changes. Aborts roll back and return a usable
connection. Repository metadata/state use synthetic adapters; vector rows and
transaction behavior use actual PostgreSQL. This is not a live-provider rehearsal.

Initial new tests had two fixture mistakes (sharing a movie description into a TV
library); the scope guard rejected both. Corrected fixtures use a second movie
library. No validation rule was relaxed.

Full backend validation passed: 1,724 suites / 53,609 tests, with one existing
platform-specific skip (no coverage run). Server typecheck, lint, both dependency
boundary checks, 40 dependency-tooling tests, static ESM imports, copyright,
ownership and Markdown checks passed. No frontend code or dependency was retained
from the PR trial. Image/local evaluation follows from the committed source.

The ownership gate required review of the changed repository source. Inspected
its complete query adapter and new callees: fixed reads and transaction-local
settings only, no protected inventory DML, no provider calls in a transaction.
Updated only that reviewed source digest and explanation; its analysis digest and
unrelated ownership debt are unchanged.

## Candidate and rollback evidence

The no-cache build used clean source
`e9b202ba21715b639cd71007325794205e4e4a31` on `main`:

- Image/index: `sha256:deefe3156e203c8d8f3de3091ffdbea4f1e54b648366b6f951572549a22d2071`.
- Native manifest: `sha256:2a352bb13b53969546fc6e7cc59a8d9ab0d297f44ea5864fc31c9c14b82f9fa6`.
- Config: `sha256:17871f39c50498c02edb2389aea3849194a5206c0736700ed4950c661c49016d`.

The Linux directory-fsync case skipped on Windows was exercised separately against
the candidate-image module, with no network or appdata mount: complete exclusive
copy, unchanged source and refusal to overwrite all passed.

Before replacement, the local-only PostgreSQL archive was 75,615,687 bytes with
matching source/destination checksums and a readable restore listing. Private file:
`.tmp/pre-memory-fingerprint-e4dc85a7-3776-48cb-917e-5cbfc9e83031.dump`.
Old image `sha256:880d06b7afc333b86cfce159b168908fa7d2c02c051144266976f9017219fd34`
is retained as `classifarr:pre-memory-e4dc85a7-3776-48cb-917e-5cbfc9e83031`.
No restore or data deletion was performed.

## Complete-catalog image study

The unchanged `comparison-catalog` / `bounded` study passed on the candidate above.
Project: `classifarr-resource-study-b5d054da08931ae4018e550956109cc1`.
Private result and 113-record trace are under `.tmp/resource-study/<project>/`;
trace SHA-256 is
`6ec7e675b998ae569a5e156d527710cff9804cefa5734a282011893efbe29acf`.
The previous receipt and trace remain intact.

- Same 2 GiB / 2 CPU / 128 PID budget, synthetic providers and 20 catalog waves.
  All 5,776 inventory items, metadata completions and cached descriptions finished;
  zero pending/failed items, routing, handoffs or service errors. Ten import scans
  were deferred; 200 scans ran, versus 210 in the earlier observation.
- Imports drained at 622.528 s. Representative publication followed at 737.338 s;
  comparison was ready at 852.616 s and revalidated at 1169.228 s (316.612 s later).
  Total duration: 1169.900 s. There were 23 reads and four builds, versus 22 reads
  and one build previously. This is not a controlled fitting-throughput comparison.
- Natural pressure recovery was **observed**, unlike the previous run: comparison
  admission refused work at 446.015 s and again after drain at 626.024 s, before
  later readiness and revalidation. Representative admission also deferred once.
  Queue work deferred 76 times and still completed. No thresholds were reduced.
- All ten workers exited; zero active ingestion/queue/discovery slots remained.
  No OOM, memory-limit or PID-limit hits. Owned-project cleanup passed. No forced
  GC, restart, injected clock or competing local build/test suite during the study.

One-second sampled maxima, MiB (not necessarily simultaneous):

| Metric | Previous observation | Streamed verification |
| --- | ---: | ---: |
| Process RSS, all threads | 857.32 | 785.70 |
| Main-thread used heap | 703.65 | 614.01 |
| External memory | 39.33 | 68.78 |
| Array buffers, included in external | 39.18 | 67.89 |
| Worker used heaps | 211.88 | 216.63 |
| Container usage | 1229.64 | 1166.79 |
| Kernel-recorded container high-water | 1236.72 | 1173.64 |

Do not add worker heap to process RSS or array buffers to external memory. Lower
RSS/heap/container maxima coexist with higher external and worker maxima, different
build counts and a longer run. This single pair does not establish a repeatable
percentage improvement or removal of all memory-pressure warnings.

For the final full-catalog build, heap rose from 506.79 MiB at build end to
577.85 MiB after streamed verification: a 71.06 MiB increase, versus 216.66 MiB
between those phase boundaries previously. These are allocation observations, not
retained-size measurements. By 971.046 s, old fitting inputs and community-row
weak references were gone; one live comparison handle and its two sampled shared
community-vector references remained intentionally cached. Later revalidation did
not rebuild. At stop, sampled repository snapshots/decoded vectors were also gone.
The saved trace allowlist omits the new verification-metadata reference kind and
streamed-read marker; no collectibility claim is made from those missing fields.

### Remaining memory question

At 626.025 s, comparison was correctly deferred with only 64.14 MiB main heap but
661.01 MiB process RSS / 1078.30 MiB container usage; all sampled old fitting/cache
references were gone. At 671.034 s, heap was 46.79 MiB while RSS stayed 660.13 MiB.
Memory later became admissible naturally. After fitting, heap fell to 217.99 MiB
at 971.046 s while RSS remained 771.31 MiB; RSS fell to 323.71 MiB at 1046.046 s.
This is evidence of delayed resident-memory release, not proof of a JavaScript
object leak or a specific allocator fault. Container usage also includes PostgreSQL
and other charged memory. Separate anonymous/file-backed RSS, V8 committed space,
native/external allocations and PostgreSQL/cgroup cache before selecting another fix.

The fixture uses real import/queue work and production refresh registrations with
a study schedule adapter, deterministic 1024-dimensional vectors and synthetic
providers. It is not a full application, live-provider or Unraid capacity claim.

## Local deployment and CI

Local Compose was recreated from the measured image and became healthy, with start
time `2026-10-06T22:24:28.130779187Z`. Existing appdata/media mounts, 2 GiB limit,
user `1000:1000`, read-only root and `no-new-privileges` were preserved. Unraid and
the unrelated Harmoniarr container were not changed.

After recreation, an isolated schema dump and a separate schema check both passed
and cleaned up their owned containers. `database/schema/current.sql` is unchanged;
the latest migration remains `20261005_180000_ingestion_compatibility_fence.sql`,
with seed data from 22 data-only migrations. No live database schema was dumped
into the repository.

The five-minute local sampler recorded 19 healthy observations from 22:27:08.116
through 22:32:03.311 UTC: raw container usage 442.54–480.57 MiB, with a lifetime
kernel high-water of 806.09 MiB. No OOM, limit hits or restarts. Read-only checks
found no comparison warning newer than the new container's start; the latest
warning/recovery pair belonged to the old container. Current readiness was still
`backfilling`, so this window does not prove a completed live-provider comparison
cycle. A separate diagnostic process's admission result is not evidence about
the main application's warm caches. The isolated full-catalog study supplies the
complete-cycle evidence, not this short health observation.

All seven workflows passed for runtime commit `e9b202ba`: CI/CD, Resource Capacity
Regression, OSV, Trivy, CodeQL, Gitleaks and Copyright. The
[CI/CD run](https://github.com/cloudbyday90/Classifarr/actions/runs/37537735412)
includes successful database tests, build/test and fresh-install/published-upgrade
jobs. Its conditional policy replay and manual Docker Hub cleanup jobs were
skipped, not represented as executed. This is not a release or tag.

## Random PR trial

Fresh enumeration found #555 and #556. Randomly selected
[client typings #555](https://github.com/cloudbyday90/Classifarr/pull/555), head
`5545605b53c854de8847b44e24fa083ff4218080`, and applied its exact two-file diff.
The unchanged runtime-major gate rejected Node 26.6.4 declarations for Node 24.
Reverted only the trial changes before installation; no dependency changes or
merge. Registry metadata confirms the proposed undici-types ~8.9.0 dependency.
Client outdated also reported postcss 8.5.29 and Vite 8.3.3; these were not installed
or assessed as a security batch. TypeScript 7 is a separate major update.

## Next decision

Keep streaming exact verification: parity, transaction and lifetime tests pass,
and the unchanged workload completed with natural pressure recovery. Its tradeoff
is hashing inside a bounded transaction, not a weaker freshness check.

Next, attribute post-refresh resident memory after heap cleanup, and extend the
allowlisted trace projection with tests for the new metadata/stream markers. Then
evaluate the remaining full-map cache-hit reads or community-build allocations
against that evidence. Do not raise limits, force production GC or hide deferrals.
No release, tag, new branch or Unraid mutation.

Follow-up: the [resident-memory study](comparison-resident-memory-outcome.md)
separates anonymous/V8/PostgreSQL/cache measurements and records a failed
revalidation deadline caused by comparison retry timing that needs attention next.
