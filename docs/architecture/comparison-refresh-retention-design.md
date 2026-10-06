# Comparison refresh retention investigation

Date: 2026-10-06. No release or Unraid deployment is authorized by this study.

## Questions and evidence

Two distinct conditions need separate evidence. The Unraid report at 06:18:45
EDT says `cached_vectors_incomplete`, not `memory_pressure`. Read-only library
coverage later showed complete Movies coverage but substantial missing TV
vectors, with no scheduled input retries in the inspected TV Shows report.
Observe progress before calling this a stuck worker. Import/metadata completion
does not imply optional description-vector completion.

The local memory follow-up must measure entire representative and comparison
refresh cycles, not infer retention from a JSON-allocation sample. Preserve
memory admission, deadlines, one-worker concurrency, fresh-snapshot verification,
cache budgets, ownership copies and ordinary retrieval fallback.

## Isolated measurement contract

- Use the fixed local image and only synthetic descriptions/vectors. Create a
  private PostgreSQL cluster under a newly generated `/tmp` directory, with no
  published port, network access, live database credentials or app-data mounts.
- Keep a 2 GiB container limit, two CPUs and bounded PIDs. Use real PostgreSQL
  vector transport/decoding, production refresh factories, fit workers, profile
  construction, verification and caches. Synthetic catalog rows and a fixed
  embedding identity replace media/provider access; no inference is requested.
- Run cold publication, unchanged revalidation, changed-source replacement and
  cache shutdown. Advance only the injected scheduler clock between cycles;
  this tests lifecycle behavior, not real elapsed cooldown or release soak.
- Record aggregate main-thread heap/external bytes, process-wide RSS, worker
  heap statistics/lifecycle and raw cgroup usage. Never sum worker RSS: it is
  process-wide. Track snapshots and model handles with weak references so the
  observer does not retain the objects it is measuring.
- First measure natural reclamation. A separate explicitly selected diagnostic
  pass may request GC only inside the disposable synthetic process, after each
  completed phase and after stop. This estimates reachable retention; it is not
  a runtime fix or a claim about normal collection timing. Never collect a live
  heap dump or expose an inspector port.
- Keep output bounded to aggregate phase summaries; no text, vector values,
  credentials, raw heap snapshots or provider payloads. Clean up the private
  PostgreSQL process and verify disposable-container removal even after failure.

## Decisions and limits

Do not change runtime behavior until the measurements identify a failing
contract. Missing vectors must never be replaced with fabricated vectors, and
partial coverage must not masquerade as a complete comparison profile. A status
improvement must preserve actionable evidence for persistent missing coverage,
provider failures and malformed cache data, not simply silence warnings.

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Whole-cycle measurements | Separates retained models, temporary copies and workers | Synthetic data is not production capacity proof; do first |
| Bounded vector transport | Could reduce text/array overlap | Select only after profiling; preserve transaction consistency |
| Change memory limits or force runtime GC | Could change the symptom | Hides causal evidence; reject |
| Accept incomplete comparison profiles | Earlier optional context | Changes completeness/quality contract; reject in this round |

Next: choose the smallest evidenced allocation, retention or readiness fix and
prove it with regression tests. If evidence shows expected backfill, explain its
progress and improve diagnosis rather than changing safe retry policy.

## Official sources

Discovered and opened through MCP web search on October 6, 2026:

- [Node process measurements](https://nodejs.org/download/release/v24.11.0/docs/api/process.html):
  worker creation is observable; RSS spans the process while heap statistics are
  thread-local. The earlier Node 24 documentation covers the APIs used here.
- [Node 24 worker statistics and termination](https://nodejs.org/download/release/v24.20.0/docs/api/worker_threads.html):
  inspect aggregate worker heap statistics and await termination; worker limits
  are not a whole-container memory budget.
- [PostgreSQL repeatable read](https://www.postgresql.org/docs/18/transaction-iso.html):
  successive reads in one transaction retain the same snapshot. Keep separate
  post-build verification instead of weakening snapshot consistency.
- [OpenTelemetry log semantics](https://opentelemetry.io/docs/specs/otel/logs/data-model/):
  distinguish non-erroneous progress from warnings and preserve useful context.
- [Node's heap-snapshot safety guidance](https://github.com/nodejs/learn/blob/main/pages/diagnostics/memory/using-heap-snapshot.md):
  snapshots can pause execution and consume substantial additional memory. Keep
  this investigation aggregate-only and isolated instead of dumping a live heap.
- [ECMAScript weak-reference processing](https://262.ecma-international.org/15.0/):
  collection timing is not guaranteed, and dereferencing keeps a target alive
  during the current synchronous job. Separate turns before diagnostic collection;
  an uncollected weak reference alone is not proof of a leak.
