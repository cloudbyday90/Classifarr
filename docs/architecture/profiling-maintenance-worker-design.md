# Bounded profiling maintenance worker

Date: 2026-10-04. Scope: packaged embedded startup, not an authority cutover.

## Decision

Move opportunistic `pg_stat_statements` installation out of the web process's
database helper and into one supervisor-owned child before normal application
startup. Keep status observation read-only. Historical migrations remain intact;
default startup still runs migrations and still has shared OS/database authority.
This is one prerequisite for separation, not a security boundary by itself.

The existing installer selects writes by matching human-readable failure text.
An unknown observation error can therefore reach `CREATE EXTENSION`. Replace
that with typed, fail-closed catalog observations and a fixed operation.

## Contract

- One short assessment per normal embedded startup; no resident worker, polling,
  network/provider calls, new setting, Compose mount or Unraid template change.
  Restore-only startup never invokes it. An already active extension needs no DDL.
- Only install the shipped, fixed extension into `public`, after known available
  files, exact preload membership, missing extension, unchanged authenticated
  administrator identity and exclusive runtime/restore admission (lock 2024).
  No caller-supplied SQL, extension name, executable or inherited environment.
- Use one pinned transaction and destroy its connection on every outcome. A
  present restore gate must be ready; a missing table is a fresh/legacy schema,
  not an ownership attestation. Do not alter restore gates or ingestion records.
- Bound SQL to 5 seconds, lock waits to 1 second, idle transaction to 5 seconds,
  connection acquisition to 5 seconds, heap to 128 MiB and child lifetime to
  20 seconds. Output is discarded above the existing 64 KiB safety bound.
  The parent must join the child before starting the application or stopping PG.
- Known ineligibility and database errors defer optional installation with no
  retry in that process. No new durable retry state: the catalog is the completion
  record and the next startup reassesses it. Commit ambiguity is never reported
  as installed. A killed, failed or unjoined process remains a startup failure.
- Completion means the extension is catalog-installed and preloaded, or optional
  maintenance explicitly deferred. It says nothing about historical ingestion
  ownership, provider health, AI readiness or query execution statistics.
- Emit only fixed parent status/operation fields. Runtime observation returns
  bounded reason codes, never raw SQL/connection errors or provider data.

## Options and recommendation stack

| Option | Benefit | Cost / limitation | Decision |
| --- | --- | --- | --- |
| Keep opportunistic runtime DDL | No extra child | Unknown failures can select writes; mixes responsibilities | Reject |
| Bounded compatible startup worker | Removes this runtime DDL path; unchanged saved templates | One short child per startup; same privileges today | Implement first |
| Full separate OS/HBA/runtime role | Enforceable authority isolation | Requires complete writer migration and supported deployment modes | Next architectural stage |

Priority: typed observation and bounded worker, then complete privileged-operation
handoffs, then root-managed OS/HBA/file separation and production writer gateway.
Forced-non-root templates must retain an honestly labelled compatibility mode.
Do not assign a new owner to legacy captures merely because they are old.

## Research

Official sources discovered through web search and opened on 2026-10-04:

- [PostgreSQL 18 profiling extension](https://www.postgresql.org/docs/18/pgstatstatements.html):
  preload is server-wide; extension objects are installed separately per database.
- [CREATE EXTENSION](https://www.postgresql.org/docs/18/sql-createextension.html):
  use shipped files and trusted extension code; installation generally needs
  elevated authority. No arbitrary extension installation API is introduced.
- [PostgreSQL timeouts](https://www.postgresql.org/docs/18/runtime-config-client.html):
  statement and lock timeouts bound different waits; set them on this session.
- [Node child processes](https://nodejs.org/download/release/v25.9.0/docs/api/child_process.html):
  use fixed executable/arguments without a shell; process termination and stream
  completion are separate events. Implementation is tested on pinned Node 24.21.0.

No UI or HTTP contract changes; no new W3C-specific implementation is needed.

## Evidence required

Unit tests must cover unknown/malformed catalog data, exact preload matching,
defer paths, cleanup, fixed launcher environment, restore bypass and result-code
handling. Isolated PostgreSQL tests must prove real installation/idempotency,
shared/exclusive lock exclusion, restore-gate refusal, restricted-role refusal,
rollback on error and lock release. Rebuild without cache, inspect local startup,
then dump the schema using a disposable database, never live appdata.
