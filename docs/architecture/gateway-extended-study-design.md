# Gateway extended load and rotation study design

## Agreed scope

On 18 October 2026 the user selected a 30-minute normal-cadence local load test
plus a separately identified controlled rotation drill. Work on main, no release.
Keep Unraid, Plex, shared Ollama, production settings, limits and retry rules
unchanged. No new database tables or persistent identities are needed; existing
UUIDv7 ledger/job identities remain required. No new admin controls or purge
authority are introduced.

First repair the previous CI failure: re-review the v7 restore boundary and its
new admission helper, then update only justified ownership-review records. Do not
regenerate the baseline or convert unresolved debt into runtime authorization.

## Research and alternatives

Official sources discovered through MCP search/navigation and opened on
18 October 2026:

- [Grafana soak testing](https://grafana.com/docs/k6/latest/testing-guides/test-types/soak-testing/)
  distinguishes prolonged stability/resource observations from short load tests;
  full endurance studies generally run for hours or days. Thirty minutes is a
  bounded diagnostic step, not leak-freedom certification.
- [Open arrival models](https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/open-vs-closed/)
  and [dropped iterations](https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/dropped-iterations/)
  motivate preserving offered load and accounting for missed arrivals rather
  than silently slowing traffic or issuing catch-up bursts. Reuse our ESM driver;
  do not add a load-test dependency.
- [PostgreSQL 18 TOAST](https://www.postgresql.org/docs/18/storage-toast.html)
  describes compressed/out-of-line storage. The packaged dump already specifies
  `--compress=0`: varied deterministic padding tests source/restore storage and
  cache behavior, not a new archive compression setting. Measure physical,
  logical and dump sizes independently.
- [Linux memory accounting](https://www.kernel.org/doc/html/v5.14/admin-guide/cgroup-v1/memory.html)
  distinguishes charged cache and resident memory; cgroup usage is not a heap
  leak measurement. [PSI](https://docs.kernel.org/accounting/psi.html) measures
  resource stalls where available. Missing kernel interfaces remain unavailable,
  not zero; v1/v2 accounting is reported explicitly.

| Option | Benefit | Cost / limitation |
| --- | --- | --- |
| Longer run only | Repeated real assessments, no timing shortcut | Initial two copies do not prove daily replacement/retirement |
| Accelerate production policy | Frequent cycles quickly | Changes the behavior being evaluated; rejected |
| Thirty-minute load plus separate controlled rotation | Bounded resource study and real replacement evidence | Controlled scheduling observations do not prove elapsed daily cadence |
| Multi-day natural-cadence study | Can observe true daily replacement | Much longer shared-host occupation; deferred |

Select the third option. Keep the existing eight-minute regression profile intact.

## Load profile and isolation

Use a fixed allowlisted `extended` fixture profile: 60 seconds before, 1,680
seconds with archive/verifier loops, 60 seconds after, then 60 seconds truly idle
for settled memory observations. Keep two foreground arrivals per two seconds,
50 ms offset, one background arrival every fifth pair, 650 ms synthetic service,
four client slots, 500 ms lateness cutoff and no retries. Expect 1,800 successful
foreground requests and 180 busy background responses. Bound plans, observations,
worker output and every timeout from the same immutable profile.

Seed 3,000 failed historical jobs with equal-length deterministic varied padding.
Do not fabricate successful receipts. Report logical JSON bytes and actual
main/TOAST/index/total relation sizes, then record each real dump size. Preserve a
full canonical digest of failed history across load, and exact historical row
comparisons across rotation. No cache flush,
counter reset, clock change or resource-limit increase is allowed.

Retain disposable labeled databases/volumes only, no host ports or network,
read-only worker roots, dropped capabilities and no-new-privileges. Source:
2 GiB/2 CPU/512 PIDs; archiver: 256 MiB/0.5 CPU/32 PIDs; verifier: 1.5 GiB/1 CPU/64
PIDs. Only the archiver receives its restricted source socket/configuration; the
verifier cannot access live SQL, provider credentials or Docker. No real model is
called. Normal local Compose is backed up/refreshed only after exact-image checks.

## Bounded observations and pass conditions

Sample at one-second intervals with bounded minute bins and coverage/gap/observer
cost reporting. Separate current cgroup charge, anonymous/file cache, worker and
observer process memory, lifetime peaks, CPU throttling and I/O where available.
Reuse fenced PID/start-time checks. Read filtered source transaction activity
through a separate read-only fixture connection; never expose SQL text or use
observations for admission. Record observed transaction ages, not exact unobserved
start/end duration. Unsupported metrics remain explicitly unavailable.

Require expected HTTP/provider/binding/receipt counts, unique fingerprints and
UUIDv7 IDs, no dropped arrivals or worker failure, real export/restore overlap,
two accepted verified roots, unchanged failed-history digest, zero cleanup
operations and matching attempt/cooldown state. Record settled idle separately
from the after phase, which still contains requests. Memory samples do not justify
a universal leak verdict or a claim that cached pages must immediately disappear.

On cancellation, timeout, event-counter increase, invalid/missing mandatory
evidence or insufficient storage, fail nonzero and stop only owned fixture
processes. Never reset persistent attempts, replay unknown work or auto-rerun a
failed study. Verify cleanup even after failure; unresolved cleanup is not a pass.

## Controlled rotation lane

Extend the existing catalog scheduling fixture, using real packaged capture,
isolated restores, registration and retention. Admit new synthetic ledger history
between replacement pairs. Observe production `catalogDue` with an explicitly
future fixture scheduling observation; do not edit clocks, production constants,
durable deadlines, immutable rows or attempts. New captures use a real live frozen
snapshot context and current SQL guards.

Exercise multiple verified replacement pairs. Prove exactly two retained roots,
durable retired history, removal of obsolete fixed files only after verified
replacements, released old pins, preservation of still-required dependencies and
unchanged historical evidence/counters. Keep this output separate from natural
cadence timing/latency results. It is not a live purge or multi-day scheduling test.

## Verification and final recommendation stack

Test fixed profile bounds, accounting, malformed evidence, missing optional
metrics, sampling caps/gaps, deterministic padding and cleanup rejection paths.
Run ownership review/preflight, relevant unit/SQL tests and exact no-cache image
rehearsals before the heavy study. Do not run heavy builds/tests concurrently with
the measured load. Keep measured outcome and limitations in a separate document.

Stack: smoke/regression checks → normal-cadence varied-history load → bounded
resource/transaction observations → isolated restore verification → separately
controlled repeated rotation → owned cleanup. Only then decide whether duplicate
fingerprint passes can safely share evidence inside one live snapshot. Global
cross-run trust caching, production tuning and real-provider capacity are deferred.
