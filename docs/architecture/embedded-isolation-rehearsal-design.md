# Embedded database isolation rehearsal

Date: 2026-09-30. Implementation base: `035bb06e`.

## Decision

Prove the next part of the [schema maintenance boundary](schema-maintenance-boundary-design.md)
in a disposable production-image container before changing live credentials. The
previous restart required PostgreSQL crash recovery; Node and PostgreSQL also
share an OS identity and local trust authentication in the ordinary installation.
These are separate problems from missing historical ingestion ownership.

We retain the selected database-capability architecture and the existing
`legacy_owner_unknown` safeguard. The security-hardening review makes this a
rehearsal gate, not permission to adopt unknown owners or deploy restricted roles.
We do not backfill invented historical process identities.

## Design

| Boundary | Rehearsal behavior | Assertion |
| --- | --- | --- |
| Host resources | Random, collision-checked Compose project; named scratch volumes only | Refuse collisions before acquiring cleanup responsibility |
| Container | No network interfaces except loopback, no published ports, read-only root | Inspect mount layout; fail on external interfaces or writable root |
| PostgreSQL | Separate `postgres` Linux user, private data directory | App cannot read PG files, edit HBA or read init-process environment |
| Authentication | Explicit Unix-socket peer maps; all other roles/connections rejected | App cannot reconnect as bootstrap or `postgres`, or connect through TCP |
| Runtime | `classifarr` OS user to restricted `cf_runtime` SQL role | No effective capabilities, no new privileges, no role assumption/schema DDL |
| Maintenance | Separate short-lived process as PostgreSQL OS user | Real schema command defers with exit 75 while normal app holds admission |
| Lifecycle | Wait for actual Node exit before fast PostgreSQL shutdown | `pg_controldata` must report shut down; restart must not require crash recovery |

The root test supervisor is trusted, as is the host Docker administrator. It has
only the capabilities needed to provision scratch ownership, switch users and
terminate its children. Runtime children receive a fixed environment, not inherited
administrator settings. We use no SQL administrator password. The bootstrap SQL
role remains privileged but can authenticate only through the PostgreSQL OS
identity; this is access isolation, not bootstrap-role demotion or removal.

The real app runs in externally maintained schema mode. It retains ordinary table
DML for compatibility: **this is not the execute-only inventory gateway**. Writable
application state and its generated application encryption key remain separate
from PostgreSQL data. Code and extension libraries are read-only. Negative probes
require permission/authentication errors, not arbitrary connection/file failures.

After runtime exit, the drill dumps to its private volume, restores to a second
synthetic database, calls the actual deferred image-index rebuilding worker and
validates the three resulting indexes. It checks a sentinel row and restricted
schema readiness after restore. This is a database-tool handoff test, not the full
application encrypted-backup/restore quarantine workflow. No live media or provider
credentials are supplied, and no external AI/provider call is possible.

We check authenticated API denial and persisted startup errors as well as health.
Fresh startup is observed only for the bounded drill window; that is not a long-run
scheduler, configured-library or capacity test. Repeated schema maintenance and a
PostgreSQL restart are not substitutes for a published-version upgrade.

## Run and cleanup

From the repository root:

```powershell
npm run test:local:embedded-isolation-drill
```

The launcher accepts no overrides. It ignores ambient Compose file/project
settings and `.env` discovery, uses the production build target, and removes only
its own generated image, containers and scratch volumes. Build and execution have
20-minute and 10-minute deadlines; cleanup failure makes the overall result fail
and identifies the exact project. Host termination can still interrupt cleanup;
inspect that project before removing any remnants. Never run a broad Docker prune.

Do not combine the rehearsal Compose file with installation files. The internal
maintenance probe rejects ordinary application environments before database work.
Production Dockerfile, entrypoint and Compose defaults are not changed. No version
bump, release, live restart, credential migration or library-state mutation occurs.

## Official research and tradeoffs

Sources discovered through online search and read on September 30, 2026:

- PostgreSQL peer authentication obtains the connecting OS identity from the
  kernel; explicit maps let us separate runtime and administrator logins without
  distributing an administrator password.
  [Peer authentication](https://www.postgresql.org/docs/18/auth-peer.html).
- HBA uses the first matching rule and has no authentication fallback. We allow
  only fixed local identities and reject other connections.
  [HBA rules](https://www.postgresql.org/docs/18/auth-pg-hba-conf.html).
- Fast shutdown disconnects clients and performs an orderly shutdown. We first
  wait for Node, then verify stopped cluster state rather than equating process
  termination with a clean database stop.
  [Server shutdown](https://www.postgresql.org/docs/current/server-shutdown.html).
- Docker distinguishes read-only root, capabilities, no-new-privileges and the
  graceful-stop deadline. They are complementary controls, not interchangeable.
  [Compose services](https://docs.docker.com/reference/compose-file/services/).
- W3C calls for programmatically exposed status messages. This command reports
  explicit text and a structured result, never color-only success. It adds no UI;
  any later dashboard must expose waiting, failure and next action accessibly.
  [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html).

| Approach | Pros | Cons / limits |
| --- | --- | --- |
| SQL-role rename under existing trust/shared UID | Small operational change | Does not prevent reconnect or file-level bypass; reject as isolation |
| Embedded separate identities and peer maps (rehearsed) | Preserves single-container model; no admin secret in runtime | Trusted supervisor, custom UID/upgrades and privileged task handoff need full testing |
| Separate PostgreSQL service | Clearer filesystem/process boundary | Extra service and deployment/backup migration; preferable for managed external DBs |

The drill is capped at 2 CPUs, 2 GiB and 128 PIDs/threads; Node has a 1 GiB heap
cap. These are test containment limits, not recommended live sizing. Reported
supervisor RSS is not whole-container or PostgreSQL peak memory. We have no
representative throughput comparison yet.

## Recommendation stack and next component

1. Keep current live recovery controls; use this rehearsal as an automated gate.
2. Build the production **embedded lifecycle supervisor and provisioning contract**:
   distinct OS identities, explicit HBA, immutable code, bounded Node-to-PostgreSQL
   shutdown, and one-shot maintenance entry points. Prove configured-library,
   custom-UID, interrupted-upgrade and encrypted-restore behavior before enabling it.
3. Migrate every inventory writer to the enforced capability contract, then enable
   automatic legacy recovery only after old-credential reconnect and stale-writer
   rejection are proven across supported upgrades.

I recommend the embedded candidate for the current installation model. A separate
database service becomes preferable if the supervisor's maintenance and upgrade
complexity exceeds the benefit of preserving the single-container deployment.
