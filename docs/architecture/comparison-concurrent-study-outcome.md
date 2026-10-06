# Concurrent comparison study outcome

Date: 2026-10-06. [Design and official research](comparison-concurrent-study-design.md).

## Implementation

Two explicit isolated scenarios reuse the existing Compose launcher: a comparison
control and comparison with production ingestion/metadata services. Small ESM
modules own load generation, shared-admission observation, receipt validation and
orchestration. Production memory safeguards and refresh behavior are unchanged.
The same image runs sequentially; no production data or external provider is used.

The ownership audit initially rejected three changed launcher hashes. Each complete
file, its new callees, fixed modes, environment guards, fresh database checks and
random-project cleanup were reviewed. Only those three review entries changed;
unresolved production ownership debt remains unresolved.

## Verification and measurements

- Focused admission/study checks: 11 suites / 345 tests passed.
- Final broader script and refresh regressions, including sanitized failure traces:
  157 suites / 2179 tests passed.
- Toolchain policy: 40 tests passed, including restored Node-major alignment.
- Server lint, typecheck, normal/production dependency checks, copyright and the
  reviewed ownership audit passed. No thresholds or test assertions were relaxed.
- Markdown lint: 1950 files, zero errors. Static ESM import and whitespace checks
  passed. Full application coverage was not rerun for this diagnostic-only change.

No lower memory peak, leak fix or release-capacity claim is made from harness tests.

The first image trial exposed a fixture omission: metadata tasks completed, but
OMDb enrichment was correctly skipped because no active synthetic provider was
configured. The incomplete trial was stopped, not counted as a measurement. The
fixture now seeds that configuration behind the existing isolated-environment
guard, with a regression assertion. The completion requirement remains unchanged.

## Image execution

The corrected image was built without cache from clean source
`a65e2eb91c43dc1d11e402c3c1c9b5d94c5e6db1`:

- Image/index: `sha256:7453a0a6d0d1a9640fd858b42146ea89b1aa4ca56b2332101ab7fba65fd46c02`.
- Native manifest: `sha256:d4f00cbaa788d6b79cac7fb1932e02a0dfebab6758e9d98bb7d816458c970cbc`.
- Config: `sha256:ec99f3a5d84728b7530675e593c75d4ce657b8666a0a78c844595e0fb31a9888`.

The first corrected loaded run failed the final comparison-readiness assertion.
Read-only observations confirmed 1600 items with both metadata stages complete,
no pending/processing/failed tasks, and zero cgroup memory-limit hits. Docker's
cache-adjusted display fell from about 1.04 GiB to 343 MiB during the idle tail;
that is not the raw cgroup measure. Owned resources were cleaned. This failed run
is not a completed capacity result, and its final aggregate receipt was not saved.
A repeat preserves the existing aggregate progress trace even on failure; the
same immutable image then runs the unloaded control separately. Assertions remain
unchanged. No concurrent agent-launched builds or test suites run during measurement.

## Loaded repeat: observed failure, not a passing capacity result

The repeat reproduced the final readiness failure. Its phase trace shows:

1. Cold comparison build: `ready`; both fitting workers exited.
2. Five-minute refresh: representative and comparison work deferred as `busy`
   while ingestion was active.
3. Changed-source refresh: both deferred as `memory_pressure`, after metadata
   had caught up. Main heap was about 203 MiB, process RSS about 823 MiB, and raw
   container usage about 1090 MiB. No fitting worker remained active.

The unchanged 2 GiB admission policy needs 256 MiB reserve plus 768 MiB starting
headroom before discovery, before any other active reservations. The observed
container footprint leaves less than that 1 GiB allowance. This reproduces a
deferral mechanism, not a leak verdict or proof of the original installation's
complete allocation history. The private comparison PostgreSQL cluster also
contributes to this fixture's cgroup use; it is not an exact live deployment.

Sampled peaks: process RSS 828.69 MiB, raw container 1127.33 MiB, main heap
677.64 MiB. Kernel high-water was 1133.30 MiB. Two workers were created and exited,
zero remained, and all sampled limit/OOM counters were zero. All 1600 unique items
completed both metadata stages, with no pending/processing/failed tasks at the
bounded read-only checks. This does not substitute for the rejected final receipt.

At the first post-stop checkpoint, all tracked snapshots, source vectors, community
row containers/vectors and comparison handles had already become unreachable:
heap 50.68 MiB, RSS 822.88 MiB, raw container 1101.40 MiB. At the end of the natural
five-minute tail, heap was 38.85 MiB, RSS 129.38 MiB and raw container 373.02 MiB.
RSS fell sharply about three minutes into that tail. Thus the tracked objects and
workers did not remain leaked, while resident pages outlasted their useful lifetime.
The experiment does not isolate native allocator versus V8 page-retention causes.

The refresher is deliberately stopped before this tail; recovery after memory
returns is **not** proven by these observations. No forced GC, inspector,
restart or weakened admission threshold was used. The repeat trace is private
ignored aggregate JSON (SHA-256
`6b564d08b9274836eaff09f353d7a318906dcaa73f129ba5ade0985ef3005566`).

This failure exposed a host-launcher gap: progress checkpoints were discarded when
the final assertion failed. A small ESM projection now saves bounded allowlisted
numeric/status checkpoints on success or failure. It never saves raw log messages,
provider bodies or unknown fields, and it leaves assertion failure and cleanup
intact. This host-only observation improvement was added after the measured image;
comparison, ingestion, queue and admission code are unchanged by it.

## Unloaded control

The same-image control also failed final comparison readiness. It built once,
revalidated successfully after five minutes, then published the changed
representative profile but deferred comparison as `memory_pressure`. Ten snapshot
reads and three created/exited fitting workers were observed; none remained active.
No ingestion load ran. Peak RSS was 844.61 MiB, raw container 1068.01 MiB and kernel
high-water 1073.36 MiB, with no limit/OOM events. During its five-minute stopped tail,
heap fell from 548.20 to 37.06 MiB, RSS from 844.36 to 127.17 MiB and raw container
from 1067.88 to 327.88 MiB. Every tracked reference was collected by the final
checkpoint. Control trace SHA-256:
`82111ba5f1adecdea84752f51fbdb844766aab231b1e008493f461b9a84c86d1`.

Thus ingestion is not necessary for the reproduced final deferral. In this control,
the representative refresh's allocations precede the comparison admission check.
Resident memory and the shared cgroup footprint can remain high after fitting
workers exit and after useful heap data shrinks. The original warning's immediate
mechanism is reproduced, but its exact historical allocation source is not proven.
Both scenarios remain **failed readiness observations**, not passing capacity or
release evidence. One unloaded control and two loaded observations are not a
statistical performance comparison. Host background processes were not stopped,
so elapsed durations are not latency benchmarks. All owned study resources cleaned.

## Recommendation stack

1. Keep the existing memory headroom, reservations and safe ordinary-retrieval
   fallback. Benefit: the guard prevented starting more work without its budget.
   Cost: optional comparison can wait even when JavaScript heap alone looks small.
2. Next, prove natural scheduler recovery after this measured pressure clears,
   without stopping the refresher, changing clocks or forcing GC. Capture exact
   available/reserved/required admission bytes alongside attempts. Benefit: tests
   whether operators recover without intervention; cost: a longer bounded study
   and preferably one shared application catalog/database, removing the private
   comparison cluster's extra footprint. This is the recommended next item.
3. Only then choose an allocation change, such as packed transferable worker input,
   from measured phase costs. Potential benefit: fewer clones/resident pages;
   cost: transfer ownership, cancellation and exact-number compatibility work.
   Do not lower safeguards, add periodic restarts or force GC to make a test pass.

The freshly selected [PR #555 trial](node-types-pr555-outcome.md) failed the Node-major
alignment gate and was reverted without installation or merge. No dependency change
is retained.
