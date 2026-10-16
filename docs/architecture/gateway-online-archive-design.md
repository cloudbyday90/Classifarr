# Automatic gateway archives

Date: 2026-10-16. Status: approved for local implementation and synthetic testing.

## Scope and decision

Archive optional gateway history without planned inference downtime. This is not
a whole-application backup, a production deployment, or permission to purge live
history. Existing offline export/review commands retain their stop requirement.
The normal application does not start these optional services.

Use a separate coordinator with a SELECT-only source connection, a narrowly
privileged maintenance-state connection, and a separate network-isolated restore
verifier. Initially support the existing local PostgreSQL socket export path;
remote libpq/TLS transport is deferred. No provider credentials or Docker socket
are available to either service. No new administration buttons are added.

## Research and alternatives

Official sources were discovered through MCP search and opened on 2026-10-16.

| Choice | Advantages | Costs / limitations |
| --- | --- | --- |
| Online exported PostgreSQL snapshot (selected) | Consistent source inventory and dump; ordinary inference writes continue | Extra bounded I/O; DDL contention can abort the job |
| Existing offline export | Simple operational boundary | Requires gateway downtime; retained as an independent tool |
| Isolated restore verification (selected) | Tests actual recovery without live credentials or network | Extra service and bounded temporary storage |
| Hash checks alone | Cheap corruption detection | Does not prove restoration or record completeness |
| Replace verified copies automatically (selected) | Bounded unattended storage | Must refuse rotation if retained records cannot be proved present |

PostgreSQL documents concurrent consistent dumps and shared snapshots in
[pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html). It also warns that
restored SQL can execute source-controlled code; `--no-owner` is not a sandbox.
See [pg_restore](https://www.postgresql.org/docs/18/app-pgrestore.html).
The verifier therefore restores data into the packaged trusted schema with a
restricted database role, as well as using a separate container.
[Docker service controls](https://docs.docker.com/reference/compose-file/services/)
provide network isolation, read-only roots and resource limits.
The replacement-before-expiration ordering follows the approach described in
the [pgBackRest guide](https://pgbackrest.org/user-guide.html); pgBackRest is not
introduced as a dependency. Two copies and 1 GiB are approved project policy,
not universal backup recommendations.

Recommended stack: the existing Node 24 ESM runtime; PostgreSQL 18 exported
snapshots and native UUIDv7; separate source-reader/maintenance-writer roles;
the packaged trusted schema plus restricted data-only restore; and two optional
Docker services with explicit resource and filesystem boundaries. No new npm
dependency, provider gateway activation, or replacement backup platform is needed.

## Scheduling and durable ownership

No history means no archive. After optional-service setup, create the first
nonempty archive automatically; thereafter archive changed history daily, or
after one hour near the existing 80,000/100,000 binding capacity threshold.
Assess every five minutes without dumping unchanged history. Source identity,
policy and a source revision bind each job. Keep one coordinator session lock,
separate from inference ownership. No maintenance attempts or cooldowns reuse or
reset inference counters. Native PostgreSQL UUIDv7 identifies new state and jobs.

Allow three attempts per source revision with persistent 5-minute then 30-minute
cooldowns. Exhausted/permanent failures pause that revision; no tight retry loop.
Configuration/ledger drift fails closed. Cancellation waits for child exit before
recording a retryable result. An interrupted export without confirmed child
completion is blocked, not retried on lease expiry. An already published archive
can continue waiting for its matching verifier result after coordinator restart.

## Evidence and storage

Version-3 manifests bind the ledger, provider, policy, snapshot time, native
archive ID, dump hash/length, counts and canonical SHA-256 digests of all seven
gateway tables, using bounded ordered batches in the same exported snapshot.
Verification uses the trusted schema, checks restored content and required
immutable-history protection, and returns an exact manifest/dump-bound result.
Source SQL and provider secrets are never logged or copied to the verifier.

Keep two verified managed copies, with at most one pending replacement. Budget
all managed files, including incomplete output, within 1 GiB; retain the existing
256 MiB dump limit and 64 KiB manifest bound. Reserve space before export. Never
remove operator-owned files or infer ownership from a filename alone. Rotation
requires durable ownership, a completed replacement, rechecked file integrity,
and matching prefix digests for every immutable history table. New UUIDs below
an earlier maximum can conservatively block rotation. The mutable admission row
is superseded only for the same ledger/provider with nondecreasing attempts;
exact historic admission states are not promised indefinitely.

The verifier receives read-only archive input, a separate receipt output, and a
bounded private scratch filesystem. It has no source database, provider, network,
or Docker access. Receipt fields are strictly bounded and tied to the exact job;
they never authorize a purge. Incomplete, corrupted, unknown, changed, oversized
or unverified artifacts cannot displace verified copies. If space cannot be
reclaimed safely, archive work pauses; inference is not deliberately stopped.

## Verification and completion

Test empty/unchanged history, online writes during snapshot capture, source
permissions, cross-worker locking, durable attempts/cooldowns, interrupted
export, resumed verification, wrong/stale receipts, content corruption, bounded
disk usage, symlink/hardlink refusal and record-preserving rotation. Exercise the
real packaged PostgreSQL tools and the separately isolated verifier, then run
the existing gateway image rehearsals and rebuild local Compose without cache.
Record actual results and skipped checks separately; do not claim a release or
production activation. Next: use these receipts to design narrowly bounded live
retention, with fresh write-time eligibility checks and protected evidence pins.
