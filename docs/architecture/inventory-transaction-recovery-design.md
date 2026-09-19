# Inventory transaction recovery design

Date: 2026-09-19

## Evidence and scope

The previous guarded AI comparison was interrupted when the application logged
an idle-in-transaction timeout, rollback failure and uncaught connection error.
The exact reader was not retained in that log. Inspection confirms two hazards:
checked-out clients lack an error listener, and live inventory calibration fits
run inside a read transaction with a 20-second idle deadline.

This component contains database-wrapper connection failures and shortens the
live, representative-profile and benchmark snapshot lifetimes. It does not alter
classification, automatic-routing authority, timeout settings or model settings.

## Design

- Give each wrapper-owned checked-out client an operation-scoped error listener.
  Remember the first connection failure, reject success/commit after failure,
  and destroy the broken connection on release. Keep the listener until the pool
  takes ownership again. Preserve the original callback error when rollback or
  advisory-lock cleanup fails.
- Do not replay queries or transactions. A failed commit can have an uncertain
  outcome; only existing connection acquisition retries remain automatic.
- Do not race a still-running callback against connection failure and return its
  client to the pool. The callback retains ownership until it settles. Expose a
  cooperative abort signal for callers that can cancel non-database work.
- Retain session-lock ownership in async-local scope. Reject subsequent wrapper
  queries and transaction commits after an enclosing lock fails or its callback
  ends. Pass lock cancellation into inventory refresh/retrieval inference. This
  is cooperative containment, not distributed fencing: already-issued queries,
  raw pool clients and external side effects cannot be recalled by this guard.
- Preserve one repeatable-read, read-only snapshot for source rows and required
  cached vectors. Keep the bounded content projection needed to identify vector
  keys inside that snapshot; move vector decoding, metadata aggregation, fitting,
  assessment and optional context work after commit.
- Split calibration preparation from assessment using private data packets, not
  closures holding database clients. Preserve exclusions, limits, cache keys,
  current source checks and ordinary raw-description fallback.
- Log fixed operation names and allowlisted error codes, not SQL parameters,
  descriptions, credentials, endpoints or arbitrary driver messages. Do not write
  failure diagnostics back into the database that is failing.

## Official sources reviewed

- [node-postgres client events](https://node-postgres.com/apis/client): an idle
  connection can emit an error outside a pending query promise.
- [node-postgres pooling](https://node-postgres.com/apis/pool): pool error events
  cover idle pooled clients; releasing with a truthy destroy argument removes a
  broken client. Always release acquired clients and keep transaction queries on
  the same client.
- [PostgreSQL 17 connection defaults](https://www.postgresql.org/docs/17/runtime-config-client.html):
  idle-in-transaction timeout terminates the session. Extending that limit would
  conceal the transaction-lifetime issue rather than contain it.
- [Node.js error behavior](https://nodejs.org/api/errors.html): an unhandled
  EventEmitter error can become an uncaught exception. A surrounding async
  try/catch alone is not a substitute for an event listener.
- [Node.js async context](https://nodejs.org/download/release/v24.0.1/docs/api/async_context.html):
  `AsyncLocalStorage.run` propagates ownership through callback promise chains
  without imposing that ownership on unrelated requests.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages):
  communicate meaningful status without stealing focus. This backend recovery
  change adds no user acknowledgements, controls or repeated UI notifications.

## Alternatives and recommendation stack

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Increase database timeouts | Small change | Leaves crash path and long transactions | Reject |
| Retry every failed transaction | Appears self-healing | Can duplicate writes after uncertain commit | Reject |
| Separate database snapshots | Shorter holds | Weakens source/vector consistency unless revalidated | Not needed here |
| Scoped client ownership plus post-commit computation | Preserves consistency, contains failure, no new dependency | Requires explicit preparation/assessment boundaries | Implement |

Use the existing pg pool, small ESM client-lease/transaction/lock-scope utilities,
existing read-only repositories, two-stage calibration services and the existing
SWR scheduler. The dedicated policy-evaluation pool shares the transaction runner;
its configuration/policy capture stays atomic and its fingerprint runs after commit.
Successful later scheduler ticks may rebuild context; incomplete work never
becomes a successful classification or a cached completed result.

## Verification

Exercise checked-out error events before/after queries, repeated events, failed
rollback/commit, exactly-once release, no callback replay and fresh-client recovery.
Use isolated real PostgreSQL transactions with a short local idle deadline; never
terminate the application's live connections. Assert fitting/context/vector
decoding happens after transaction completion and keep existing evidence results
unchanged. Then run regressions, coverage, Compose checks and the frozen paired
comparison if resource and application health permit.
