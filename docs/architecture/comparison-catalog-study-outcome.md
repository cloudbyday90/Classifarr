# Shared-catalog study outcome

Date: 2026-10-06. [Design and official research](comparison-catalog-study-design.md).

## Implementation

The new `--comparison-catalog` profile uses one fresh migrated application database.
Real import ownership, metadata completion, catalog queries, vector SQL, readiness
gates, revision hints and refresh schedules replace the extra private catalog.
Synthetic transports and vectors remain explicit fixture boundaries. Small ESM
modules separate fixture preparation, orchestration and result validation.

The load's drain is now single-flight and shutdown joins an in-flight drain before
stopping its consumer. Dedicated tests cover this ordering, environment/nonempty
database refusal, bounded pages/vector writes, cache-key reuse, incomplete receipts,
sanitized traces and cleanup after failure. Existing comparison/recovery result
contracts remain unchanged. No production service, admission limit, schema or
garbage-collection behavior changed.

Verification before the image run: 161 backend suites / 2253 tests passed; the final
four-suite focused rerun passed 81 tests, including the drain and configuration regressions.
All 40 tooling tests, server typecheck/lint, both dependency-analysis modes,
static ESM and copyright checks passed. Ownership review inspected the complete
three changed launchers and new callees before updating their reviewed hashes;
the gate then passed, without declaring existing unresolved writer debt resolved.
All seven CI/security workflows passed for the corrected source commit
`fc6775916f3897b99f911dd682a7ba5fc41e02fd`, including the
[CI/CD pipeline](https://github.com/cloudbyday90/Classifarr/actions/runs/37515948514).
Those checks do not turn the incomplete isolated study below into a passing result.

## PR trial

Fresh random selection chose open #555 at
`5545605b53c854de8847b44e24fa083ff4218080`. Its exact two-file diff was applied
locally. Seven runtime-policy tests passed and the client runtime-major test
failed: Node 26 declarations do not match deployed Node 24. Only the trial changes
were reverted; the restored eight policy tests passed in the 40-test tooling run.
No install, retained dependency change or merge. `npm outdated` also identified
PostCSS 8.5.29 and Vite 8.3.3 as later patch candidates; neither was mixed into
this memory experiment. The typings decision follows
[DefinitelyTyped version alignment](https://github.com/DefinitelyTyped/DefinitelyTyped).

## Image and local evaluation

A first isolated pilot exposed a fixture drain error above the 5000-row refill
budget. Each drain iteration reimported all libraries, restarting their backfill
generations before the remaining pages could be visited. Inventory reached 5776
but metadata stopped at 5000; no failed tasks or provider retries explained it.
The fixture now scans each library once at final drain, retries only refused scans,
then continues the existing handoffs. Dedicated regressions retain the production
page budget and verify no repeated successful scans. The pilot also used an
untrusted synthetic Ollama hostname, correctly disabling comparison. The fixture
now uses a trusted loopback name with the same in-process embedding stub and
validates saved configuration before starting. No trust rule was weakened.
The pilot was stopped, its trace retained and its owned resources removed. It is
not memory/recovery evidence.

Before rebuilding, a private 75,643,924-byte local database archive passed checksum
and archive-list verification, and the exact previous image was retained as
`classifarr:pre-memory-1ca81666-fac4-4e6f-b32a-c5233c228d8a`:
`sha256:6604eb9bf2c2df8b9909092cfc91ff709ed1f88a6404da9e4642c888eb599069`.
An archive check is not a restore rehearsal. Unraid was not accessed.

### Corrected immutable image

The corrected source was built with `build --no-cache`, without another source
edit before measurement:

- Source: `fc6775916f3897b99f911dd682a7ba5fc41e02fd`.
- Image index: `sha256:570d5cec73e7cfc65e62bec989aa53ceb6fd9d2a618af891c446a1dd92a96233`.
- Native manifest: `sha256:bc2d47de9ef8026fdc35a40606d690fb639690ad2be95aa277914f04d758ebca`.
- Image config: `sha256:3688aa9898032735ea1ffe64012261c43bd880f2ce860353243f00400e2a9c53`.

### Workload and recovery result

The 25-minute study **did not pass its complete-cycle contract**. It rejected
`comparison_catalog_completion_missing`: no later scheduled `revalidated` result
occurred before the deadline. The deadline and assertion were not relaxed.

Import and both metadata stages did finish at 621.2 seconds: 5776 items, 10
libraries/owners, all handoffs complete, no pending/failed/routing tasks or service
errors, and all 5776 descriptions cached. These checks, the resource-bound checks
and the exact admission-budget equations ran before the failed assertion.

| Event | Elapsed time | Observed outcome |
| --- | --- | --- |
| Import/metadata drain | 621.2 s | Complete, with full vector coverage |
| Representative publication | 635.4 s | Published after drain |
| Comparison pressure refusal | 643.9 s | 992.3 MiB available, 1024 MiB required |
| Comparison recovery | 805.5 s | Ready after natural retry, 161.6 s after refusal |
| Representative pressure refusal | 988.9 s | Recovered with publication at 1054.9 s |
| Comparison pressure refusal | 1123.9 s | 928.0 MiB available, 1024 MiB required |
| Comparison recovery | 1284.2 s | Ready after natural retry, 160.3 s after refusal |
| Representative revalidation | 1412.6 s | Up to date |
| Joined shutdown | 1500.6 s | All 17 created workers exited |

Each comparison retry was admitted with more than 1556 MiB available against
1088 MiB required, including the unchanged 64 MiB recovery margin. There were
eight allowed and two refused comparison admissions; ten allowed and one refused
representative admissions. No forced GC, clock change, retry reset, restart or
memory-limit change produced either recovery.

Source inspection explains the missing comparison revalidation: a memory refusal
clears the comparison entry, unlike a busy refusal. The next admitted run therefore
builds again. The first post-drain entry's next scheduled validation was refused;
the second recovered entry was not due again until after the study deadline.
Two observed returns to `ready` are evidence of automatic recovery, **not** the
stronger pressure-to-recovery-to-revalidation proof required by the existing
receipt. Assertions after the failed completion check, including aggregate permit
and overlap validation, were not executed. Worker joining was independently checked
by the metrics collector. No accepted result receipt was emitted.

### Memory interpretation

The trace contains 36 snapshot reads and eight comparison builds. Its largest
saved checkpoint values were 906.0 MiB RSS, 740.0 MiB main-thread heap used and
67.5 MiB external memory. The cgroup kernel high-water mark was 1280.4 MiB;
OOM kills and memory-limit hits remained zero. RSS, heap, external memory and
cgroup usage overlap and must not be added. ArrayBuffers are part of external
memory, not another independent allocation.

The full-size builds show repeatable allocation growth across these boundaries:

| Main-thread heap checkpoint | First post-drain build | Second post-drain build |
| --- | --- | --- |
| Owned fitting input | 262.5 MiB | 269.2 MiB |
| Community discovery finished | 510.2 MiB | 505.2 MiB |
| Build finished | 531.0 MiB | 504.8 MiB |
| Fresh verification snapshot read | 725.1 MiB | 713.3 MiB |

These are boundary observations, not per-function allocation totals. GC, native
allocation and other scheduled work can occur between checkpoints. Both completed
models had an estimated weight of 126.8 MiB; this is cache accounting, not a V8
heap measurement.

At 943.9 seconds, observed snapshot, decoded-vector, owned-source/vector and
community-row weak references were all gone. One comparison handle and two sampled
shared community vectors remained while the valid model was cached. Heap use fell
to 218.4 MiB, and later RSS fell from about 906 to 328 MiB without forced GC. After
each pressure eviction, all sampled references, including the handle, eventually
became unreachable and heap use fell to about 46 MiB. Thus this run does **not**
demonstrate stuck workers or permanently retained snapshot containers.

It does show substantial temporary allocation followed by delayed reclamation,
with cached model memory also present. Representative verification reads are a
useful next target: the two reads around 1050/1055 seconds raised observed heap use
from 425.2 to 572.2 MiB; two snapshots were still observable before the next
comparison refusal. The existing reader already decodes bounded batches. Simply
adding batching again is not the next fix. Profile and shorten whole-snapshot
lifetimes or reduce verification materialization while preserving exact content,
configuration, revision, coverage and corruption checks.

The final immediate post-stop checkpoint still saw the last handle and two shared
vectors, after stop had cleared the cache. There was no post-stop natural-GC window
in this profile, so it cannot prove those final references were collected or that
there is no leak elsewhere. Nor does a weak reference identify a retaining path.

### Evidence limits and cleanup

The synthetic transports/vectors do not measure real inference or all application
jobs. Both workers use real production schedules through the study adapter, not
the complete application scheduler. The single embedded PostgreSQL database was
93,828,799 bytes during the run, with 128 MiB shared buffers and 4 MiB work memory.
Its allocations and file cache contribute to cgroup usage, not Node's heap.

The allowlisted failed-run trace retains checkpoints, but not nested one-second
phase peaks. Reported checkpoint maxima are therefore not the sampled or
instantaneous RSS maximum. Do not infer zero transient worker memory from zero
active workers at publication. Improve bounded failure-trace peak retention before
the next allocation comparison.

Private evidence:
`.tmp/resource-study/classifarr-resource-study-85da9bf5c7c536ec9aeb25fe4c173a07/comparison-trace.json`,
169 records, SHA-256
`9f69ae64e143f1d4450fcf7029222402ef28707a94a3585e6c66ded63e1b33f7`.
The launcher removed its exact owned containers, networks and volumes after failure;
their absence was verified. It did not remove the caller's image or touch Unraid.

### Local Compose and schema checks

After the isolated run, the local testing container was recreated from the corrected
image with `up -d --no-build --force-recreate --wait`. It started at
2026-10-06 19:33:46 UTC and became healthy. The existing app-data/media mounts,
UID/GID 1000:1000 and 2 GiB memory limit were preserved. CPU/PID caps remain unset
in this existing local setup; it is not the isolated study's two-CPU/128-PID topology.

A five-minute observation produced 19 healthy samples, from 19:34:11 to 19:39:06
UTC, with no OOM kill or memory-limit hit. Raw cgroup samples ranged from 310.6 to
727.9 MiB and ended at 329.9 MiB; the kernel high-water mark was 799.4 MiB. This
short startup observation is not a sustained capacity or complete-refresh test.
Read-only diagnostics found normal backfill activity and a comparison
`waiting_for_background_work` event after startup, with no new comparison warning
in the bounded records examined. Earlier pressure/recovery events belong to the
previous container. A separate probe process's admission result does not establish
the application process's cache readiness.

Using the same immutable image, the isolated schema dump passed, followed by an
independent fresh-container schema check. `database/schema/current.sql` was
unchanged; both disposable containers and their owned data were cleaned up.
The final focused rerun again passed all 81 tests; Markdown validation checked
1954 files with zero errors before this final outcome addition.

## Recommendation stack

1. Keep memory safeguards, cache eviction, retry timing and the incomplete result
   unchanged. They protected the container and allowed natural recovery.
2. Preserve bounded phase peaks on failed studies, then run a matched experiment
   ending the first representative snapshot's scope before its fresh verification
   read. Benefit: targets two simultaneously observable snapshots without removing
   either read. Cost: observer/recovery preparations and the final consistency
   checks must retain identical behavior; earlier eligibility for GC does not
   guarantee immediate reclamation. Investigate fingerprint-only verification
   only if this smaller change is insufficient, with separate corruption tests.
3. Consider community-fitting allocation only after isolating the verification
   contribution. Benefit: another measured growth phase. Cost: changing both at
   once would make results hard to attribute.
4. Defer higher memory limits, forced GC and retaining models through pressure.
   They might reduce visible warnings but would change the safety or measurement
   contract without resolving this allocation pattern.

No production memory fix or complete-cycle success is claimed by this change.
