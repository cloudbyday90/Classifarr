# Archiver pressure attribution — design

Approved 2026-10-20 through grill-me: a short, four-run matched-shape study before
another sustained co-load comparison. No production optimization or admin controls.
See the separate [observed outcome](gateway-archiver-pressure-outcome.md), including
the shared-host timing confound and limits on attribution.
The [co-load outcome](gateway-owned-catalog-coload-outcome.md) found a 256 MiB
archiver peak. Earlier unsampled qualification also reached that ceiling; high
charge alone is neither a heap-leak diagnosis nor comfortable headroom.

## Scope and experiment

Reuse the qualification runner and packaged worker/verifier, adding one fixed
pressure scenario. Run unsampled, sampled, sampled, unsampled sequentially on one
immutable, clean-source image. Two repetitions per arm give directional evidence,
not a precise causal overhead estimate or production capacity guarantee.

Both arms use 3,000 inert failed jobs with deterministic varied 75,000-byte padding
from the existing study generator. Record its payload digest, canonical byte/count
bounds, physical storage and per-arm history fingerprints. Generated UUIDv7 IDs,
timestamps and prerequisite receipts differ: these are matched shapes, not cloned
databases. Preserve old compressible qualification fixtures and their read-comparison
warm-up; the new scenario omits that extra warm-up equally in both arms. No cache
flush, forced GC or statistics reset. A no-cache build is not a cold-cache experiment.

Require two real catalog captures/restores per run, original attempts, unchanged
history and cleanup counters, plus existing exhausted-attempt and oversized-evidence
refusals. Name capture stages so prerequisite/quiet/refusal timings cannot be mistaken
for the two large captures. Keep optional attribution separate from correctness.

## Diagnostics and safeguards

Collect bounded read-only accounting before worker spawn and after close in both
arms. Classify optional reads as available, absent, denied, invalid, budget-exhausted
or read-failed using fixed codes, never raw errors/paths. Use fixed versioned memory,
CPU, I/O and PSI interfaces; choose one successful I/O interface without summing
overlapping counters. Report the selected interface and all attempt statuses.
Readable empty I/O accounting means no attributed device rows, not no logical I/O.
Missing metrics remain absent. Counter decreases or interface changes invalidate
the corresponding delta; version-specific event units are not interchangeable.

Keep the existing sampled arm's identity-bracketed process/cgroup probe, 500 ms
spacing, 420-sample cap, cooperative 50 ms read budget and bounded peak/window
summaries. Add useful coverage/gap checks for the large captures; retain partial
process/optional evidence explicitly. The unsampled arm still has the common
wrapper, lifecycle polling and endpoint accounting: it is not observer-free.
Common endpoints do not locate internal phases or isolate process I/O ownership.

Do not change shared runtime parsers or the co-load sampler as part of this study.
Keep v1 charging/uncharging and faults distinct from v2 reclaim/refault counters.
PSI unavailable on a v1 host is not replaced with host-global PSI. No host mounts,
Docker socket, privileged telemetry, writes to cgroup controls or host changes.

Retain archiver 256 MiB/no swap/0.5 CPU/32 PIDs; verifier 1.5 GiB/no swap/1 CPU/64
PIDs; source 2 GiB/2 CPUs/512 PIDs. Preserve operation/SQL/connection deadlines,
byte/count limits, attempts, cooldowns, pins, file races, read-only worker roots,
UID 1000, network isolation and sealed committed inputs. Fresh installations do
nothing new. No tables or persistent identities are added.

Missing prerequisites refuse before fixture work. Cancellation, timeout, malformed
results, OOM, failed restore/history/coverage checks or unknown completion fail the
study; no automatic retry or budget reset. Optional unavailable accounting marks
attribution incomplete without inventing measurements or invalidating otherwise
proven archive correctness. Cleanup attempts every exact label-owned resource,
even after failure, and verifies absence before success. Never purge live history.

## Official research and tradeoffs

Discovered through MCP search/GitHub and opened on 2026-10-20:

- [NIST blocking guidance](https://www.itl.nist.gov/div898/handbook/pri/section3/pri332.htm):
  control nuisance factors and balance treatments; our four-run order is a small
  exploratory comparison, not randomized statistical proof.
- [Docker runtime metrics](https://docs.docker.com/engine/containers/runmetrics/):
  cgroup accounting and process RSS differ; cached/shared pages complicate attribution.
- [Kernel v2 counters](https://www.kernel.org/doc/html/latest/admin-guide/cgroup-v2.html?highlight=freezer):
  memory/stat, reclaim, refault and device I/O counters have distinct semantics.
- [Kernel v1 block accounting](https://cdn.kernel.org/doc/html/latest/admin-guide/cgroup-v1/blkio-controller.html):
  ordinary and recursive interfaces overlap; never add both.
- [Kernel v1 memory guide](https://www.kernel.org/doc/html/latest/admin-guide/cgroup-v1/memory.html?highlight=swappiness):
  charging events are not disk I/O; this legacy guide warns it is outdated, so its
  descriptions are background, not proof of current kernel reclaim behavior.

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Fixed varied-history short study | Bounded repeated evidence with actual restores | Not sustained inference contention; selected first |
| Repeat old compressible study | Existing automation | Already reached ceiling without sampling; insufficient new evidence |
| Exact seed cloning | Stronger initial byte matching | Extra restoration/ownership complexity, still different generated jobs/caches; deferred |
| Raise memory or remove validation | May reduce visible pressure | Hides cause or weakens recovery; rejected |

## Separate open PR and verification

MCP listed only open PR [#566](https://github.com/cloudbyday90/Classifarr/pull/566);
random selection from `[566]` chose it. Revalidated unmerged at head
`a4beccb1edd141da7b4014dec70b9518122b5f4b`, base
`2149220bffe289803f8cf10942896a4e6b9894a0`. Pin testcontainers and
@testcontainers/postgresql to 12.2.1 in a separate commit. The official
[release notes](https://github.com/testcontainers/testcontainers-node/releases)
describe port-binding/reaper and stream changes. Registry engines fit Node
24.21.0; build/prepack scripts are not new install hooks. Keep strict install
policy, security overrides and direct Undici 8.12.3. Do not merge the PR.

Test counter formats, empty/invalid/duplicate input, read denial/budget, interface
selection, reset deltas, privacy, matching/stage rules, coverage and fixed sequence.
Extend real bootstrap/binding rejection tests rather than bypassing them. Run
strict install/tree/audit, targeted and real PostgreSQL integration, affected
quality gates and native image regressions. No heavy tests/builds during the four
measurements. Build local Compose without cache from clean committed source, then
back up and evaluate only local appdata. Separate outcome, Unreleased, secret
scans, commit/push all changes on main. No release/tag/version bump.

Stack: exact dependency batch → versioned bounded observations → matched-shape
fixtures → sealed image contracts → four sequential runs → real restore/history
proof → verified cleanup → backed-up local evaluation. Choose further optimization
only from the observed evidence; sustained comparison remains deferred.
