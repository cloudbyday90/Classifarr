# Consistent configuration backups and recovery boundaries

Date: 2026-09-26. Status: implementation design; no release or live restore.

## Problem

The configuration exporter reads related tables through separate pooled queries.
Optional learned patterns and classification evidence are collected afterward.
Concurrent commits can therefore produce a file whose libraries, policies and
evidence never existed together. Successful JSON parsing or encryption does not
demonstrate recoverability.

## Decision and recommendation stack

1. Collect all existing export sections on one PostgreSQL connection in a
   read-only, repeatable-read transaction. Keep the version 2.0 JSON contract.
2. Bound database work with local lock, statement, idle-transaction and total
   transaction timeouts. Fail the export if any section fails; do not fall back
   to an inconsistent partial export. Serialize/encrypt only after commit.
3. Exercise concurrent updates and movie/TV relationship recovery against
   disposable PostgreSQL databases. Check changed identifiers, not only counts.
4. Follow with comprehensive restore-reference verification and a separate
   full-database recovery rehearsal before claiming disaster-recovery coverage.

Keep the query catalog, snapshot orchestration and file/encryption lifecycle in
separate ES modules. Reuse the existing transaction helper and evidence readers'
transaction-client options. No schema migration, new dependency or UI contract is
needed. Do not start providers, routing, AI evaluation or background workers in
the canary.

The initial canary reproduced a foreign-key failure: restore allocated new media
server IDs but reused the source ID in libraries. Restore must pass a server-ID map
to library restoration. Missing or duplicate source server references fail the
transaction; do not guess by name or an unrelated destination database ID.
An existing exact legacy `(type, url)` uniqueness-key match retains its current
credentials and maps to its destination ID, preserving existing merge behavior.
This applies to both merge and replace modes. Legacy files without a referenced
server now produce an explicit validation error instead of accidental rebinding.

Limits are local to collection: 5 seconds waiting for locks, 30 seconds per
statement, 10 seconds idle in the transaction and 120 seconds total transaction
duration. These are protective defaults, not export-size guarantees. Very large
evidence exports may fail and need a future streaming/full-backup path. They must
not silently omit evidence or remove the snapshot limit.

## Options and tradeoffs

| Option | Benefit | Cost / limitation | Decision |
| --- | --- | --- | --- |
| One repeatable-read snapshot | Coherent related records; existing format and readers | Sequential reads; temporarily retains old row versions | Implement with timeouts |
| Separate parallel pooled reads | Lower latency for some exports | Different snapshots can break relationships | Reject |
| Synchronized snapshots across connections | Coherent parallel export | More connections and coordination complexity | Unnecessary for configuration export |
| Full database backup plus isolated restore | Preserves state beyond configuration | Requires private storage, retention, version compatibility and recovery procedures | Separate follow-up |

## Coverage and recovery limits

| Data | Configuration JSON behavior | Recovery implication |
| --- | --- | --- |
| Media connections, libraries, policies, native intent | Exported; restore uses allowed columns and ID maps | Test relationships; exported does not mean every field is restored |
| Provider credentials and settings | Exported | Treat files as secrets; retain encryption by default |
| Learned patterns and classification evidence | Exported only with `includePatterns` | Same snapshot as their libraries and policies |
| Users | Selected identity fields, no password hashes | Not account/password disaster recovery; existing restore does not recreate users |
| Inventory and derived library profiles | Not included | Resync/rebuild depends on providers and existing orchestration |
| Classification history, evaluation/study evidence and external artifacts | Not comprehensively included | Preserve separately; cannot promise reconstruction from this file |
| Operational leases, queues and lifecycle cursors | Not a replayable workload backup | Preserve existing restore gates and cursor invalidation; never infer permission to replay jobs |

The canary is regression evidence for explicitly tested relationships, not a
certificate that arbitrary historical files or every configuration reference can
be restored. In particular, audit provider destination IDs and embedded library
references before expanding restore claims. A consistent snapshot also does not
repair data that was already inconsistent in the source.

## Official research

Sources discovered through search and reviewed on 2026-09-26:

- [PostgreSQL 18 transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html):
  repeatable read retains one transaction snapshot, unlike per-statement
  read-committed snapshots. This is the basis for coherent export, not a claim of
  serializable application semantics.
- [PostgreSQL 18 pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html):
  parallel database dumps require synchronized snapshots. A single connection
  avoids that coordination for this application-level format.
- [PostgreSQL 18 backup verification](https://www.postgresql.org/docs/18/app-pgverifybackup.html):
  integrity verification does not replace test restores. `pg_verifybackup`
  verifies physical base backups, not Classifarr JSON; apply the testing principle,
  not that command to these files.
- [PostgreSQL 18 connection timeouts](https://www.postgresql.org/docs/18/runtime-config-client.html):
  long-lived transactions retain row versions and locks; use transaction-local
  limits rather than changing defaults for all application sessions.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages):
  future recovery status should expose success/failure programmatically without
  moving focus. This backend change adds no visual status or accessibility claim.

## Acceptance criteria

- Every export query and optional evidence read uses the same transaction client.
- Concurrent committed changes cannot mix generations across exported sections.
- Disabled optional evidence is not queried; excluded passwords remain excluded.
- Failed collection rolls back and publishes no backup file.
- Recovery canary checks movie and TV relationships with different destination IDs.
- Existing encrypted backup, native-intent restore guards and legacy format tests
  continue to pass. Production data and runtime configuration remain untouched.
