# Offline Ollama gateway archives

This optional administrator tool copies gateway history without deleting it or
contacting Ollama. It is not an application backup, automatic recovery, or a way
to reset the 100,000-binding admission limit. Do not enable it on a shared service
as part of a normal Classifarr update.

## Prerequisites

- Linux, PostgreSQL 18 and `/usr/bin/pg_dump`, schema version 7.
- A separately initialized gateway database, with its expected provider hash
  obtained from that database's reviewed configuration. No schema is created here.
- An approved offline gateway window. Stop only the explicitly owned gateway
  process, not shared Ollama. Archive commands refuse an active gateway owner.
  An offline database does not prove that provider compute stopped.
- A local Unix socket, an archive login with only schema USAGE and SELECT on the
  seven gateway tables, and a separate operator-owned private output directory.
  Do not grant INSERT, UPDATE, DELETE, TRUNCATE or recovery authority to this role.
- Private local storage outside the repository. Directories must be owned by the
  invoking Linux UID with mode 0700; configuration and archives use mode 0600.
  Symlink paths, hard-linked archive files and existing output names are refused.

An administrator provisions the archive role and local socket authentication
separately. For a reviewed role named `gateway_archive_reader`, the data grants
are `GRANT USAGE ON SCHEMA ollama_gateway TO gateway_archive_reader` and
`GRANT SELECT ON ALL TABLES IN SCHEMA ollama_gateway TO gateway_archive_reader`.
Do not give this role access to the main application database's private tables.

## Configuration and commands

Set `CLASSIFARR_GATEWAY_ARCHIVE_CONFIG_FILE` to a private JSON file containing
exactly `database`, `providerHash` and `retentionDays`. `database` accepts `host`
(absolute Unix-socket directory), `database`, `user`, optional integer `port`
(default 5432) and optional `password`. Database/user names use ordinary SQL
identifiers, not connection URLs. `providerHash` is the existing 64-character
lowercase hex hash. `retentionDays` is an explicit integer from 1 to 3650; this
advisory horizon does not grant permission to delete anything.

Run inside the operator's Linux environment with the matching packaged source:

```sh
node /app/src/scripts/archiveOllamaGateway.mjs inspect
node /app/src/scripts/archiveOllamaGateway.mjs create /private/gateway-archives
node /app/src/scripts/archiveOllamaGateway.mjs verify /private/gateway-archives/gateway-archive-UUID
node /app/src/scripts/archiveOllamaGateway.mjs review /private/gateway-archives/gateway-archive-UUID TRUSTED_MANIFEST_SHA256
```

The paths above are examples, not existing mounts. Provision and review your
actual private paths first. The equivalent repository command is
`npm --prefix server run gateway:archive -- <action> [path]`.

`inspect` returns counts, cutoff, attempt count, protected categories and counter
consistency. `older_terminal_review` means reviewable by age/outcome, not safe to
delete. Active, unknown and recovery/stop-linked requests remain protected.
`legacyActiveWithoutBinding` and a false `counterMatches` need investigation,
not an automatic repair. Reports include private operational identifiers.

`create` uses a read-only consistent snapshot and produces a new UUIDv7-named
directory containing `gateway.dump` and `manifest.json`. It reports the archive
ID, byte count and SHA-256 of the manifest. Keep that hash separately in trusted
storage. Preserve the entire directory, restrict access, and use encrypted backup
storage according to your policy. The tool does not encrypt or sign files.

`verify` needs no database configuration. It reads bounded private files and
checks the manifest and dump hash. `restoreVerified: false` is intentional: no SQL
is executed. A checksum is not authenticity if both files have been replaced.

New archives use manifest version 2, with up to 100 oldest terminal request
references and fingerprints captured in the same snapshot as the dump. Older
version 1 archives still verify; they cannot be used for review. Create a fresh
archive rather than editing a manifest to add missing evidence.

`review` uses the same SELECT-only configuration and offline gateway lock. Supply
the manifest hash retained separately from the successful creation receipt.
Do not compute a replacement hash from the directory you are trying to trust.
The command compares exact row fingerprints, admission state, table counts,
provider/ledger identity and the configured retention horizon. It makes no Ollama
calls, executes no restore SQL and writes nothing to the database or archive.

The result has a time-based UUIDv7 review reference and one of three statuses:

- `ready_for_review`: the archived candidates still match this read-only snapshot.
- `no_work`: there were no eligible candidates in the archive.
- `blocked`: drift, new protection or inconsistent history prevents a usable plan.

A successful command exit means the review completed, **not** that its status
permits cleanup. Inspect `status` and `reasons`. `remainingCandidates` reports any
eligible rows beyond the first 100; it does not authorize looping or deletion.
Even a matching result always has `purgeAuthorized: false`. Keep the JSON output
private if you save it. No consent is persisted, and no plan is an execution
capability. A later cleanup implementation must revalidate under write-time
locks, retain tombstones and preserve lifetime attempts and cooldowns.

See the [retention review design](../architecture/ollama-retention-review-design.md)
for the bounded contract and tradeoffs.

## Failures and restoration

Operations have SQL/lock deadlines, a 60-second dump limit, 256 MiB dump limit and
120-second process deadline. SIGINT/SIGTERM cancel work. Errors expose fixed codes
only. There are no retries. A failed command can leave partial files, including
a marker whose durability was not established; do not treat its mere presence as
success. Preserve partial evidence and review before removing exact files. Do not
edit counters or immutable history, relax safeguards, or retry indefinitely.

After a successful create, verify the files and test restoration separately into
a **new disposable database**. Trust and review the source first: a PostgreSQL
archive can execute SQL during restore. Use PostgreSQL 18 `pg_restore` with
`--no-owner --no-acl --exit-on-error --single-transaction`, explicit destination
and no `--clean`. Reapply reviewed least-privilege grants separately; cluster
roles, database configuration and other schemas are not included.

Before any future use, compare all seven tables and the admission record, check
immutable triggers and constraints, and confirm uncertain work, attempt counts,
recovery references and cooldowns remain unchanged. Never connect a restored copy
to the live provider or run two ledgers against one provider. Re-enabling a
gateway remains a separate operational decision; this CLI does not resume it.

See the [design and official sources](../architecture/ollama-history-archive-design.md)
and [test outcome](../architecture/ollama-history-archive-outcome.md).
