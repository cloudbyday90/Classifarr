# Shared discovery admission design

Date: 2026-09-19

## Problem and boundary

The [allocation outcome](discovery-allocation-outcome.md) removed avoidable copies
but the real paired comparison still reached its shared 2 GiB container limit.
The application, evaluator, workers, retained profiles and PostgreSQL consume the
same budget. Independent V8 limits do not coordinate them.

Add shared admission before vector snapshots for live multi-scale refresh,
representative-profile refresh and the ordinary description benchmark CLI.
Keep routing, numerical fitting, model identity, holdouts, source verification,
existing timeouts and normal metadata backfill unchanged. Policy-replay/fresh-policy
CLIs have separate execution paths and are not covered by this first boundary.

## Design

- Reuse the existing session advisory-lock helper with one dedicated discovery key.
  A nonblocking lock admits one participating job across processes using the same
  database. No new schema, writable lock file, long transaction or queue is needed.
- Check memory after lock acquisition and before snapshot/provider work. Node's
  OS-aware available-memory reading includes the shared Linux cgroup, rather than
  treating the current process's heap as all available capacity.
- Require 768 MiB of initial working headroom plus a reserve of one eighth of the
  effective memory limit, bounded to 128–512 MiB. These conservative starting
  thresholds are an engineering policy, not an exact allocation forecast.
- Monitor available memory every 250 ms while admitted. Falling below the reserve
  or losing valid telemetry aborts the job; check again before returning its result.
  Keep the lease until the callback has settled, including worker termination.
- Combine caller, shutdown, memory-pressure and lock-loss cancellation. Never
  publish an interrupted result or release a lock while its callback still runs.
- Return fixed, private-safe deferral reasons. Live jobs retain existing bounded
  retry/backoff; the CLI exits unsuccessfully with an explicit deferred result,
  not a completed or partially successful comparison. No automatic paid rerun.
- Contention preserves existing verified SWR entries under their original TTL and
  revision checks. Memory pressure clears the affected cache to release ownership.

Admission is cooperative: allocations between checks and unrelated processes can
still cause pressure. The container limit remains the hard boundary. On platforms
without detected constraints, use physical memory as the effective ceiling;
unknown/invalid availability fails closed. No swap assumptions or limit increases.

## Official research

Sources discovered online and inspected on 2026-09-19:

- [Node process memory APIs](https://nodejs.org/api/process.html): available memory
  is OS-aware; constrained memory can be zero when unavailable/unconstrained.
- [libuv memory semantics](https://docs.libuv.org/en/v1.x/misc.html): available
  memory incorporates Linux cgroup limits and falls back to system free memory
  without known constraints. Prefer the maintained platform implementation over
  hardcoded cgroup mount paths.
- [Node 24 worker limits](https://nodejs.org/download/release/v24.18.0/docs/api/worker_threads.html):
  worker limits cover the JS engine, not external buffers or global process OOM.
- [PostgreSQL advisory locking](https://www.postgresql.org/docs/17/explicit-locking.html):
  session locks survive transaction boundaries and end with the session. They are
  cooperative; callers must all use the same key. Existing connection-loss handling
  cancels the callback and discards a broken pooled connection.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages):
  meaningful status changes should be accessible without excessive interruption.
  This change uses existing deduplicated operational status, not new dialogs or
  per-item notices. No UI markup changes are needed.

## Options and recommendation

| Option | Benefit | Cost / limitation | Recommendation |
| --- | --- | --- | --- |
| Shared lock plus memory admission/monitor | Protects recovery from competing discovery jobs | Deferral; cooperative rather than hard cap | Implement now |
| Per-process semaphore only | Simple local concurrency | Does not coordinate CLI/application processes | Insufficient |
| Raise heaps/container limit | More immediate headroom | Masks competition; deployment-dependent | Do not change |
| Separate resource-limited execution process | Stronger isolation and reclaim on exit | IPC, ownership, serialization complexity | Follow up if measurements require it |

Validate with unit faults, real PostgreSQL contention/connection loss, synthetic
pressure recovery and read-only Compose checks. Then resume the smaller,
query-relevant RAG-packet experiment; do not interpret placement agreement as accuracy.
Record implementation and measured limits in a separate outcome document.
