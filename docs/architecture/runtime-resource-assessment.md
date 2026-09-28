# Runtime resource assessment

## Observation — 28 September 2026, before rebuild

Read-only Docker, cgroup and PostgreSQL observations found no runaway worker,
duplicate Node process, OOM kill or memory-limit failure in the running Classifarr
container. This is a point-in-time assessment, not a peak-load guarantee.

| Resource | Observed state | Constraint / meaning |
| --- | --- | --- |
| Container memory | About 1.07 GiB of 2 GiB (54%) | Hard 2 GiB shared by Node, PostgreSQL and other processes |
| Lifetime cgroup memory high-water | About 1.52 GiB | Zero recorded limit failures or OOM kills |
| Node process RSS | About 940 MiB | Includes more than JavaScript heap |
| CPU | About 0.38% at the sampled instant | No quota; 16 logical CPUs visible to Docker |
| Processes / threads | About 29–31 | No PID limit; one Node process and normal PostgreSQL workers |
| PostgreSQL connections | Six, five idle | No idle-in-transaction or queries active over 60 seconds |
| Queue | No pending or processing rows | Approximately 37,000 completed enrichment rows are history, not active jobs |
| Host | 32 GiB RAM, about 6.3 GiB free | Docker VM has about 15.6 GiB available; other host apps also use RAM |

The configured 1536 MiB V8 old-space ceiling is not a total process memory cap.
At that ceiling only 512 MiB of the container limit remains for other V8 spaces,
buffers, native allocations, PostgreSQL and the rest of the container. A present
snapshot below the limit does not prove this configuration safe at peak load.

The discovery admission service already reserves headroom. At a 2 GiB limit its
configured reserve plus minimum start headroom is 1 GiB. It can intentionally
defer a scan before the container hits its hard limit. Docker's displayed usage
subtracts cache, so that figure alone cannot predict the admission decision.
An in-container diagnostic Node process reported 983 MiB available through the
cgroup-aware API, below that 1,024 MiB new-scan requirement at observation time.
The probe itself consumes memory; this does not prove a persistent blocked state.
Queue concurrency
settings were absent, so the implementation defaults apply: one general worker
and five metadata workers, with configured maxima of five and twenty respectively.

## Research and recommendation stack

Official sources discovered and reviewed on 28 September 2026:

- [Docker resource constraints](https://docs.docker.com/engine/containers/resource_constraints):
  CPU is unlimited by default; memory and swap limits have distinct meanings.
- [Docker stats](https://docs.docker.com/reference/cli/docker/container/stats/):
  displayed memory subtracts cache and PID counts include threads.
- [Docker Desktop settings](https://docs.docker.com/desktop/settings-and-maintenance/settings/):
  WSL 2 VM limits and container limits are separate controls.
- [Node 24 command-line options](https://nodejs.org/download/release/v24.20.0/docs/api/cli.html):
  old-space limits govern V8's old heap and affect garbage-collection pressure.

| Recommendation | Pro | Con |
| --- | --- | --- |
| Keep existing limits during this functional change | Avoids introducing resource-related regressions | CPU and PID ceilings remain unset |
| Measure RSS, heap, cgroup headroom, event-loop lag and queue concurrency under bounded load | Produces evidence for admission and limit tuning | Needs representative sustained workloads |
| Then set configurable CPU/PID budgets and reserve non-heap memory | Contains future runaway work and protects shared hosts | Tight ceilings can delay backfill or prevent process creation |
| Do not simply raise heap or disable OOM handling | Preserves host safety | Requires identifying the actual bottleneck |

Final recommendation: retain the current limits for this rebuild; make bounded
resource admission and a mixed-library load test the next implementation item.
No unrelated container or host process is stopped by this work.

## Post-rebuild outcome

Pending rebuild and health/resource verification. The old image will be retained
for rollback, with persistent data and routing settings preserved.

Before deployment, a custom-format PostgreSQL backup was created at
`data/backups/pre-rebuild-20260928-1432.dump` (79,911,355 bytes, mode 0600 inside
the container). Its 1,799-entry archive index and full SQL extraction to `/dev/null`
passed. This verifies readability, not a restore rehearsal. The file is ignored by
Git and may contain secrets; do not publish it.

The previous image is retained as `classifarr:rollback-20260928-996c4fe0`, revision
`996c4fe075f6ffb8d15529a085991dcb940092f0`. Image rollback alone does not reverse
database migrations. The deployment must advance the current 291 migration ledger
entries to 296 using the existing migration runner.
