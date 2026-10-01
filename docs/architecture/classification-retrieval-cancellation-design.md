# Classification retrieval cancellation design

## Problem and scope

The [retrieval maintenance study](classification-retrieval-maintenance-outcome.md)
identified a missing handoff: classification supplied an AbortSignal to semantic
retrieval, but the SQL executor did not receive it. A caller timeout could therefore
leave PostgreSQL working and the retrieval layer could subsequently log success.
This change addresses that database boundary, not every provider or search branch.

## Research and decision

Official URLs were discovered through web search on 1 October 2026. The requested
September 2026 baseline uses established PostgreSQL/Node APIs; these are current
documentation pages, not verified archived September snapshots. Installed `pg`
8.23.0 source inspection confirms its query API has no AbortSignal handling.

- PostgreSQL cancellation is a request, not a completion acknowledgement. The
  original query still has to finish or fail. This rules out treating a successful
  cancel request as successful retrieval. [PostgreSQL protocol](https://www.postgresql.org/docs/18/protocol-flow.html).
- An ordinary role can cancel its own sessions; elevated signal privileges are
  unnecessary here. Only the checked-out backend and its exact start timestamp may
  be targeted. [Server signaling functions](https://www.postgresql.org/docs/18/functions-admin.html).
- A transaction-local statement timeout bounds SQL if the control connection cannot
  reach the server. Shorter existing settings must remain effective; no global
  timeout is raised. [Client connection defaults](https://www.postgresql.org/docs/18/runtime-config-client.html).
- Pool clients must be released; destructive release prevents reuse of an uncertain
  session. A cancellation connection must not queue behind the saturated work pool.
  [node-postgres pool API](https://node-postgres.com/apis/pool).
- Abort listeners are one-shot and removed after completion to avoid retained work.
  [Node AbortSignal guidance](https://nodejs.org/docs/latest/api/globals.html).
- W3C distinguishes waiting, results and errors in accessible status messages.
  Cancellation must not be presented as success or an empty successful result.
  This backend-only change introduces no visual control and makes no WCAG compliance
  claim. [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages).

## Recommendation stack and tradeoffs

| Option | Benefit | Cost / limitation | Decision |
| --- | --- | --- | --- |
| Promise timeout alone | Small caller-side change | SQL keeps running; late results remain possible | Reject |
| Destroy socket alone | No extra connection | A remote server may not promptly notice a disconnect | Insufficient alone |
| Driver-private protocol cancellation | Lightweight server signal | Couples application to undocumented driver internals | Avoid |
| Read-only session + bounded same-role cancellation + local deadline | Stops active work without borrowing another worker slot or expanding privileges | Two transient control slots; failed/burst cancellation relies on server timeout | Adopt |
| General cancellation for all write transactions | Wider coverage | Commit ambiguity and side effects require separate semantics | Out of scope |

## Implementation contract

1. Only a transaction explicitly marked `readOnly: true` may use cancellation.
   Existing unsigned transactions follow the unchanged runner. This is an internal
   option, not a public endpoint accepting backend IDs or SQL.
2. The new small ESM read runner owns checkout, `BEGIN READ ONLY`, local deadline,
   identity capture, guarded queries, commit and release. It does not replay SQL.
3. SQL-phase wall time is capped at 15 seconds, including pool wait. Callers may
   shorten but not enlarge that bound. Local statement time is set from the remaining
   budget and never exceeds a shorter pre-existing timeout. It is a per-statement
   fallback, not an exact whole-transaction server deadline. Statements already in
   flight can outlive caller cancellation when the control transport is unavailable.
4. Pool acquisition itself cannot be removed from the driver's queue. Abort returns
   promptly; any later connection grant is returned without starting SQL. Existing
   connection-acquisition timeout still bounds the driver's wait.
5. At most two short-lived control clients per database module are created, only
   after cancellation with a captured identity. There is no control queue, daemon
   or idle polling loop. Connect/statement limits are 500 ms, driver query timeout
   750 ms, and caller cleanup deadline 1,500 ms. Admission remains charged until
   the control client actually closes, even after that deadline.
   They use the original pool configuration captured at module construction, not
   environment values that might change during the request.
6. Cancellation SQL binds PID and the exact timestamp returned by PostgreSQL (not
   a millisecond-rounded JavaScript Date), plus current database and user. The target
   stays checked out while control work is attempted. Aborted/error connections are
   destroyed, never rolled back and returned for another borrower. No further
   callback statement or late result is accepted after closure.
7. Control unavailability logs only a fixed reason with database persistence disabled.
   Query text, vectors, credentials, backend identity and caller abort reasons are
   excluded. No signal was sent is not reported as successful cancellation.

Normal SQL, image weighting, thresholds, limits and text-first selection remain
unchanged. The built-in timeout also makes cancellation failures explicit rather
than returning an empty result. There is no schema migration, dependency addition,
Unraid template change, Docker socket, new role grant or live deployment update.

## Validation and next boundary

Use the existing unit runner and disposable PostgreSQL integration harness. Observe
active work from an independent connection; verify an unrelated concurrent read,
pool saturation, late grants, failed control transport, read-only enforcement,
settings reset and a production semantic query blocked on its table lock.

Next, propagate cancellation through image-provider admission, retry waits and HTTP
requests. Semantic retrieval currently calls `embedImageFromUrl` without its signal;
its limiter also queues work without cancellation. Keep real image evidence on
successful requests rather than disabling image retrieval to hide abandoned work.

Measured results and delivery status are in the separate
[outcome document](classification-retrieval-cancellation-outcome.md).
