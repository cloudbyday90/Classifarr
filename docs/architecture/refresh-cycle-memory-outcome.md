# Completed refresh-cycle memory outcome

Date: October 12, 2026. Main; no release or version change.
See the separate [design, official sources and tradeoffs](refresh-cycle-memory-design.md).

## Implemented

The existing full-catalog diagnostic now records bounded, scalar-only samples
for each successful representative/comparison refresh. Each sample associates
worker/attempt/status with main-thread memory, whole-process RSS, raw container
memory, sampled weak-reference counts and both model caches' estimated occupancy.
The recorder copies numbers, not snapshots or model references. Inspection does
not prune or renew cache entries. Explicit representative-cache construction uses
the same production defaults; no runtime service behaviour or safeguard changes.

Catalog receipts are now v3 and require complete cycle evidence, correspondence
with successful attempts, post-drain revalidation, and empty caches/exited workers
after stop. The Markdown report shows comparable first/last post-drain refreshes
and shutdown. Failed-run traces preserve only allowlisted numeric cache fields.
No heap dump, forced collection, new SQL, provider request, migration or UI change.

## Random PR trial

Fresh enumeration found two open PRs. Random selection chose
[#558](https://github.com/cloudbyday90/Classifarr/pull/558), exact head
`e8a7ee2e490e5437375aa3a4628943657fa1783e`. Applied its exact client manifest and
lockfile patch locally. Strict installation, complete dependency-tree check,
full npm audit (zero advisories), API and component typechecks passed. The
toolchain suite passed 40/41, rejecting Node 26 declarations under pinned Node 24.
The exact PR patch was reverted and dependencies restored; no merge or retained
dependency update. Successful typechecking alone is not runtime compatibility.
Restored client typechecks and all 41 toolchain tests passed again. Current
outdated metadata also lists vue-router 5.4.0 and TypeScript 7.0.2; neither is
silently bundled into this memory-diagnostics change.

## Verification

Focused diagnostics/receipt tests passed 124 tests across seven suites. Cases
cover missing/duplicated/wrong-worker cycles, unknown fields, invalid numbers,
forced-GC evidence, out-of-order timestamps, incomplete revalidation, cache
bounds, uncleared caches, active workers, scalar-copy isolation and redaction.
The read-only ownership gate, server lint and server typecheck passed without
baseline updates. Both dependency-boundary checks, ESM import/mock-shape checks
and copyright also passed. No quality threshold was reduced.

Full backend coverage passed **1,800 suites / 56,322 tests**, with one Linux-only
directory-fsync skip on Windows, in 1,141.258 seconds. The actual Linux image
separately passed directory fsync, complete exclusive copy and unchanged-source
checks, non-root/read-only with no network, 128 MiB, one CPU and 64 PIDs. Its
generated container was removed and absence verified. This is not a power-loss test.

Three broad frontend attempts encountered unchanged deadlines: ESLint setup at
10 seconds (6,860 passed, 21 skipped), then two CSRF source-scan timeouts at five
seconds (6,880 passed each, one timeout each). The first overlapped backend
coverage; the second overlapped the image study; the third followed the study.
Therefore concurrency alone is not an established cause. No application assertion
failure was reported. The same 584-file scan took 194 ms outside Vitest; temporary
in-test timing measured 100 ms including its assertion in a single-file V8-coverage
run. All 26 lint-contract tests also passed together under coverage in 2.70 seconds.
Temporary timing edits were removed; no test/configuration/deadline was changed.

Final verification ran both existing projects in separate sequential invocations,
then used [Vitest's blob report merger](https://vitest.dev/guide/reporters)
to preserve every test and merge their coverage. **454 application files / 6,855
tests** and **three lint-contract files / 26 tests** passed. The merged result
contains **457 files / 6,881 passed, no skips**, in 415.76 seconds of reported
execution time. The fresh backend/merged frontend coverage ratchet passed without
baseline changes: backend statements/branches 89.71%/86.14%, frontend 87.25%/81.01%.
The official reporter and
[profiling guidance](https://main.vitest.dev/guide/profiling-test-performance) were
discovered/opened through MCP on October 12. This diagnostic split is not a fix
for the monolithic command's timing behavior. Preserve the failed-run logs and
investigate that harness interaction separately; do not silently exclude a gate.

## Exact image and completed-cycle observation

The no-cache Compose build used clean source
`68dc9c8aa03bc804416d2bf3ad88453a657d381b`; the inspected local Docker image ID is
`sha256:0190448fcc82ab7ba2bc55df9bede368bb608455051d616071bc82b2c41f7d64`.
This identifies a local artifact, not a published registry digest or signed
provenance. This outcome's later documentation commit does not change image code.

The isolated shared-catalog run **passed** its v3 contract in **1,248.7 seconds**.
Twenty waves completed 5,776 items across ten libraries/owners. Drain finished at
647.4 seconds with all 5,776 descriptions cached and no pending/failed tasks,
routing, handoffs or service errors. Representative publication/revalidation
completed at 669.9/1,031.3 seconds; comparison ready/revalidation completed at
718.5/1,042.6 seconds. Both real five-minute intervals were satisfied.

| Checkpoint | Main heap MiB | Process RSS MiB | Comparison / representative cache MiB | Sampled live references |
| --- | ---: | ---: | ---: | ---: |
| First completed post-drain comparison | 554.29 | 717.72 | 127.46 / 3.44 | 9 |
| Last completed post-drain comparison | 363.50 | 611.48 | 127.46 / 3.44 | 7 |
| Stopped | 365.73 | 612.90 | 0 / 0 | 7 |
| After observed natural major GC | 39.97 | 614.72 | 0 / 0 | 0 |
| End of two-minute quiet observation | 40.47 | 138.23 | 0 / 0 | Not re-sampled |

All **four created workers exited**. Cache inspection verified both caches empty
after stop; there was no new refresh during the quiet window. All eleven sampled
reference categories were zero after a natural main-thread major GC about
84.8 seconds into the post-stop wait. No forced GC, restart, altered clock or
resource-limit increase was used.

RSS did not fall immediately with the heap. Five subsequent quiet observations
showed heap near 40–41 MiB. RSS stayed around 586 MiB through the first four,
then fell to 138.23 MiB at the fifth. Anonymous-writable resident mappings fell
from 517.09 to 68.76 MiB, and their count from 2,093 to 315. The category does
not identify the owning allocator. This is evidence of delayed reclamation in
this fixture, **not a reproduced permanent sampled-object or worker leak**.
It does not establish the cause of Unraid's historical pressure or exclude leaks
outside the sampled objects/workload.

Raw container high-water memory was **1,117.72 MiB** under the unchanged 2 GiB
limit, with zero OOM kills or memory-limit hits. All six observed discovery
admissions were allowed: **pressure-to-recovery was not exercised**. Container
memory also includes PostgreSQL, the maintenance web process and file cache;
these scopes are not additive. Concurrent host tests/other local containers
mean this is not an exclusive-host timing benchmark.

The aggregate receipt remains private under
`.tmp/resource-study/classifarr-resource-study-73cc41c122428b7988f9b2e37bc16d91/result.json`,
SHA-256 `771ebe69d79e4ff8ca29b61e638ede4ba3ffd13a16ea8bef29883bd8cf4252e7`.
The runner verified cleanup; independent label queries also found no remaining
owned containers, networks or volumes. No caller image or live data was removed.

## Local replacement, backup and schema

Before replacement, the read-only probe showed ten covered libraries, 6,836
classifications, four unresolved identities (two source-review, two retry-due),
zero pending text vectors and 6,814 image-eligible pending items. The ten-row
batch was distinct. These figures were unchanged afterward at 10:12:30 UTC;
the probe made zero writes/provider calls. Historical cached-vector and memory
warnings remain historical evidence, not issues this diagnostic change fixed.

A **75,700,093-byte** local database archive passed checksum and archive-list
verification. Archive readability is not a restore rehearsal. Docker no longer
addressed the running container's previous image index/native/config IDs after
the reused build tag was replaced. The fallback retained as
`classifarr:pre-memory-aa851b14-78b1-486a-b9bc-cd828708fe92` is
`sha256:8f5a33192f73d9579ed48afc2d88005de321d7d10dea82833043e092e3c6fbbb`,
source `3da379102da042af1adf4a5e4644dd174cd53bba`. Diff review found only diagnostic
scripts/tests and documentation between it and the former source, not application
services, dependencies or migrations. **This is not an exact-image rollback.**
Operational lesson: retain and verify the running image before rebuilding a
reused tag, not merely before container replacement.

Only local Classifarr was replaced. It started at
`2026-10-12T10:11:41.466923842Z`, healthy with zero restarts/OOM, UID/GID
1000:1000, read-only root, no-new-privileges and the unchanged 2 GiB limit.
The early post-start warning/error query was empty. At 10:26:50 UTC, the container
remained healthy without restarts/OOM, and inventory/unresolved totals still
matched. Normal scheduling moved the two retry-due entries to retry-wait. Three
`mediaSync` warnings were classified by a bounded read-only query as "Library sync
skipped source items"; there were no error-level rows or ownership warnings in
that startup window. These checks are not sustained production acceptance.
Unraid, Plex and shared Ollama were unchanged.

After rebuilding, the exact image passed an isolated schema dump through
`20261010_220000_source_catalog_mappings.sql`, including 22 data-only migration
seeds. The tracked schema has no diff. Fresh-install checks found no invented
pending embeddings, stored images or unresolved identities. The fixture had no
external network and used one GiB, two CPUs and 256 PIDs. Its generated container
and data directory were removed, with both absences verified.

## Limits and next decision

The shared-catalog fixture uses synthetic transports and vectors but real SQL,
refresh builders, threads, cache behaviour and consumer code. It is not the full
application scheduler or a reconstruction of Unraid's retained heap. Season-level
mapping expansion remains a separate distribution to add to the corpus fixture.
Do not infer a leak from an RSS increase or a surviving weak reference alone.
Only observed lifecycle/GC evidence should justify a follow-up runtime fix.

Recommendation stack:

1. Keep the bounded lifecycle diagnostics: they distinguish live cache ownership,
   collectible objects and later RSS release without changing safeguards. Cost:
   observational overhead and limited object sampling remain explicit.
2. Next, add representative season-mapping distributions to the existing corpus
   fixture and repeat matched completed-cycle measurements. This broadens evidence
   across catalog scopes; it does not approve mappings or modify source libraries.
3. If quiet-state residency then persists, investigate the remaining memory
   categories before selecting a runtime fix. No allocator ownership is established
   here; do not raise limits, force GC or retain caches through pressure.

Before a release, investigate the monolithic frontend command's timing failures.
Passing the same test projects separately is useful validation, not a claim that
the default runner problem has been fixed or that this change caused it.

The recovery and image-evidence skills kept the design separate from measured
outcomes and tied claims to the exact disposable image. The dependency skill
kept the incompatible PR trial reversible. No release or PR merge was performed.
