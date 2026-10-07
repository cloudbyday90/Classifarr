# Cold comparison allocation investigation

Date: 2026-10-07. Follow-up to the
[warm preparation outcome](representative-warm-preparation-outcome.md).

## Decision and scope

The largest prior main-heap sample was labeled `recovery_community`, but a label
is not an allocation stack or proof of a leak. Profile unchanged cold builds on
identical synthetic inputs before selecting another runtime optimization.

Extend the existing isolated memory study, not the web server. Reuse its private
PostgreSQL fixture, real repository, source ownership, fitter and community code.
Run three cold builds of the same 5,776-description, 1,024-dimension corpus. Require
identical source fingerprints and summaries, successful local discovery and all
workers exited. Discard each handle before the next build. This intentionally
tests cold construction, not a production scheduler/cooldown or warm-cache cycle.

## Research and interpretation

Official sources discovered and read on October 7, 2026:

- [Node inspector](https://nodejs.org/download/release/v24.15.0/docs/api/inspector.html):
  an in-process Session can dispatch inspector protocol messages without opening
  a remotely accessible debugging endpoint. Test protocol support on deployed Node 24.
- [HeapProfiler protocol](https://chromedevtools.github.io/devtools-protocol/tot/HeapProfiler/):
  sampling normally reports objects still alive when queried; including objects
  collected by minor/major GC instead measures allocation activity. These are
  separate runs, not interchangeable measurements or exact retained-object graphs.
- [Node memory accounting](https://nodejs.org/download/release/v24.20.0/docs/api/process.html):
  RSS covers the process, heap fields cover the current thread, and array buffers
  are included in external memory. Do not sum overlapping fields or independent peaks.
- [Node heap snapshot guidance](https://github.com/nodejs/learn/blob/main/pages/diagnostics/memory/using-heap-snapshot.md):
  snapshots pause work and can increase memory pressure. Avoid live snapshots here.

## Safety and contracts

Only Linux with the explicit synthetic-study flag and enforced existing 2 GiB,
two-CPU, 128-PID budget may run this mode. Use no network, ports or appdata mounts;
the fixture starts its own socket-only PostgreSQL. Cap the build sequence at ten
minutes through abort-aware build/read paths; allow eleven minutes including setup
in the outer runner.
No HTTP, provider inference, routing, migrations of live data or recovery actions.

Use a fresh in-process sampler per cycle, with a fixed 512 KiB interval. Emit
only allowlisted component labels and numeric aggregates: never raw allocation
trees, filesystem paths, function names, descriptions, hashes, vectors or secrets.
Bound profile traversal and reject invalid/deep/oversized data with fixed errors.
Disconnect on success, work failure, protocol failure and reduction failure.
Never request collection or change V8/admission settings. A natural, unsampled
control uses the same corpus and code. Sampling affects timing and GC; do not
treat its overhead or sampled byte estimates as precise retained memory.
Sampling starts after each source read: source vectors and worker-isolate allocations
are outside that profile. Existing worker, process and raw-container observations
cover their separate memory domains. Attribution assigns each sampled self-byte
estimate once to the nearest recognized component in its stack, or `other`.

No production entry point imports the profiler. Existing publication revision,
configuration, freshness, ownership, cancellation and admission checks are untouched.
No persistent job, retries or state: interruption fails the diagnostic, closes
the fixture and removes only its owned disposable container. Rerun from scratch.

## Alternatives and recommendation stack

1. **Aggregate sampling plus a matched natural control (chosen):** useful attribution
   without a live heap dump; statistical, main-thread-only, with observer overhead.
2. **Immediately remove vector/proposal storage:** potentially cheaper builds, but
   risks changing numeric behavior or targeting the wrong allocation. Defer pending evidence.
3. **Live heap snapshots or raised limits:** stronger retainer detail or more headroom,
   but private data, pauses and OOM risk; neither is needed for this investigation.

Regression tests cover attribution, redaction, bounds and session cleanup before
implementation. Run focused/full backend checks, a clean no-cache image build,
isolated schema dump/check, matched cold profiles and local test-container health.
Record actual findings, limitations, PR trial and the next runtime candidate in a
separate outcome document. No release, dependency-major migration or safeguard change.
