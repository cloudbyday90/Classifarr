# Restore ownership and interrupted-attempt recovery

Date: 2026-09-27. Status: implementation design; full maintenance barrier remains pending.

Follow-on: [dedicated restore operating mode](restore-maintenance-mode-design.md)
now provides restart-based isolation and cooperative normal-runtime admission.
The findings below describe the earlier session-ownership change, not an online drain.

## Finding and scope

The restore lifecycle records a durable `restore_in_progress` gate before replacing
configuration. A process crash can leave that gate indefinitely closed: subsequent
requests cannot tell a dead owner from a slow, live restore. Independent pool
connections also make a lock on one connection insufficient to fence writes on
another connection after ownership is lost.

This change addresses restore ownership, not general database maintenance or a
global writer pause. It preserves the existing authenticated restore endpoint and
requires an explicit restore request to retry; it does not restore automatically
at startup, resume routing, change retention, delete logs, or create a release.

## Design

1. Acquire a non-blocking, database-scoped session advisory lock on a dedicated
   connection. A competing request exits before touching the gate or configuration.
2. Recover only an interrupted gate explicitly marked by this ownership protocol.
   The exclusive lock proves another conforming restore does not own the session.
   Move the old gate to `requires_maintenance`, never directly to `ready`.
3. Start a fresh token-bound attempt. Run its gate writes, configuration transaction,
   verification reads, and completion/receipt transaction on that same connection.
4. Reject queries after the callback closes or the connection is lost. Do not retry
   uncertain writes or commits. Preserve the original error if failure recording
   also fails.
5. Destroy the dedicated connection when the attempt settles, releasing its lock
   without returning a locked session to the pool.

The existing free-form, validated `reason_id` records the internal protocol marker
`restore_session_owned_v1`; public execution eligibility retains the existing
`restore_in_progress` reason. No schema migration or successful API shape changes
are needed. Legacy or unknown ownership markers remain closed: acquiring the new
lock cannot prove that an older implementation is inactive. Mixed-version restore
operations must not run concurrently.

## Alternatives and recommendation stack

| Approach | Benefit | Cost or limitation | Decision |
| --- | --- | --- | --- |
| Time-based gate expiry | Simple retry | Can steal ownership from a slow restore | Reject |
| Separate lock and writer connections | Reuses generic lock runner | Writer transaction can outlive lock session | Reject for restore |
| One pinned owner session | Serializes restores; crash releases lock and rolls back its open transaction | Consumes one connection; does not stop unrelated writers | Implement first |
| Dedicated restore operating mode | Clear startup boundary with no ordinary workers | Requires restart and a changed recovery workflow | Recommend next, pending operating-mode choice |
| In-process writer drain | Retains online restore workflow | Must track every request, detached task, timer and dispatcher | Alternative requiring broader refactor |

The runtime audit found queue work that outlives dequeue calls, Discord handlers,
startup repairs, idle/manual/scheduled backfills, enrichment retry timers, provider
heartbeats, delayed persistence, and request-started background work. Pausing only
the scheduler or awaiting HTTP response completion would not drain these writers.
An advisory lock is cooperative, not a fence around provider network requests.

## Evidence and accessibility

Official sources researched through search/browsing tools on 2026-09-27:

- [PostgreSQL 18 explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html):
  session advisory locks survive transaction rollback and end with their session;
  applications must cooperate. This motivates the same-session owner design, not
  a claim of global exclusion.
- [node-postgres transactions](https://node-postgres.com/features/transactions) and
  [pool client release](https://node-postgres.com/apis/pool): transactions belong to
  one client; `release(true)` removes a checked-out connection. Reusing the same
  client for lock ownership and transactions avoids a second-session ownership gap.
- [Node.js asynchronous context](https://nodejs.org/api/async_context.html):
  `AsyncLocalStorage.run()` scopes descendant asynchronous work. Context propagation
  does not itself enumerate or drain that work; the existing scope utility is not
  a substitute for a writer lifecycle. No newer-than-Node-24 API is introduced.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages):
  a future restore-mode UI should expose progress and results programmatically
  without moving focus. This backend prerequisite adds no UI and makes no new
  accessibility-conformance claim.

## Validation and next acceptance boundary

Use synthetic unit tests and isolated PostgreSQL integration tests for lock
contention, session termination, rollback, explicit retry, legacy-gate refusal,
verification failure and late callback access. Never terminate a live application
connection to test recovery.

Before claiming the full maintenance barrier: select the operating mode, prove no
ordinary writer/dispatcher runs during restoration, test startup and shutdown races,
and rehearse restore/verification/restart against a disposable database. Preserve
the current deployment until that recovery workflow is approved and tested.
