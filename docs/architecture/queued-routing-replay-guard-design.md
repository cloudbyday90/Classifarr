# Queued routing replay guard

## Problem and decision

The queue can reclaim an interrupted classification after its visibility deadline.
Classification history and diagnostic decision witnesses precede routing, but
neither prevents another classification and add attempt. Provider reconciliation
limits POSTs within one execution; it cannot prove that an earlier execution did
not add an item when a later lookup reports absence.

Persist a routing classification reference on the queue command before entering
automatic routing. Admission locks the command, verifies the received claim and
its live deadline, and commits the reference with an explicit pending routing
state in history. No HTTP runs inside this transaction. The reference is not in
client-supplied payload JSON and is never cleared by retry, failure or shutdown.

On replay, read the original classification instead of reclassifying or contacting
the provider. Only a saved `routed` status and routing result count as verified
success. Otherwise return `automatic_routing_unconfirmed`; do not turn an unknown
outcome into success or imply that nothing happened remotely. Queue completion
means processing stopped, not that routing succeeded. Do not replay notifications.

## Safety and limits

- Scope: one existing classification queue command, movie or TV. Fresh/empty
  installs add no job, timer, network call or optional AI prerequisite.
- The immutable reference admits at most one automatic routing execution per
  command, including competing/reclaimed workers. Missing/expired claims fail
  closed. Read replay evidence only for the currently owned claim.
- Lock wait: 2 seconds; statements: 10 seconds; transaction: 15 seconds.
  Existing bounded provider methods retain their timeouts and response limits.
- Admission failure rolls back both writes. After admission, crashes before any
  provider I/O are conservatively unknown too. Transient/permanent routing errors
  are not write-retry authority. Cancellation and changed configuration do not
  remove the marker.
- A later configuration change must not redirect a replay. No provider contact is
  made on replay, so neither new credentials nor a new endpoint can authorize it.
- The reference deliberately has no foreign key to history: history retention
  must not erase the write barrier. Missing history is unconfirmed, never absent.
  Queue retention deletes the marker with the command; a newly submitted command
  is a separate action, not covered by this per-command guarantee.
- No URLs, credentials, provider bodies or new untrusted error strings are saved.
  Existing metadata is updated narrowly, preserving decision evidence.
- This is prospective fencing, not inferred ownership for legacy attempts. It
  does not change manual recovery, direct classification HTTP requests, live
  Unraid data, or the existing legacy-ingestion warnings.
- All workers sharing a database must run marker-aware code. An older image does
  not honor the marker; retaining an old image is not proof that rollback during
  unresolved routing is safe. Drain old workers before upgrading shared writers.

## Options and recommendation stack

| Option | Benefit | Cost / limitation |
| --- | --- | --- |
| Repeat reconciliation on each queue retry | Simple; may recover quickly | A negative read is not proof an earlier POST was unapplied |
| Durable command marker (selected) | Prevents uncertain write replay across crashes; no extra worker | Conservative unknown state may require review |
| Provider-scoped intent and read-only reconciliation | Can resolve uncertainty automatically without POST replay | Requires revision/identity capture, bounded probes and separate evidence |

Implement the marker first, prove crash/reclaim behavior, then add provider-scoped
read-only reconciliation. A blanket retry or an expiring marker is not acceptable.
UI work, production privilege separation and unrelated dependency updates remain
separate steps.

The existing queue also gates deterministic classification on AI availability.
The isolated fixture supplies a synthetic cloud-provider selection to exercise
that unchanged dispatch path; any actual generation request fails the fixture.
Removing that unnecessary prerequisite, particularly for read-only replay, is a
separate follow-up rather than a hidden change in this routing fix.

## Verification plan

Unit checks cover early replay, admission wiring and non-routing behavior.
Isolated PostgreSQL tests cover atomic rollback, concurrent admission, stale
claims, deleted history and saved-success interpretation. A restricted real-image
rehearsal must observe an accepted provider POST before killing the app, retain
PostgreSQL/provider state, restart real queue processing and count all attempted
POSTs (not just stored provider records). Any synthetic deadline advance must be
reported as such, not elapsed-time evidence. Rebuild without cache, rerun against
the immutable image, and regenerate the schema from an isolated database.

The existing compatible-maintenance rehearsal also needs stable synthetic dead
rows. Temporarily raise both vacuum trigger thresholds on its disposable queue
table, keeping autovacuum enabled for the production admission checks, then
restore the verified original values. Otherwise autovacuum can remove the test
pressure before the manual worker runs. This fixture control is not a production
tuning recommendation and does not disable PostgreSQL's wraparound protection.

## Official sources

Retrieved 2026-10-04 through web search and opened directly:

- [HTTP Semantics, RFC 9110 §9.2.2](https://www.rfc-editor.org/rfc/rfc9110.html):
  automatic retry of non-idempotent requests requires knowledge that retry is
  safe or the original was not applied. The per-command marker is our application
  of this principle, not a claim that providers support idempotency keys.
- [PostgreSQL 18 explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html):
  row locks coordinate concurrent writers and end with the transaction. A durable
  marker is needed beyond that transaction and beyond a process lifetime.
- [PostgreSQL 18 vacuum configuration](https://www.postgresql.org/docs/18/runtime-config-vacuum.html):
  updated/deleted tuples and inserted tuples have separate vacuum triggers, with
  per-table overrides. Both matter when stabilizing a disposable pressure fixture.
