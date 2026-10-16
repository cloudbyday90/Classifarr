# Optional gateway archive services

These services are not enabled by the ordinary Classifarr Compose file or by an
upgrade. They archive only the optional gateway ledger. Do not replace ordinary
application backups with this feature. No live history is deleted.

## One-time installation boundary

Use PostgreSQL 18 and the existing standalone version-7 gateway schema. Apply
`database/ollama-gateway-archive/20261016_120000_archive_jobs.sql` once to that
database as its schema owner. `current.sql` is the equivalent fresh schema;
do not apply both. This separate optional schema deliberately does not enter the
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

## Automatic behavior

- First archive after nonempty history; daily if changed; as early as hourly
  when bindings reach 80,000. The five-minute check does not imply a five-minute dump.
- Two verified copies, plus one replacement in progress, within 1 GiB total
  managed storage. Each dump is capped at 256 MiB. An additional 64 MiB free-space
  reserve is required; the archive budget does not include verifier scratch.
- Three attempts per source revision, with persistent five-minute/30-minute
  cooldowns. Attempts are independent of inference limits. Failed partial files
  count against the budget and are not silently erased.
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
eligibility and durable archive pins before any automatic purge can be enabled.
