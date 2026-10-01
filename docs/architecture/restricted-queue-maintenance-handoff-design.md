# Restricted queue maintenance handoff design

Date: October 1, 2026. Baseline: `3fe3ece0`.

## Decision

We will implement a fixed-capability request channel between a restricted runtime
and its trusted supervisor. This component covers automatic queue recovery only:
not arbitrary SQL, schema upgrades, restores or index rebuilds. We keep those
offline operations behind their existing stopped-runtime contracts.

I inspected the supervisor, fixed maintenance child, queue admission ledger and
separate-identity rehearsal. Production still uses a shared identity; merely
adding an RPC endpoint would not remove its administrator authority. We will
therefore integrate and exercise the handoff in the genuine restricted-identity
drill, without silently activating an incomplete production identity cutover.
The existing production recovery path remains available and unchanged.

## Options and recommendation

| Option | Benefit | Cost / disposition |
| --- | --- | --- |
| 1. Give the runtime maintenance grants | No extra process or transport | Database permissions cannot express our fixed SQL, deadlines and retry policy; rejected for this boundary |
| 2. Inherited fixed-capability channel | No listener, secret, new container or template setting; selected | Requires trusted supervisor composition and a protected recovery ledger |
| 3. External maintenance service | Separate deployment and failure domain | New authentication, networking and deployment migration; preferable for managed external databases |

I recommend Option 2 for the embedded deployment. We reuse the existing scheduler
and trusted one-shot executor rather than introduce a polling administrator
daemon. The runtime makes read-only observations and may request an assessment;
the worker independently rechecks pressure, ingestion/backfill readiness, locks,
cooldown and attempts. A request is never authorization to force a repair.

## Boundary and lifecycle

The parent creates an inherited duplex descriptor for its direct child. The
protocol is one fixed request byte and fixed result bytes: no JSON parser,
caller-supplied SQL, database, path, identity, environment or options. Possession
of this inherited descriptor is the capability. No TCP/HTTP or named socket is
opened. The runtime cannot choose another operation. Unknown, oversized,
concurrent or excessive requests close the capability instead of queueing work.
The holder can explicitly delegate its descriptor to a descendant; fixed scope
and independently protected admission provide containment, not an undelegable
process-identity token.

Both sides permit one in-flight request and enforce a five-minute request floor.
There is no automatic transport retry. The supervisor starts at most one fixed
maintenance child, constructed with the existing minimal environment and separate
database OS identity. It bounds execution and joins TERM/KILL cancellation before
allowing database shutdown; unconfirmed child exit is a failure, not completion.
The child keeps the existing sixty-second SQL-session budget and six-hour/three-
attempt repair policy. V8 caps are not total-RSS or CPU limits.

The runtime does not write the recovery ledger on this path. The worker verifies
that the fixed runtime role cannot modify that ledger before acting; the drill
revokes those writes after its general application grants. Losing the channel
does not fall back to administrator reconnection or expose maintenance secrets.
Healthy/fresh state requires no maintenance process; outstanding observations
can request reconciliation when pressure clears. Durable state remains the restart
authority; in-flight transport responses are not a durable job queue.

## Research and accessibility

Official URLs were discovered with online tools and reviewed October 1 using the
September PostgreSQL 18 / Node 24 baseline. Live documents are not archived
September snapshots.

- [PostgreSQL predefined roles](https://www.postgresql.org/docs/18/predefined-roles.html)
  grant broad operation sets; we do not give `pg_maintain` to the runtime.
- [Peer authentication](https://www.postgresql.org/docs/18/auth-peer.html)
  binds local database identity to the OS identity; a renamed SQL login under
  shared trust authentication is not equivalent separation.
- [Node child processes](https://nodejs.org/docs/latest-v24.x/api/child_process.html)
  support inherited descriptors and direct execution; signal delivery alone is
  not proof of child termination. Stream capacity and exit/close must be handled.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages)
  inform the fixed textual completed/deferred/unavailable statuses. This backend
  work does not introduce a UI or claim new WCAG conformance.

## Validation, rollout and rollback

We will test malformed/flooded requests, single-flight behavior, backpressure,
timeouts, disconnects, child failures, shutdown races, unchanged legacy behavior,
read-only runtime observation and protected ledger enforcement. The disposable
Linux drill must prove real separate-identity requests, direct administrator
reconnect denial, bounded automatic maintenance and retained synthetic data.
No live restart, release, template edit, credential change or identity migration
is authorized by this component's tests.

The principal costs are one short-lived process on eligible observations and a
small inherited channel. Measure the drill and compare existing startup/stop
profiles; do not portray synthetic measurements as production capacity results.
Rollback removes optional handoff composition and preserves the existing ledger
and direct recovery implementation. Production cutover remains explicit next work.
