# Verified diagnostic container limits

Date: October 11, 2026. Scope: local/CI diagnostic tooling on main; no release.

## Evidence and decision

The preceding [corpus profile](description-corpus-profile-outcome.md) found two
older callers passing byte counts to Testcontainers' GiB-valued `memory` option:
the retry-query benchmark and the profiling-maintenance integration fixture.
Installed Testcontainers 12.2.0 multiplies that argument by `1024 ** 3`. These
values do not impose the intended 1 GiB and 512 MiB limits. This does not establish
the cause of any production memory warning or query timeout.

Correct the two values and verify both Docker's configuration and Linux cgroup
memory/CPU limits before connecting to PostgreSQL or installing fixtures. Reuse
the existing disposable lifecycle and measurements. Add a small ESM resource
verification module, not another application service or database singleton.

## Contract

- Retry-query fixture: `memory: 1`, `cpu: 2`; maintenance fixture: `memory: 0.5`,
  `cpu: 1`. Application Compose limits, memory safeguards and SQL are unchanged.
- No application startup work, production database, provider call or retry loop.
  The benchmark still accepts no source connection or CLI overrides. Generated
  disposable credentials and existing SQL/transaction deadlines remain intact.
- A narrow Docker inspection reads only memory and CPU settings for the exact
  started container ID. Fixed `cat` commands read cgroup v2 limits, with bounded
  fallback to conventional v1 memory and CPU controller paths. No host mounts,
  arbitrary commands or paths, secret environment output or raw error bodies.
- Reject malformed, missing, unlimited or mismatched limits. Each Docker command
  has a ten-second deadline and a small output cap. Unsupported cgroup layouts
  fail clearly rather than producing resource-bounded evidence. Rootless and
  non-Linux engines are not presumed equivalent to the tested Linux engine.
- Callers stop their owned container after verification failure. Normal and
  failed runs independently check removal. Cleanup failure cannot count as
  success. A restart begins a fresh fixture; no durable production state changes.
- Kernel limits are configuration evidence, not proof of peak consumption, no
  swap, throughput, host isolation or retained memory. Do not deliberately exhaust
  memory to test OOM. Existing port exposure and resource-reaper behavior are not
  changed by this patch; all exercised databases remain synthetic and disposable.

Completion: unit tests reject bad units/limits/errors; both real fixture sizes
report the intended Docker and kernel caps before SQL; maintenance behavior and
retry result/rollback checks pass; owned resources are gone after completion.

## Options and recommendation stack

| Option | Pro | Con | Decision |
| --- | --- | --- | --- |
| Correct two numeric literals only | Smallest diff | Future unit drift or ignored limits can go unnoticed | Insufficient alone |
| Correct units and verify Docker plus cgroups | Checks requested and kernel-visible limits before work | Requires Docker CLI and recognized Linux cgroup layout | Recommended |
| Rewrite all test-container lifecycles | Uniform interface | Broad unrelated regression surface | Defer |
| Raise application limits or disable safeguards | Could reduce visible deferrals | Does not explain retention or contention | Reject |

Recommendation stack: correct diagnostic bounds → verify real fixtures → extend
refresh-worker/cache retained-memory profiling → select a measured application
fix. No UI or API changes, so no new web accessibility interaction is introduced.

## Official research

Discovered and opened through MCP on October 11, 2026; current living documents.

- [Testcontainers resource quotas](https://node.testcontainers.org/features/containers/):
  memory uses gigabyte-scale units, unlike the separate shared-memory byte option.
  The installed implementation confirms binary GiB conversion. Rootless runtime
  support must not be assumed.
- [Docker resource constraints](https://docs.docker.com/engine/containers/resource_constraints):
  hard memory and CPU limits constrain containers; do not disable OOM safeguards.
  Memory limits alone do not establish swap policy.
- [Docker container inspection](https://docs.docker.com/reference/cli/docker/container/inspect/):
  formatted inspection permits narrow output without exposing environment values.
- [Linux cgroup v2](https://www.kernel.org/doc/html/latest/admin-guide/cgroup-v2.html?highlight=freezer)
  defines `memory.max` and CPU quota/period; `max` means unlimited.
- [Linux cgroup v1 memory](https://www.kernel.org/doc/html/latest/admin-guide/cgroup-v1/memory.html?highlight=swappiness)
  requires reading back the kernel value rather than assuming a requested limit.
- [Linux CFS bandwidth](https://docs.kernel.org/scheduler/sched-bwc.html) defines
  the v1 quota/period ratio and negative unlimited quota. This is a bandwidth
  limit, not a guarantee of dedicated CPU cores or throughput.

## Random PR trial

Fresh enumeration found open #556 and #558. A cryptographic random draw selected
[#556](https://github.com/cloudbyday90/Classifarr/pull/556), immutable head
`a62b4d210fda8579fa961a5da3d6a7b6e3d7b888`. Trial its exact two server-file patch:
Node types 24.19.2 → 26.6.4; undici-types 7.24.6 → 8.9.0. Registry integrity agrees
and neither adds install scripts. Keep the existing Node 24-major contract.
The [DefinitelyTyped version policy](https://github.com/Definitelytyped/DefinitelyTyped)
aligns declaration major/minor versions with the represented library; a successful
typecheck alone is insufficient. Do not merge, close or edit the PR.
