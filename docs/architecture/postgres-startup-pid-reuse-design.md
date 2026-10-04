# PostgreSQL startup and helper-thread PID reuse

Date: 2026-10-04. Scope: Linux embedded database bootstrap; no live recovery.

## Reproduced failure

An isolated, seeded historical-source image passed ordinary restarts but failed
with 0.5 CPU and 100 ms startup health checks. PostgreSQL's old PID was 157; the
new postmaster was 156. A second diagnostic-only replay inspected the collision:
PID 157 was `libuv-worker`, with thread-group ID 143, matching the startup helper's
own PID. PostgreSQL exited 1 because its native PID lock check saw that thread.
The original CI failure lacks this evidence, so attribution to that historical
run remains unproven. See the separate outcome for image identities and results.

Node's first asynchronous filesystem operation creates libuv workers. Currently
that happens in the readiness probe, after launching PostgreSQL. Timing changes
can therefore reuse the old database PID for a helper thread. A container restart
resets its PID namespace, making such collisions realistic.

## Narrow recovery contract

Perform one bounded asynchronous preflight before the existing single launch.
Reading the PID file initializes the helper's I/O pool before PostgreSQL starts.
If a well-formed PID file for the fixed data directory identifies an existing
`libuv-worker` under `/proc/self/task`, require its numeric PID and thread-group
ID to match that worker and this helper, then read back the unchanged PID file.
Only this verified, process-lifetime worker may be supplied as PostgreSQL's
`PG_GRANDPARENT_PID` exception. This extends the native ancestor exclusion to a
thread of the actual parent; it does not authorize a foreign process exception.

Discard inherited `PG_GRANDPARENT_PID`: deployment configuration must not inject
an unverified exception. PostgreSQL still performs native lock-file creation,
shared-memory checks and recovery. Classifarr never removes or rewrites its lock.

- Fresh/clean installations: no collision, no recovery log or additional service.
- Unknown, missing or inaccessible thread evidence: no exception; PostgreSQL
  decides whether its native lock can be reclaimed. Do not guess from age/name.
- Other processes, other Node processes, transient non-libuv threads, and live
  PostgreSQL servers: never exempted.
- Changed PID file: fail closed before launch, without modifying it.
- Cancellation/timeout: preflight shares the existing absolute startup budget;
  a late filesystem completion cannot launch a process. Existing child-only
  shutdown and join remain unchanged.
- Reads: fixed data path, 2048-byte PID-file cap, 4096-byte kernel-status cap,
  one possible thread lookup and one identity readback; no directory enumeration.
- No retries, stored cooldowns, schema changes, HTTP calls, privilege escalation,
  new capabilities, template changes or production/Unraid operations.
- Log one fixed `parent_thread_pid_reused` event only when proof is obtained;
  do not log native PIDs, file contents or user configuration in shared receipts.

The helper is a short-lived dedicated process that does not create application
worker threads or shut down libuv while PostgreSQL starts. libuv's global pool
workers persist until process cleanup. This lifetime property is necessary: do
not generalize the exemption to arbitrary threads or command-name comparisons.

## Recommendations and tradeoffs

| Option | Benefit | Limitation / risk | Recommendation |
| --- | --- | --- | --- |
| Retry or add sleeps | May avoid one race | No proof or durable fix | Reject |
| Delete PID files or trust their age | Simple | Can admit competing database writers | Reject |
| Verify this helper's persistent worker only | Fixes reproduced collision without extra privileges | Linux/libuv-specific; foreign collisions still fail safely | Implement |
| Arbitrary process-name/start-time takeover | Broader recovery | More identity and lifetime races | Defer |
| External PostgreSQL or new PID namespace | Stronger separation | Deployment changes or capabilities | Separate architectural decision |

Recommended stack: bounded preflight → exact parent-worker proof → native
PostgreSQL interlock → unchanged readiness and cancellation → sanitized exit
evidence → isolated regression and restart tests. This concerns an OS process,
not media-import ownership. Separate databases sharing Plex do not share import
leases; legacy import recovery remains a separate reviewed operation.

## Research and validation

Official sources discovered and opened on 2026-10-04:

- [PostgreSQL 18 interlock implementation](https://github.com/postgres/postgres/blob/REL_18_STABLE/src/backend/utils/init/miscinit.c)
  documents native parent/grandparent exclusions, atomic lock creation and
  competing-process checks. The deployed 18.6 binary is tested separately.
- [PostgreSQL 18 startup](https://www.postgresql.org/docs/18/server-start.html)
  explains the native PID interlock and diagnosis from server logs.
- [Node 24 filesystem promises](https://nodejs.org/download/release/v24.20.0/docs/api/fs.html)
  explains asynchronous filesystem work on the I/O thread pool.
- [libuv thread-pool documentation](https://docs.libuv.org/en/v1.x/threadpool.html)
  describes global initialization and the `libuv-worker` name.
- [libuv pool implementation](https://github.com/libuv/libuv/blob/v1.x/src/threadpool.c)
  shows workers exiting during pool cleanup, not after individual file requests.
- [Linux task directories](https://man7.org/linux/man-pages/man5/proc_tid.5.html)
  documents per-process thread membership. Name alone is not proof.
- [Patroni process implementation](https://github.com/patroni/patroni/blob/v4.1.5/patroni/postgresql/postmaster.py)
  uses a verified PID exception and warns against unlink races. We intentionally
  do not adopt its broader process-start-time policy.

Require deterministic real-PostgreSQL tests for own-worker recovery and continued
refusal of a live competitor. Preserve committed data and fsync. Test malformed,
foreign, missing and changed identities; cancellation/timeout before launch;
inherited exception removal; native exit evidence; real image crash/restart and
local no-cache rebuild. Record limits separately instead of treating repeated
successful timing tests as complete proof.
