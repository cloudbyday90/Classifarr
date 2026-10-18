# Gateway repeated-restore memory outcome

## Scope and evidence subject

Implemented on main on 18 October 2026, following the approved
[design](gateway-restore-memory-design.md). This adds isolated ESM measurement
tooling. No production server/client/schema, retry, retention, verification or
resource-limit code changed. No new packaged table/identity or admin action was
added; real job identities retain native UUIDv7 checks.

| Subject | Exact identity |
| --- | --- |
| Previous accepted main | `27ef9a6d21bbc0a6a831707b13d2963e800533dc` |
| Initial study implementation | `48462267cf9c578f87153092f866d73e9351e10f` |
| Initial no-cache image | `sha256:d7172e228acbd13642a699e03c1446de072ee5395e02bcf29d5bfc76055818be` |
| Corrected study source | `5fee11616b33097fc6e0be5c4453beb4a4d8e789` |
| Corrected no-cache image | `sha256:cbcea1936bb0656981a9bf7e4342a6475054b7ac96646885e14b58dea2070c70` |

Both builds required clean-source provenance and protected the running image.
Inspected OCI revision labels match their implementation commits. These are local
Docker image IDs, not registry-manifest or signed multi-platform acceptance
evidence. This document is a later documentation-only addition. Ignored local
logs are regenerable `.tmp/restore-memory-*.log` files.

No release, tag, PR merge, Unraid/Plex/shared-Ollama change, live recovery or
production purge occurred. No real model request was made by the study. GitHub
MCP enumeration found no open PR, so none could be selected or implemented.

## First native failure and correction

The initial image stopped before either memory lane started: the fixture queried
for an attempt-1 catalog and found none. The packaged worker correctly shares
revision budgets. Without new inference changing the revision, its prerequisite
archive consumes attempt 1 and the catalog consumes attempt 2. Existing native
scheduling/rotation fixtures already exercise this rule.

Corrected the fixture to require attempt 2, verify its matching verified
attempt-1 prerequisite, include the original catalog attempt in the immutable
study identity, and compare complete canonical source fingerprints afterward.
Tests reject attempts 1 and 3 rather than refunding or relaxing the budget.
The source checker now emits a fixed sanitized failure record; untrusted error
text is not published. No production counter, maximum, deadline or algorithm was
changed. The failed run exited nonzero and verified owned-resource cleanup.
It supplies no accepted memory observation.

## Completed quality checks

- Gateway tooling: 34 tests passed, including a real in-process inspector
  sampling check with no listening endpoint.
- Affected backend contracts: 36,319 tests in three suites passed, covering
  preflight, code health and ownership behavior.
- Ownership/preflight, copyright, both Knip modes, server/client lint and types,
  syntax, Markdown, whitespace and staged secret checks passed.
- Contracts reject false/changed receipts, wrong UUID/attempt, partial or reordered
  cycles, missing coverage, sampling gaps, malformed/deep/oversized profiles,
  unsafe numeric totals, leaked profile strings, inspector failures, writable or
  unowned mounts, host PID sharing, injected inspector options and incomplete
  resource proof. Cancellation/failure stops without retry.

Application sources were unchanged, so this is scoped contract validation, not
a claim that full backend/frontend coverage was rerun for this tooling patch.
The previous exact main's
[CI pipeline](https://github.com/cloudbyday90/Classifarr/actions/runs/39170055775)
and its capacity/security workflows completed successfully. That prior success
is not substituted for the new image's native checks or the final head's CI.

## Native study

The corrected image produced a real 233,157,832-byte v7 catalog. It has catalog
attempt 2 and 3,000 failed-history rows. The original complete source fingerprint
is `e0e05f6da3caa92ac4bb8ca9c984aa6b3eb45f7945b69547ef0157fbd1ad52d0`.
Dependency receipts and all artifacts/fixtures are read-only in each verifier;
no source socket/configuration, credentials, Docker socket or network is exposed.
Effective limits were verified: 1536 MiB memory/no swap, one CPU and 64 PIDs,
private 1 GiB scratch and 16 MiB temporary space.

Both lanes passed on the corrected image. Each of ten real restores returned
the exact expected receipt, left empty scratch and no child process, and kept
runtime/purge authority false. The source fingerprint above matched after both
lanes; no receipt was published or source attempt changed. The runner exited 0
with `restore_memory_passed_cleanup_verified`. Only its label-verified disposable
containers/volumes were removed; those synthetic fixtures can be regenerated.

### Natural lane

Five sequential restore durations were 17.60, 14.30, 13.09, 13.09 and 12.82 seconds.
The run included a 60-second baseline, four 60-second gaps and a 300-second tail.
It collected 672 samples over 670.94 seconds, with no failed samples, complete
required-counter coverage and a maximum gap of 1.53 seconds. Sampling's measured
elapsed read time was 1.572 seconds (0.234% of the observation window), not a
measurement of CPU overhead or all observer effects.

The table shows the last sample of each quiet phase, not coincident peaks. MiB
means 1,048,576 bytes. ArrayBuffers are already included in external memory.

| Phase end | RSS MiB | Heap used MiB | Heap total MiB | External MiB | ArrayBuffers MiB | Cgroup anonymous MiB | Cgroup file MiB |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Baseline | 69.40 | 7.68 | 9.79 | 3.24 | 0.76 | 19.13 | 35.02 |
| Gap after restore 1 | 159.76 | 11.50 | 74.29 | 17.74 | 15.32 | 108.63 | 40.44 |
| Gap after restore 2 | 162.57 | 24.70 | 73.79 | 18.65 | 16.24 | 111.35 | 43.89 |
| Gap after restore 3 | 164.04 | 25.39 | 73.54 | 18.66 | 16.25 | 113.11 | 43.90 |
| Gap after restore 4 | 163.99 | 15.02 | 74.04 | 17.87 | 15.46 | 112.85 | 43.90 |
| Final five-minute tail | 70.70 | 7.15 | 9.54 | 3.37 | 0.95 | 19.50 | 43.90 |

The kernel lifetime cgroup peak was 991.64 MiB, below the unchanged 1536 MiB
limit, with zero OOM, OOM-kill, limit-hit and PID-limit events. Sampled process
RSS peaked at 196.90 MiB. The much larger cgroup charge includes the private
restore workspace and file-backed memory; it is not Node heap. Counters overlap
and their peaks need not coincide. No cache was dropped or peak reset.

There were 264 observed GC events, including 63 major events, with 974.81 ms of
reported GC duration and zero forced events. The return toward baseline is
consistent with reclaimable transient allocations in this run. It does not prove
leak freedom, identify an allocator cause, or predict long-running/changing-history
behavior. File charge remained about 8.88 MiB above its baseline endpoint.

### Separate allocation lane

All five restores also passed in the fresh diagnostic verifier. Sampling used a
fixed 512 KiB interval with collected-object flags. These are estimated allocation
bytes over each operation, not maximum simultaneously live bytes.

| Restore | Sampled estimate MiB | Database transport share | Catalog-hash share |
| --- | --- | --- | --- |
| 1 | 292.75 | 80.53% | 0.34% |
| 2 | 274.24 | 84.87% | 0.73% |
| 3 | 298.05 | 81.88% | 0.17% |
| 4 | 265.63 | 81.17% | 1.13% |
| 5 | 269.35 | 82.18% | 0.37% |

Across the five profiles, transport-labelled stacks accounted for 82.10% of
sampled estimates; catalog hashing accounted for 0.54%. This identifies
PostgreSQL protocol/row decoding as the next investigation target, not an exact
retention owner. The classifier inherits a known component through unclassified
descendants; it is coarse attribution rather than an allocation-site audit.
Private-copy/file-validation work also allocates; it must not be bypassed to
improve a benchmark. No raw profile, stack, function name, URL or payload was saved.

This lane collected 76 samples over 69.09 seconds with no missing required
counters or failed samples, a maximum gap of 1.92 seconds, and 414.36 ms of
observed sampling read time. Its cgroup lifetime peak was 947.26 MiB with zero
OOM/limit/PID events. These instrumented measurements are diagnostic, not natural
capacity or profiler-overhead comparisons.

## Native safety regression and protected local refresh

The existing default archive/catalog/retention rehearsal passed on the same
corrected image, exiting 0 with `online_archive_rehearsal_passed`. It exercised
online SELECT-only exports, real restricted restores, full candidate-page proof,
inventory tamper/legacy-receipt refusal, UUIDv7 jobs, service restarts, mixed v3/v4
rotation to two roots, corruption refusal, late-file changes, shared dependency
pins, interrupted retirement, oversized excluded history and the 10,001-job
refusal. Live fixture history/attempts were preserved with zero provider calls.
Label-filtered container and volume inventories were empty afterward. Combined
capacity checks use sparse synthetic accounting, not real dump throughput.

Final preflight, all four policy gates, static ESM imports and test-mock shapes
passed. Markdown checked 2,288 files with zero errors. Full production-cadence
inference endurance, multi-platform registry acceptance and a full application
database restore were not rerun or inferred from these checks.

Before replacing normal local Compose, rechecked context `desktop-linux`, old
container `a626a58d1b10e587ac94057e8307f381ff48528a10fb1fd0885d67e0dbcedcf0`,
its image and the repository `data` bind. Created a new private backup without
overwriting existing files:
`data/backups/gateway-restore-memory-ready-20261018.dump`, 76,251,351 bytes, mode
0600, SHA-256
`15a8e5c6859c6f7aa54d28c4cda0174fff9874fac58ee0cdbfbedcf9f7205f38`.
`pg_restore --list` passed; this validates the backup list, not a full restore.

Protected Compose replacement used `--no-build --no-deps --pull never` and the
exact tested image above. New container
`3904c2aca6a075d770a95822fc6726573716cbf6ab6c23eacefef5b0dbae2ac2`
is healthy with the inspected `5fee11616b33097fc6e0be5c4453beb4a4d8e789`
revision. `/health`, `/api/system/health/ready` and `/` returned HTTP 200 on local
port 21324. The preceding image
`sha256:bb5ae10262451bc9f91b6f0282d4c6a8f7793fa48d54de24c0d24156dd8ea441`
remains under its verified `classifarr-local-rollback` container-ID tag.
No image/backup pruning occurred.

Read-only checks before/after replacement found zero optional
gateway/archive/catalog/cleanup namespaces in the normal database. Capture
budget revision 2, all four call/token/reservation counters at zero and its
existing next-check timestamp remained unchanged. Standalone gateway services
were not activated. Documentation added after the image build changes no runtime
source; remote CI must still be checked against the final pushed head.

## Interpretation and recommendation safeguards

Natural means no inspector or requested GC, not zero instrumentation. The sampler
runs inside the verifier so it can see that process's heap/external counters;
its allocations, file reads and GC effects are included, not subtracted. Report
observation cost and allocation components conservatively. Unknown frames stay
`other`. Statistical allocation estimates describe churn, not exact retained
ownership or all native buffer memory.

The allocation lane runs afterward in a fresh process/container on the same
artifact. Filesystem caches may be warmer; this is not a crossover benchmark or
an unbiased profiler-overhead measurement. Its timings/memory are not natural
capacity evidence. The quiet tail stops restores, not sampling activity.

Keep RSS, heap, external/ArrayBuffers and cgroup cache/anonymous counters separate;
they overlap and peaks need not coincide. The image is Alpine/musl, so the glibc
example in the official
[Node memory documentation](https://nodejs.org/download/release/v24.21.0/docs/api/process.html#processmemoryusage)
does not establish its allocator cause. The design links the official inspector,
protocol and heap-snapshot guidance retrieved through MCP on 18 October 2026.

No production optimization follows from RSS alone. In particular, the frozen
catalog check before admission insertion and the later restored-state checks are
not interchangeable. Preserve full-row fingerprints, byte/count charging,
external-file revalidation, phase/session binding, refusals and cancellation.
Any deduplication proposal must establish that it removes the same work in the
same trusted view, not a check across a changed snapshot or ownership boundary.

## Recommendation stack and next item

1. Keep the current verification path and resource limits. The natural tail
   recovered close to baseline; a restart workaround or memory-limit increase is
   not justified by this finite study.
2. Investigate bounded PostgreSQL transport/row-decoding churn first. Advantage:
   targets the largest sampled component. Cost: attribution is coarse and needs
   a controlled comparison; preserving exact canonical bytes, counts, limits,
   cancellation and ordered full-row hashes is mandatory.
3. Consider only demonstrably duplicate work inside the same trusted database
   view after that investigation. Advantage: potentially fewer allocations and
   reads. Risk: accidentally deleting a distinct pre-/post-admission proof or
   weakening byte charging. Cross-phase caching remains excluded.
4. Retain this fixed study as a regression tool. A longer changing-history
   endurance run would improve confidence but costs more time and I/O. Do not
   replace fresh private PostgreSQL workspaces with a shared restored database.

Next: design and compare a bounded row-decoding/transfer improvement against the
existing full-integrity path, using identical artifact inputs and exact refusal
contracts. No such production optimization was implemented in this patch.
