# Inventory benchmark isolation and bounded admission

## Problem and evidence

On September 20, 2026, the warmed local app used approximately 1.286 GiB of its
2 GiB container limit. A benchmark started through `docker exec` shares that
cgroup: measured available memory was 754,561,024 bytes, below the existing
1 GiB startup requirement. The deferral was correct. Restarting the app briefly
provided headroom but is not a sustainable evaluation workflow. This evidence
establishes resource contention, not a memory leak.

## Decision

Use an opt-in, disposable Compose benchmark container with its own 2 GiB memory
limit and CPU/process limits. Pin it to the running app's immutable image ID;
never build, pull, recreate, restart, or resize the app from this launcher.
Share only the app network namespace to reach the embedded loopback PostgreSQL
server. Do not mount app data, publish ports, or run the application entrypoint.
Use a non-root user, read-only filesystem, dropped capabilities, and read-only
database sessions. These database defaults are accident prevention, not a
replacement for a database account with restricted privileges.
Shared configuration initialization receives a fresh throwaway encryption key;
the local-only evaluator does not decrypt integration credentials or create
encrypted records. No live encryption key is mounted or copied.

Preserve the shared database discovery lock and all existing memory thresholds.
Wait for admission for at most five minutes, within the overall benchmark
deadline, with cancellable exponential backoff and jitter. Retry only a deferred
admission before its callback starts. Never replay inference or partial work.
The direct CLI retains its existing immediate-deferral default unless waiting
is explicitly requested. Live SWR schedulers retain their existing behavior.

Separate responsibilities into argument/preflight planning, owned-container
lifecycle, Docker transport, and the reusable admission-wait service. Validate
arguments before starting a container. Require 3 GiB free in the Docker host
(2 GiB job plus 1 GiB reserve); this is a point-in-time check, not a reservation.
Concurrent platform work can still trigger legitimate deferral.

## Lifecycle and recovery

Create one UUID-named and ownership-labelled container detached. Cancellation
during startup is remembered and applied when startup settles. Follow its logs,
wait for its exit, and always remove only the owned container, including after
startup failure. Bound runtime outside the container as well as inside it.
Report cleanup failure explicitly; do not claim success with an orphaned job.
An unavailable Docker daemon or a forcibly killed launcher still requires an
operator to inspect the named leftover container after Docker recovers.

## Tradeoffs and verification

- Isolation preserves live-app memory headroom, at the cost of additional host
  RAM. It does not isolate shared database I/O or the configured local AI server.
- Waiting handles temporary contention without manual restarts; it cannot make
  permanent low-memory conditions safe, and does not promise FIFO fairness.
- The local embedded-database network arrangement is supported here, not every
  external database/custom Compose deployment.
- Source revision checks still invalidate a run if metadata changes. Isolation
  must not convert a changing-source result into an accepted benchmark.

Test admission recovery, expiry, cancellation, no partial replay, startup races,
Docker failures, cleanup ownership, app health and unchanged app restart count.
Record measured results separately in the outcome document.

## Official-source basis

[Docker Compose service configuration](https://docs.docker.com/reference/compose-file/services/)
defines service network namespaces, resource limits, entrypoints, read-only
filesystems, and capability restrictions. [Node timers documentation](https://github.com/nodejs/node/blob/main/doc/api/timers.md)
documents cancellable promise-based timers. [W3C status-message guidance](https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html)
supports concise progress rather than repeated alerts; this change adds bounded
CLI progress only and no new mandatory UI acknowledgement.
