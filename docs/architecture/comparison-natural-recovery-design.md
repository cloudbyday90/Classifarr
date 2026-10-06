# Natural comparison recovery

Date: 2026-10-06. Follows [concurrent measurements](comparison-concurrent-study-outcome.md).

## Contract

Add an opt-in, isolated `comparison-recovery` study. Keep the representative and
comparison refreshers alive while memory falls naturally. Use their real schedule
registrations (minute offsets, initial delays, no-overlap), real wall clocks,
production backoff, cache limits, worker fitting, vector SQL and advisory locks.
Change one synthetic description once, five minutes after the first comparison
success. No ballast, forced GC, inspector, restart, deadline changes or reduced
memory safeguards. Nothing new runs on ordinary installations.

Observe exact shared-admission decisions through an optional synchronous numeric
observer. Capture available, reserve, reserved, work, hysteresis and required bytes
at the decision, not a second telemetry read or a copied budget formula. Observer
failure must not change admission or permit cleanup; normal production has no
observer. This does not explain a later in-flight checkpoint rejection by itself.

Reuse the bounded launcher: immutable image, random owned project, synthetic data,
internal network, non-root/read-only container, two CPUs, 2 GiB, 128 PIDs. Preserve
the private comparison PostgreSQL cluster for a matched diagnostic; this is not
same-catalog application startup or production-capacity evidence. Real schedule
callbacks run through a small isolated adapter, not the entire application scheduler.
No provider HTTP, routing, migrations or ingestion ownership changes.

Bound observation to 25 minutes after setup and at most 60 scheduled callbacks
per worker. Stop timers, abort/join admitted work and release locks before closing
the private cluster. Failures remain failures and still save sanitized bounded
traces. Unknown telemetry, cancellation, missing pressure, incomplete recovery,
OOM/limit hits and cleanup failures cannot produce a passing receipt. A new run
starts fresh isolated data; no persisted production retry state is reset.

Completion requires a shared-budget memory-pressure refusal, a corresponding
comparison deferral, a later admitted comparison success and a subsequent scheduled
revalidation at least five minutes later, with zero active workers/permits and
unchanged resource limits. Ordinary retrieval remains the production fallback.
Natural allocation may not reproduce pressure on every host: report that honestly
instead of injecting pressure or weakening the completion test.

## Options and recommendation

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Keep real refreshers and schedules running | Direct evidence of unattended retry and exact budget | Longer bounded run; recommended now |
| Replace the synthetic catalog with a full application fixture | Removes the extra database footprint | Separate fixture/integration work; next fidelity improvement |
| Change allocation or memory limits now | Could reduce warnings | No causal evidence for another fix; defer |

Use modular ESM, regression tests for observer isolation, scheduler cleanup and
receipt rejection. Keep prior failed studies unchanged and record this outcome
separately. No UI change or new W3C conformance claim is involved.

## Official research

Discovered and opened through MCP on October 6, 2026:

- [Node 24 process memory](https://nodejs.org/docs/latest-v24.x/api/process.html):
  available memory and whole-process RSS are distinct from thread-local heap;
  worker heaps must not be added to RSS as if they were disjoint.
- [Node timers](https://github.com/nodejs/node/blob/main/doc/api/timers.md): callbacks
  need not run at exact requested times; measure actual elapsed time and retain deadlines.
- [Node heap snapshots](https://github.com/nodejs/learn/blob/main/pages/diagnostics/memory/using-heap-snapshot.md):
  snapshots pause execution and add substantial memory, so exclude them from this
  natural-recovery measurement.
- [Docker constraints](https://docs.docker.com/engine/containers/resource_constraints):
  bound resource use and retain OOM protection while measuring requirements.

Fresh random PR selection from open #555/#556 chose
[server typings #556](https://github.com/cloudbyday90/Classifarr/pull/556), head
`9d74537d7917c248d15926f37b2e40ceba7559a4`. Trial only its manifest/lock changes:
`@types/node` 24.19.1 to 26.6.4 and `undici-types` 7.24.6 to 8.9.0. The existing
runtime-major gate decides acceptance before installation. Benefit: newer API
declarations; cost: APIs outside deployed Node 24. Recommend retaining Node 24
types if the gate fails, consistent with
[DefinitelyTyped versioning](https://github.com/Definitelytyped/DefinitelyTyped).
