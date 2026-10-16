# Optional gateway archive services

These services are not enabled by the ordinary Classifarr Compose file or by an
upgrade. They archive only the optional gateway ledger. Do not replace ordinary
application backups with this feature. No live history is deleted.

## One-time installation boundary

Use PostgreSQL 18 and the existing standalone version-7 gateway schema. Apply
`database/ollama-gateway-archive/current.sql` once to that database as schema owner.
For an existing v1 archive installation, stop its coordinator, finish any existing
retirement, then apply `20261016_170000_archive_protection.sql` once and add the
protection grants below. Do not apply the fresh schema to an existing installation.
The upgrade preserves job attempts and evidence. This optional schema does not enter the
normal application's migration stream or the archived inference schema.

Provision separate non-superuser, non-creator roles. Supply credentials privately;
the following names illustrate grants, not reusable passwords:

```sql
CREATE ROLE gateway_archive_reader LOGIN;
CREATE ROLE gateway_archive_writer LOGIN;
GRANT CONNECT ON DATABASE gateway TO gateway_archive_reader, gateway_archive_writer;
GRANT USAGE ON SCHEMA ollama_gateway TO gateway_archive_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA ollama_gateway TO gateway_archive_reader;
GRANT USAGE ON SCHEMA gateway_archive TO gateway_archive_writer;
GRANT SELECT, INSERT, UPDATE ON gateway_archive.job TO gateway_archive_writer;
GRANT SELECT, INSERT ON gateway_archive.protection TO gateway_archive_writer;
GRANT UPDATE(ready_at) ON gateway_archive.protection TO gateway_archive_writer;
```

Use private, dedicated Linux directories owned by UID/GID 1000 (mode 0700) for
archives and receipts, with no unrelated files. Configuration is a same-owner
0600 file. Keep the original offline-archive directories separate. Example:

```json
{
  "source": {
    "database": {
      "host": "/source-socket",
      "database": "gateway",
      "user": "gateway_archive_reader"
    },
    "providerHash": "<the existing gateway provider SHA-256>",
    "retentionDays": 90
  },
  "maintenance": {
    "host": "/source-socket",
    "database": "gateway",
    "user": "gateway_archive_writer"
  },
  "archives": "/archives",
  "receipts": "/receipts"
}
```

Set the explicit paths and tested immutable image ID documented by
`docker-compose.gateway-archives.yml`. Start that file separately, only after
reviewing its mounts and socket authentication. Use SCRAM/password authentication
for the two source-cluster roles; do not expose a trust-authenticated superuser
socket to these services. Include each role's private `password` in its database
configuration when required. The verifier must never receive
the source socket, configuration, environment credentials or Docker socket.
Neither service needs network access. Keep one instance of each service.
The verifier has a read-only archive mount and writes only its receipt mount and
private scratch space; the coordinator reads receipts but cannot modify them.
The template enables an init/reaper and disables the inherited application HTTP
healthcheck: these workers do not expose the application server or an HTTP port.

## Automatic behavior

- First archive after nonempty history; daily if changed; as early as hourly
  when bindings reach 80,000. The five-minute check does not imply a five-minute dump.
- Two rolling verified copies, protected historical copies, and at most one
  replacement in progress, within 1 GiB total managed storage. Each dump is capped
  at 256 MiB. An additional 64 MiB free-space
  reserve is required; the archive budget does not include verifier scratch.
- Three attempts per source revision, with persistent five-minute/30-minute
  cooldowns. Attempts are independent of inference limits. Failed partial files
  count against the budget and are not silently erased.
  Legacy fingerprints caused solely by count-row ordering share the same budget;
  upgrading does not reset their attempts, timestamps or verified receipts.
- Rotation removes only registered older copies whose immutable history was
  proved present in a verified replacement. It never touches live SQL history.
- Unknown export termination, changed configuration/identity, malformed receipts,
  unexpected files, or insufficient space pause archival, not classification.

State transitions are written as bounded JSON to the service log. The job table
is the durable record; log silence alone does not prove completion. A successful
archive has `status=verified` and a matching receipt with `verified=true` and
`purgeAuthorized=false`. Integrity verification by the old CLI alone does not
create such a receipt. Missing verifier output remains pending, not successful
and not a reason to start another overlapping restore.

New exports use version-4 manifests with at most 100 exact retention candidates;
version-2 restore receipts bind their independently verified inventory digest.
Version-3 manifests and version-1 receipts remain usable for legacy restore and
rotation only, not candidate-level cleanup evidence. Upgrade coordinator and
verifier together; old verifiers safely refuse new manifests. Unchanged legacy
history is not forcibly re-exported and retry limits are not reset. See the
[cleanup-evidence design](gateway-cleanup-evidence-design.md) for compatibility
and the [recovery protection design](gateway-archive-protection-design.md).

At capacity pressure, two exact-candidate archives receive durable SQL protection
and private file markers. They may coexist with two newer rolling copies inside
the same 1 GiB budget. One extra unchanged export can establish the second copy,
but still consumes the same three-attempt revision budget and cooldowns. Do not
remove protection markers or edit holds to make space. An unready hold resumes
publication after restart; a missing marker on a ready hold blocks maintenance.
Protection does not expire from archive age: the required 30-day recovery window
must start from confirmed deletion, which is not implemented. No live history is
deleted by these services. The new worker refuses a missing protection schema.

An interrupted export is intentionally not retried from a timeout alone. Preserve
its directory and job record and investigate the stopped worker before a future
recovery procedure changes that state. The compose template does not restart
failed services indefinitely. Graceful cancellation waits for the export child;
the verifier removes only its own scratch directory after PostgreSQL has exited.
Abandoned scratch is bounded by the container's tmpfs/memory limits.

## Limits and next step

The first version supports colocated Unix-socket PostgreSQL, not remote TLS
export. Maintenance jobs stop growing at 10,000 records; no live job pruning is
implemented. Resource limits are safety caps, not a guarantee that every
256 MiB dump can restore within 1 GiB scratch. A bounded failure is preferable to
removing recovery evidence. An archive is only a local recovery copy, not an
off-host disaster-recovery backup. Next work is fresh, transactional live-history
eligibility plus atomic deletion-completion evidence before automatic purge or
protection expiry can be enabled.

## Local capacity and interruption qualification

Run the existing rehearsal's explicit extended mode against an immutable image
and its full source revision:

```text
node scripts/run-gateway-online-archive-rehearsal.mjs <immutable-image-id> <source-revision> --qualification
```

This uses only newly created labelled containers, volumes and synthetic databases.
It does not connect to a configured gateway, Unraid or a provider. It exercises
separate production-sized archive workers, large histories, content/storage
refusal, actual process interruption and reconstructed narrow retirement states.
CPU, memory, swap and PID limits are checked inside the container as well as in
Docker configuration. The fixture observer shares those limits; it is not part
of the production service. Extra Node diagnostic processes must not be launched
inside the 32-PID worker during the exercise, since the diagnostic itself can
exhaust that budget.

The runner prints bounded measurements and verifies owned-resource cleanup.
It fails if a required interruption boundary is missed. Database fixtures advance
archive scheduling timestamps explicitly; they never refund inference attempts.
See the [qualification design](gateway-archive-qualification-design.md) and
[outcome record](gateway-archive-qualification-outcome.md) for tested shapes and
limitations. Passing a synthetic 100,000-binding history is not a promise that every shape of that history fits
the independent byte, restore-scratch or timeout limits.
