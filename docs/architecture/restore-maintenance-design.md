# One-shot configuration restore maintenance

## Decision

Date: 2026-09-30. Implement the encrypted configuration-restore component of the
selected embedded privilege-separation design. This is an explicit administrative
command, not an HTTP endpoint, daemon, automatic retry or production role cutover.
Existing backup/restore UI behavior, image entrypoint and saved templates stay intact.

## Why this component

The application and embedded PostgreSQL currently share an OS identity and an
administrator database role. Changing a SQL username alone cannot isolate them.
External-mode runtime admission already refuses privileged roles and in-process
restore, but a separate configuration restore command was missing. The existing
isolation drill covered database dumps, not the application's encrypted JSON backups.

We need that maintenance path before switching normal runtime credentials. The
new command reuses the existing restore transaction, exclusive admission session,
durable quarantine and verification receipt. It does not invent legacy ownership.

## Official evidence and tradeoffs

Sources discovered and checked on 2026-09-30:

- PostgreSQL recommends a dedicated database OS account separate from other
  daemons and executable ownership. [PostgreSQL 18 account guidance](https://www.postgresql.org/docs/18/postgres-user.html).
- Local peer authentication uses kernel-reported OS identity, optionally mapped to
  SQL roles. It is useful only with genuine OS separation and protected files.
  [PostgreSQL 18 peer authentication](https://www.postgresql.org/docs/18/auth-peer.html).
- Node child processes can run without a shell and with explicitly supplied
  environments. The drill uses fixed executables/arguments, an environment
  allowlist, bounded output and termination deadlines.
  [Node child-process documentation](https://nodejs.org/api/child_process.html).
- Unraid retains user container settings in saved templates. We cannot assume
  publishing an image replaces an existing installation's launch configuration.
  [Unraid application documentation](https://docs.unraid.net/unraid-os/manual/applications/).
- Future maintenance UI status must be available to assistive technology, not just
  color or an icon. This slice changes no UI and makes no WCAG conformance claim.
  [W3C status-message guidance](https://www.w3.org/WAI/WCAG21/Understanding/status-messages).

| Approach | Pros | Cons / decision |
| --- | --- | --- |
| Continue privileged restore inside the HTTP runtime | Existing workflow needs no migration | Retains privileged network-facing process; compatibility only |
| One-shot restore plus embedded separate identities | No additional service required; bounded authority lifetime; existing backup format | Requires trusted provisioning, protected code and a reviewed handoff; selected staged design |
| Separate database/maintenance services | Clearer process/filesystem boundary | Requires deployment and volume migration; optional for managed deployments, not an automatic Unraid fix |

The selected design adds process-start overhead, but no permanent worker. Parsing
and decrypting a backup creates transient memory copies. Neither small synthetic
test timings nor the 2 GiB drill cap establish production capacity.

## Command and trust contract

Run `node src/scripts/runDatabaseRestoreMaintenance.mjs --apply` from the server
directory using a trusted maintenance identity, with **every normal instance
stopped**. Feed one JSON object through a protected stdin pipe:

```json
{
  "version": 1,
  "mode": "replace",
  "backup": { "encrypted": true, "data": "BASE64_FROM_EXISTING_BACKUP" },
  "password": "SUPPLIED_THROUGH_PROTECTED_STDIN"
}
```

`mode` must explicitly be `replace` or `merge`. Plaintext legacy backups are also
accepted as `backup`, with no password. The input protocol is version 1; the inner
backup retains its existing version and schema. Do not place real passwords or
backup contents in argv, environment variables, shell history, logs or repository
files. If a protected request file is used, restrict its access and remove it
after use: it contains the decryption password, so encryption of the nested backup
does not protect that file. Database credentials remain the trusted launcher's
responsibility; this command does not grant itself privileges.

The command accepts no filename, SQL, shell command, role override or target path
in its input. Limits: 64 MiB input, 10-second input deadline, 4,096-character
password maximum, 30-second statement, 5-second lock, 10-second idle transaction,
120-second transaction and a 180-second process watchdog. The watchdog needs a
responsive event loop; the trusted launcher must also enforce an external kill
deadline (200 seconds in the disposable probe). Larger or slower
restores need an explicitly reviewed future streaming/batching design, not a
silent limit bypass. JavaScript strings are not guaranteed to be erased from RAM.

Sequence:

1. Read/decrypt/validate the envelope and portable references before loading DB code.
2. Acquire the existing exclusive runtime and restore locks on one pinned session.
   Participating normal workers hold shared admission for their entire process.
3. Set bounded session settings, establish durable restore quarantine, then perform
   the existing table restore transaction. No new API key is generated by this
   headless path; existing login/API credentials are preserved.
4. Verify sequentially on that session; persist the verification receipt and ready
   gate atomically. Destroy the session and close the pool before reporting success.

Only a sanitized JSON status is returned. Exit codes: `0` verified, `2` invalid
invocation/input, `75` active normal/maintenance owner, `1` execution/cleanup failure.
No automatic retry follows any outcome. A process kill or uncertain commit leaves
the durable gate authoritative. Explicit retry can recover only this session-aware
restore protocol; unknown legacy gates remain blocked.

## Compatibility, rollout and rollback

The HTTP restore path still generates its expected API key. Encryption bytes,
PBKDF2 parameters and AES-GCM format remain unchanged. Pure backup crypto no longer
depends on logging/runtime imports. Headless restore does not initialize the
application's API-key secret store; only the HTTP composition supplies the key
factory. Sequential verification also fixes overlapping
queries on the shared PostgreSQL client for the existing restore path.

No schema migration, environment/template edit, role grant or live-container
restart is required for this component. It does **not** activate restricted
production credentials or automatically restart an application after restore.
Ordinary Docker image rollback remains possible; never clear a failed restore
gate merely to make the previous image start. Inspect/retry the restore instead.

A saved non-root Compose container with `no-new-privileges`, dropped capabilities
and a read-only root cannot acquire a second OS identity merely by updating its
image. The next provisioning design must detect such constraints honestly, retain
supported compatibility behavior, and never label shared-UID operation isolated.

## Validation and recommendation stack

1. Keep this production maintenance command and its real encrypted-restore,
   active-worker, wrong-password, SIGKILL, explicit retry and legacy-gate tests.
2. Next: implement the **embedded provisioning and handoff contract**. Prove root
   and non-root launch detection, PUID/PGID, legacy volume ownership, immutable
   code/HBA, interrupted upgrades and supervisor-controlled maintenance before
   changing runtime credentials. The HTTP process must never receive admin secrets.
3. Then complete enforced writer capabilities and old-writer reconnect rejection
   before enabling automatic legacy ingestion recovery. Time alone is not evidence
   that an unknown writer has stopped.

See [validation outcome](restore-maintenance-outcome.md) for measured results and
remaining limits. No release is created by this work.
