# Optional bounded gateway cleanup

This is a separate deployment for an optional gateway ledger, not an application
upgrade action. It deletes eligible gateway history only after protected restore
verification. It never calls Ollama or deletes classification/library records.
Keep ordinary application backups. See the [design](gateway-bounded-cleanup-design.md).

## Installation

Review the isolated rehearsal outcome for the exact image before enabling this
on a real gateway. Stop optional gateway/archive/cleanup workers for the one-time
installation. Apply `database/ollama-gateway-cleanup/current.sql` once, as a trusted
database administrator, to the existing gateway v7 plus archive v2 database.
The identical timestamped migration is an alternative, not a second step.
Do not apply this to Classifarr's ordinary database or reapply it after failures.
The transaction refuses running workers and a preexisting cleanup-owner role.

The extension creates a non-login `classifarr_gateway_cleanup_owner`. Never grant
membership in that role, enable its login, or give it superuser rights. Its
controlled routines are the only runtime history-deletion path. UPDATE/TRUNCATE
guards remain in place; existing archive roles do not receive history writes.

Provision a dedicated non-superuser login with a private password and these grants
(replace only the example database/login names):

```sql
CREATE ROLE gateway_cleanup_worker LOGIN;
GRANT CONNECT ON DATABASE gateway TO gateway_cleanup_worker;
GRANT USAGE ON SCHEMA ollama_gateway,gateway_archive,gateway_cleanup TO gateway_cleanup_worker;
GRANT SELECT ON ALL TABLES IN SCHEMA ollama_gateway,gateway_archive,gateway_cleanup TO gateway_cleanup_worker;
GRANT EXECUTE ON FUNCTION gateway_cleanup.admit(uuid,text,text,text),
  gateway_cleanup.execute_batch(uuid,integer),gateway_cleanup.reconcile(uuid)
  TO gateway_cleanup_worker;
GRANT USAGE ON SCHEMA gateway_cleanup TO gateway_archive_writer;
GRANT SELECT ON gateway_cleanup.operation TO gateway_archive_writer;
```

The archive writer's added access is read-only retry accounting. Restart it using
the same tested image as cleanup: old coordinators cannot cross the new
maintenance-exclusion guard. Existing verifier credentials/mounts are unchanged.
Use authenticated local-socket access; do not expose a trust-authenticated
administrator socket to any worker.

Create a UID/GID 1000, mode 0600 configuration file outside the repository:

```json
{
  "database": {
    "host": "/source-socket",
    "database": "gateway",
    "user": "gateway_cleanup_worker"
  },
  "providerHash": "<existing gateway provider SHA-256>",
  "retentionDays": 90,
  "archives": "/archives",
  "receipts": "/receipts"
}
```

Include the private password in `database` when authentication requires it.
Use the existing private archive/receipt directories and socket path. Set
`CLASSIFARR_GATEWAY_CLEANUP_CONFIG` and the archive image/path variables, then
explicitly start `docker-compose.gateway-cleanup.yml`. It is never included by
normal Compose. The worker has no network, Docker socket, provider credentials,
or writable archive mount: 256 MiB, half CPU, 32 PIDs, no swap, read-only root.

## Automatic behavior and recovery

One assessment every five minutes, at most 100 records, only at 80,000 or more
resident bindings. Records must be terminal and older than the configured window
(minimum 90 days). Full file/receipt/marker validation happens before short SQL
transactions. SQL statements have a one-second deadline; contended locks yield.
No provider work or broad table rewrite runs during cleanup.

One operation per exact batch has three lifetime attempts and persisted
five-minute/30-minute cooldowns. The worker closes an uncertain connection; a
later session must acquire exclusive cleanup ownership and reconcile the durable
operation. A committed operation is never deleted again. A rolled-back attempt
keeps its consumed budget. Cancellation follows the same recovery path.

The `gateway_cleanup.operation` record identifies the protected pair, exact batch,
actual deletion counts and completion. `confirmed_at` is set only by a later
transaction observing committed deletion. Future expiry must use that timestamp
plus at least 30 days. **No expiry or archive-unprotection exists in this version.**
Keep the whole maintenance catalog backed up separately; the inference-only dumps
do not contain it. Never remove markers or edit attempts/holds to make progress.

Missing/tampered evidence, exhausted attempts, unknown state, old/incompatible
workers, insufficient archive space or source drift blocks cleanup. Logs use
bounded state/reason codes, not credentials or record bodies. Repeated unchanged
states do not produce repeated log lines. Classification remains independent.
The 1 GiB budget can limit this to a few batches; deletion relieves the resident
binding limit but does not guarantee smaller operating-system database files.

## Verification

Use the ordinary gateway integration suite and the online archive rehearsal's
cleanup scenario against an immutable local image. No production fixture or
release activation is implied. The [outcome](gateway-bounded-cleanup-outcome.md)
records actual results and remaining limits.
