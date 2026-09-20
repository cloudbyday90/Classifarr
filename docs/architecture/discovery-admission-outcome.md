# Shared discovery admission outcome

Date: 2026-09-19

## Implementation

The [design](discovery-admission-design.md) adds two small ESM services: OS-aware
memory assessment and database-scoped discovery admission. Production composition
wires the same lock into live multi-scale refresh, representative-profile refresh
and the ordinary description benchmark CLI before provider inspection/vector reads.
Pure refresh services retain injectable dependencies for deterministic tests.

One participating owner runs at a time. Initial admission requires 768 MiB of
working headroom plus a 128–512 MiB reserve (256 MiB at the tested 2 GiB limit).
A 250 ms monitor and explicit pre-publication checks cancel work under pressure.
Timers are removed and the lease remains owned until callback cleanup finishes.
Caller cancellation and database-connection loss are combined with pressure
cancellation. No fitting algorithm, vector precision, model, timeout or routing
authority changed.

Live contention preserves existing verified cache entries under their original
TTL/configuration/revision checks. Pressure clears the affected cache; existing
backoff retries automatically. The scheduler recognizes a deferred refresh as
retrying and retains its transition-only logging. Ordinary retrieval, description
backfill and media synchronization are not disabled or placed behind this lock.

The CLI returns a fixed `deferred` report with `busy`, `memory_pressure` or
`memory_unknown`, `sourceVerified: false` and `livePromotionAllowed: false`, exiting
unsuccessfully. It does not label partial work complete or claim zero model calls
after a late interruption. It does not automatically repeat inference calls.

## Verification

Six focused suites / 98 tests passed. Three real-PostgreSQL suites / 16 tests
passed, including independent session contention, cancellation, termination of
the lock-owning connection, rejection of late success, and subsequent admission.
Tests also cover unknown telemetry, boundary values, timer cleanup, memory deferral
before snapshot/provider work, pre-publication pressure, live backoff recovery,
preserved SWR expiry and production runtime wiring.

Lint, client/server types, copyright/dependency preflight, ESM static imports and
ESM mock shapes passed. All 1,374 Markdown files passed lint. The full frontend
run passed 369 files / 5,128 tests in 331.73 seconds, with 87.67% line coverage and
77.54% branch coverage. The full backend passed 1,326 suites / 38,586 tests in
830.693 seconds, with 90.25% line coverage and 83.17% branch coverage. The coverage
ratchet passed for both scopes; no coverage baseline or threshold was relaxed.
The pre-existing production-naming gate still reports 43 references
against its zero baseline; no waiver or baseline change is included.

## Local Compose evidence

The application was rebuilt with the changes and remained healthy on its read-only
root filesystem. A private, read-only fault probe used the real database helper to
hold admission, then spawned the actual benchmark CLI as a separate Node process.
The CLI returned `deferred / busy`, exited 1, and did not report verified results.
After release, another owner was admitted. Injected low availability cancelled a
held callback, and restoring the injected reading allowed another run.

The probe observed a 2,147,483,648-byte constrained memory limit versus
16,731,418,624 bytes of host physical memory. Available memory was 1,848,360,960 bytes
before the probe. This confirms that the tested platform reports container-aware
availability. Pressure injection did not allocate memory or induce an actual OOM.
The probe was streamed through stdin; no writable-container exception was needed.
Private scripts and logs remain ignored under `.tmp/`.

A real-inventory, zero-generation smoke run used eight held-out descriptions and
two folds in multi-scale-context mode. Both folds finished, but the unchanged
full-snapshot contract invalidated the report on metadata drift from continuing
background work. It is not a valid comparison result. The container recorded zero
memory-limit hits during that run. No source check was weakened to make it pass.

The paired-AI mode's audited content-only contract then passed the same
eight-description/two-fold zero-generation smoke: `status: preflight`,
`contextComplete: true`, `sourceVerified: true`, no changed source components and
zero generation calls. Both folds had local context available. It read 6,655
document identities, 6,652 descriptions/vectors and ten libraries. The embedding
model/identity and 2 GiB container limit were unchanged.

After both smoke runs, whole-container counters showed zero memory-limit hits,
zero OOM kills, zero restarts and a 1,656,508,416-byte peak. The application remained
healthy. These are smoke observations, not a guarantee for larger workloads or a
before/after performance comparison: the previous experiment had 300 held-outs,
five folds and 400 generation calls, and host regression tests ran concurrently
with these smoke checks. No new accuracy or inference-quality claim is made.

## Tradeoffs and next recommendation

1. Keep shared admission and automatic retry. It coordinates the participating
   processes and protects a reserve; the cost is deferred expensive work and one
   pooled database connection per admitted job. Existing ordinary work is not
   globally serialized.
2. Measure remaining pressure before claiming a hard bound. The guard is
   cooperative, not an OS memory reservation. Synchronous allocation bursts,
   uninstrumented processes and platforms without detected constraints remain
   limitations. The fixed startup headroom can reject smaller jobs that might fit.
   Separate resource-limited execution would give stronger isolation/reclamation
   but requires more IPC and ownership work; do not merely raise limits.
3. Resume the smaller, query-relevant, nonredundant RAG-packet experiment from the
   [previous comparison](discovery-allocation-outcome.md). Preserve the raw-example
   arm, anonymous candidates, movie/TV holdouts and both candidate orders. It
   directly targets the observed order instability/token cost; selecting too
   aggressively can lose rare useful evidence. Placement agreement is not accuracy.

## PR and release

GitHub returned no open PRs on 2026-09-19; none was available to randomly select or
implement. All six workflows for the preceding commit `26eec863` completed
successfully. This change updates Unreleased only and creates no release/version/tag.
