# Resumable legacy database identity migration

Date: September 30, 2026. Implementation base: `c840c0c1`.
This continues the [embedded provisioning design](embedded-provisioning-handoff-design.md).

## Decision and scope

We implement a reusable ESM phase runner, protected durable journal and bounded
cold-tree utilities, then exercise them with a real legacy PostgreSQL 18 cluster
in the existing disposable Docker drill. We preserve the original cluster and
convert a separate candidate. There is **no production startup hook, HTTP endpoint,
active-cluster switch, live credential change or release** in this increment.

I inspected the entrypoint, supervisor, schema maintenance, queue index rebuilding
and queue retention paths. The existing entrypoint still gives PostgreSQL and
Node the same OS identity and administrative database access. Earlier isolation
tests initialized an already-separated cluster; they did not demonstrate how old
data crosses that boundary or survives an interrupted transition.

We should not enable default separation while normal queue processing can still
issue owner-only index DDL. The migration component is now independently testable;
the next implementation should route that concrete privileged job through the
maintenance boundary, not add another dashboard or assign fictional import owners.

## Official research

Sources were discovered through online search and opened on September 30, 2026:

- PostgreSQL requires a stopped server or an appropriately consistent snapshot
  for physical backups. Merely blocking connections is insufficient. We use a
  stopped whole-cluster copy, including WAL, rather than copying individual tables.
  [File-system backups](https://www.postgresql.org/docs/current/backup-file.html).
- Peer authentication derives identity from the operating system. HBA uses the
  first matching rule, not a fallback chain. We replace inherited trust rules in
  the candidate with explicit peer mappings and reject everything else.
  [Peer authentication](https://www.postgresql.org/docs/18/auth-peer.html),
  [HBA matching](https://www.postgresql.org/docs/18/auth-pg-hba-conf.html).
- Role attributes and memberships are distinct. Default grants affect future
  objects, not existing ones. We validate the reserved runtime role, reject its
  memberships, clear passwords, and grant both current and future DML access.
  The bootstrap superuser remains a maintenance identity, not a runtime credential.
  [ALTER ROLE](https://www.postgresql.org/docs/18/sql-alterrole.html),
  [Default privileges](https://www.postgresql.org/docs/current/sql-alterdefaultprivileges.html).
- Linux flock follows the open file description and releases when its last
  descriptor closes. The parent retains the descriptor acquired through BusyBox,
  so process death releases the lock without age-based lock-file deletion.
  [Linux flock semantics](https://www.man7.org/linux/man-pages/man2/flock.2.html).
- Unraid templates retain container settings. An image cannot manufacture missing
  privileges or writable mounts; we retain current launch behavior in this phase.
  [Unraid container management](https://docs.unraid.net/unraid-os/using-unraid-to/run-docker-containers/managing-and-customizing-containers/).
- W3C calls for textual identification of errors. This change has no browser UI;
  migration rejection reasons are textual. Future UI status needs accessible
  semantics, not color-only progress. No WCAG conformance claim is made here.
  [Error identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification).

## Options and tradeoffs

| Option | Benefit | Cost / residual risk |
| --- | --- | --- |
| In-place ownership and credential conversion | Avoids a second database copy | Interruption changes the only copy; filesystem and SQL rollback are not one transaction |
| Copy-first embedded conversion — selected | Original stays intact; candidate can be tested before activation; fits one container | Additional disk, copy/hash time and planned downtime; activation remains separate |
| Migrate to an external PostgreSQL service | Stronger deployment separation and mature database operations | Requires operator-managed services, connection changes and data migration; not transparent to saved Unraid templates |

I recommend copy-first conversion for the existing single-container model. If
storage constraints dominate, we should evaluate a verified snapshot or supported
backup/restore path explicitly rather than silently fall back to in-place mutation.
External PostgreSQL is preferable when operators already manage that infrastructure.

## Components and durable phases

| Component | Responsibility |
| --- | --- |
| `embeddedMigrationPhases.mjs` | Exact version/binding validation, write-ahead phase intent, repeatable effects, final revalidation |
| `embeddedMigrationJournal.mjs` | Root-owned ancestors, regular non-linked files, kernel-held lock, file sync, rename and directory sync |
| `embeddedMigrationTree.mjs` | Bounded sequential inspection/copy/hash/ownership; no links, special files or nested mount crossings |
| `identityMigrationSteps.mjs` | Disposable PostgreSQL adapter; stopped-source checks, candidate policies, role transaction and verification |
| `identityMigrationProbe.mjs` / worker | Synthetic legacy fixture, actual process termination and independent resumption |

The phase order is copy, ownership, authentication, roles, then verification.
Before each effect, the journal records its pending phase. Completion is recorded
only after the effect succeeds. A crash between effect and receipt replays the
idempotent phase. A completed receipt still runs verification on the next invocation.
The journal binds the source content digest, cluster system identifier, fixed
source/candidate layout, target UID/GID and contract version. Unknown versions,
malformed state and changed bindings fail closed before migration effects.

The journal directory and every ancestor must be root-owned and not writable by
group/other. Symlink directories, linked or oversized journal files and concurrent
leases are refused. Receipts contain no password. The fixed Linux flock subprocess
has a five-second timeout and no shell or inherited environment.

The cold-tree pass allows at most 50,000 entries, 8 GiB and 64 levels. It hashes
with a reusable 1 MiB buffer; filesystem work is sequential. The drill requires
110% of source file bytes available before copying. This is a conservative rehearsal
limit, not a production capacity promise. Unsupported external WAL/tablespaces,
symlinks, hard links and nonregular files require a separately reviewed migration.

Only the unpublished, journal-registered candidate is rebuilt on a copy retry.
The original is never deleted or changed. Ownership changes and copied data are
synced before the corresponding receipt. Candidate authentication lives outside
PGDATA under a root-owned parent. Old includes, preload paths, archive commands
and auto-configuration are not inherited; this is not a custom-config migration.

The SQL transaction clears the old administrator password, creates or validates
the reserved `cf_runtime` identity, rejects its memberships and grants DML/sequence
access. Local peer mapping permits only OS `postgres` to use the administrator
role and OS `classifarr` to use the runtime role. TCP and other identities are
rejected. The runtime cannot read PGDATA, alter HBA, become administrator or run
owner-only DDL. DML grants are intentionally not an ingestion writer fence.

## Privileged work still blocking production activation

| Inspected path | Required integration before default separation |
| --- | --- |
| `queueTaskProcessorIndexing.mjs` | Route concurrent HNSW/B-tree rebuilds to a bounded owner-capable maintenance job; retain task claim fencing |
| `queueMaintenanceService.mjs` | Define narrowly scoped maintenance authority for VACUUM/ANALYZE after queue drain, without granting runtime administrative ownership |
| `config/database.mjs` | Keep extension creation with schema maintenance, not restricted runtime startup |
| `databaseSchemaMaintenance.mjs`, restore maintenance | Connect existing one-shot operations to protected production composition and admission |
| `docker-entrypoint.sh` | Replace shared recursive chown/startup and pgvector staging; preserve PostgreSQL major-upgrade behavior and an explicit non-root path |

This is a scoped blocker inventory, not a claim that every dynamic SQL caller has
been classified. The existing writer-ownership gate retains unresolved paths.

## Recovery, compatibility and limits

The real drill kills the migration process after each phase effect and while the
candidate database is running. The next process acquires the released lock,
recognizes the registered candidate, stops it, and resumes. It never terminates
the source or selects a process by age. The fixture owns its entire offline
environment; a stopped PID file alone is **not** proof that external writers are
absent. Production needs a trusted exclusive-writer boundary before calling this
component. A held file descriptor in another process is outside this proof.

We test process death, not power-loss durability of every host filesystem, NFS,
ACL model or storage controller. There is no automatic retry daemon. Existing
root, non-root, read-only and no-new-privileges deployments keep current behavior;
the new migration is not attempted on them. No Compose/Community Apps update is
required to keep them functioning. Automatic activation on constrained non-root
hosts would require an operator-supported migration path, not elevated runtime.

Before activation, the untouched source is the recovery copy. After candidate
writes begin, switching back to that source would lose those writes and restore
weaker authentication. Post-activation rollback must therefore be designed and
verified separately; this component does not perform that switch.

## Recommendation stack and acceptance

Keep the tested migration component unhooked from normal startup. Next implement
the **bounded privileged index-rebuild job and its queue claim/admission contract**.
Then integrate remaining administrative jobs, protected persistent layout and
capability-aware activation. Only after those pass upgrade/restart tests should
production identity separation be enabled. Inventory writer fencing and automatic
legacy import recovery remain later work, with no fabricated ownership backfill.

That index job should verify both definition and validity before reporting success.
The inspected worker currently uses `CREATE INDEX CONCURRENTLY IF NOT EXISTS`;
PostgreSQL documents that failed concurrent builds can leave invalid indexes and
that a matching name alone does not guarantee the intended definition. We have
not asserted that a live index is invalid. The follow-up should cover interrupted
build recovery, an allowlist of index definitions, bounded resource/time budgets,
single-job admission and stale task-claim rejection with real PostgreSQL tests.
[Concurrent index creation](https://www.postgresql.org/docs/18/sql-createindex.html).

See the [outcome document](legacy-database-identity-migration-outcome.md) for measured
tests and limitations. No live database is used by the migration drill.
