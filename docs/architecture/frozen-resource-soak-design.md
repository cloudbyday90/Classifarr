# Same-image sustained resource qualification design

Date: 2026-10-02. Scope: isolated release tests, not a new production service.

## Decision

Make the existing 30-minute mixed-workload soak mandatory in the frozen-image
rehearsal. Build once from clean source, run the soak first, then the three saved
installation/upgrade profiles serially, then dispose of the owned image tag.
Check source identity around every phase. Never combine an old matrix with a
different soak image, import a previous passing receipt or downgrade to smoke.

Use the existing `runResourceStudyCompose` fixed-image input with the bounded
two-CPU, two-GiB, 128-PID profile. Its 30-minute workload, natural drain and
two-minute settled-idle observation remain unchanged. The study runs real
services with synthetic movie/TV providers, evaluation threads and loopback
retry faults; it is not model accuracy or a concurrent production-scheduler soak.
The installation matrix separately exercises the normal startup scheduler.

Version the aggregate rehearsal receipt to v2 because a v1 matrix pass has no
same-image sustained evidence. A small ESM projection module revalidates the
study version, exact mode/budget/image, startup continuity, durable recovery,
trend coverage and cleanup before retaining allowlisted numeric aggregates.
Unknown text, provider payloads and arbitrary exception messages cannot enter it.
Missing metrics remain a failure, not zero. Keep the original study's detailed
local receipt as additional evidence, not an alternative source of acceptance.

## Options and tradeoffs

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Reuse a historical soak | Fast | Reject: source/image and workload may differ |
| Add another background monitor | Continuous live data | Reject for this task: changes production behavior and exposure |
| Run existing soak on the frozen image | Matched resource and recovery evidence; no runtime change | Recommend: adds roughly 32–37 minutes plus setup to the full matrix |
| Tight absolute CPU/heap pass thresholds | Simple binary performance gate | Defer: synthetic data and host contention make these misleading |

Run the soak before the longer lease-recovery matrix to detect resource failures
early. Keep correctness, bounded runtime, no OOM/limit events, zero failed/pending
work, provider/pressure recovery, settled workers and owned cleanup as gates.
Report CPU throttling, event-loop delay and memory slopes with units and scope;
one run does not establish a leak diagnosis or minimum supported hardware.

## Security and compatibility

No host ports, external provider credentials, production volumes, arbitrary image
CLI input or Docker socket inside the fixture. No routing, schema, package,
deployment-template, user/group, lease or concurrency changes. Music stays excluded.
Existing ownership checks and recovery completion (import plus metadata) remain
intact. Cleanup owns only collision-checked random fixture resources and one tag.

Use a labeled Markdown table with numeric values and explicit scope, not color-only
status. No UI changes or accessibility conformance claim are made.

## Official research

Discovered with online search and checked October 2 for the requested September
2026 baseline. These live pages are not archived September snapshots.

- [Docker resource constraints](https://docs.docker.com/engine/containers/resource_constraints)
  recommends testing application requirements and explains memory/CPU ceilings.
  Verify effective limits; do not infer safe production defaults from a single test.
- [Docker stats](https://docs.docker.com/reference/cli/docker/container/stats/)
  distinguishes cache-adjusted CLI memory from raw usage. Preserve those scopes.
- [Linux cgroup v2](https://docs.kernel.org/admin-guide/cgroup-v2.html)
  documents CPU accounting/throttling and memory/PID events. Keep the existing
  version-aware collector; compare counters within one container lifetime.
- [Linux cgroup v1 memory](https://docs.kernel.org/admin-guide/cgroup-v1/memory.html)
  distinguishes limit-hit counters from OOM kills and describes usage accounting
  as approximate. Keep these labels separate; do not manufacture missing values.
- [Node process memory](https://nodejs.org/download/release/v24.11.0/docs/api/process.html)
  distinguishes whole-process RSS from worker-local heap/external values;
  ArrayBuffers are already part of external memory. Do not sum overlapping fields.
- [Node performance measurement](https://nodejs.org/download/release/v24.21.0/docs/api/perf_hooks.html)
  documents event-loop histogram units and sampling differences. Preserve the
  existing timer-resolution mode supported by pinned Node 24.18.1; no upgrade.
- [W3C complex images](https://www.w3.org/WAI/tutorials/images/complex/)
  supports adjacent structured text and tables for chart information. Keep results
  understandable without relying on a visual or color alone.

## Validation and next steps

Test one-build ordering, exact image binding, source drift, old/short/missing study
evidence, malformed metrics, drifted limits, missing idle/recovery, safe projection,
and failure cleanup. Run the actual no-cache frozen command from committed clean
source. Record measured results separately; partial success cannot pass v2.

After sustained evidence is accepted, perform real saved Unraid/Community Apps
operator acceptance and define the supported upgrade floor. An explicit later
release decision is still required; this commit creates no release.

The completed same-image run is recorded separately in the
[qualification outcome](frozen-resource-soak-outcome.md).
