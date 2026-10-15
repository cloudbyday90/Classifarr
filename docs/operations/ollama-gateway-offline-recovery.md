# Offline gateway recovery procedure

Unreleased, 2026-10-15. Optional standalone gateway only. Do not apply these steps
to the Classifarr application database. The feature is not enabled on Unraid or
shared Ollama. This document does not establish that any real provider stopped.

## Before recovery

An uncertain request may still be running or may already have completed. Do not
retry it merely because it is old, a connection closed, or `/api/ps` looks empty.
If there is no uncertain request, no recovery is needed. Ordinary successful
completion and undispatched cancellation already have their own bounded cleanup.

1. Arrange downtime with **every** consumer of the provider. Stop the gateway.
2. Isolate all provider ingress, including alternative addresses, direct clients,
   IPv4/IPv6, local access and other installations. Disable automatic restarts
   from Docker, supervisors, watchdogs and scheduled jobs.
3. Stop and independently verify **all** provider instances, worker processes and
   runners. An inaccessible Docker daemon or one stopped container is not proof.
   Keep them stopped and isolated through the separate resume review. If scope
   cannot be established, stop here and retain uncertainty.
4. Record the checks in an administrator-controlled incident record outside this
   database. Use a short reference, not raw logs or secrets. The CLI records a
   human attestation; it cannot validate that those checks were truthful.

Never use this process to bypass caller consent, memory safeguards, quotas or
attempt limits. Do not clear markers manually or infer that abandoned work failed.

## Standalone schema and role setup

Back up the dedicated gateway database first and verify the backup is readable.
For an existing version-1 database, stop the gateway and apply once as schema owner:

```text
psql -v ON_ERROR_STOP=1 -d <dedicated-gateway-database> -f database/ollama-gateway/20261014_224242_offline_recovery.sql
```

For an existing version-2 database (including after the step above), apply once:

```text
psql -v ON_ERROR_STOP=1 -d <dedicated-gateway-database> -f database/ollama-gateway/20261015_091627_request_binding.sql
```

For an existing version-3 database (including after those steps), apply once:

```text
psql -v ON_ERROR_STOP=1 -d <dedicated-gateway-database> -f database/ollama-gateway/20261015_095721_provider_stop.sql
```

For an existing version-4 database (including after those steps), apply once:

```text
psql -v ON_ERROR_STOP=1 -d <dedicated-gateway-database> -f database/ollama-gateway/20261015_104932_upstream_peer.sql
```

For an existing version-5 database (including after those steps), apply once:

```text
psql -v ON_ERROR_STOP=1 -d <dedicated-gateway-database> -f database/ollama-gateway/20261015_113726_task_source.sql
```

The upgrades refuse a competing gateway session. They preserve its request,
attempts, cooldown and ownership. They create no application tables and make no
provider calls. New empty standalone databases use `database/ollama-gateway/current.sql`
instead. Use version-6 gateway/recovery binaries with schema version 6; older
binaries fail closed. No binding is fabricated for pre-upgrade work. Do not downgrade or restore an
old ledger to bypass a hold: retain the backup and investigate offline.

Use separate non-owner, non-superuser, non-inheriting runtime/recovery roles, with
database CONNECT and no role membership that restores broader grants. Substitute
the actual administrator-created role names for these examples. On upgrade,
**revoke the old table-wide UPDATE grant**, including inherited grants, before
starting the gateway. Otherwise new columns inherit those broad privileges.

```sql
GRANT USAGE ON SCHEMA ollama_gateway TO gateway_runtime, gateway_recovery;
GRANT SELECT ON ollama_gateway.admission TO gateway_runtime, gateway_recovery;
REVOKE UPDATE ON ollama_gateway.admission FROM gateway_runtime;
GRANT UPDATE(owner_id, provider_hash, active_request, installation, started_at,
  attempts, completed_at, cooldown_until, binding_count)
  ON ollama_gateway.admission TO gateway_runtime;
GRANT UPDATE(active_request, installation, started_at, maintenance_receipt, last_recovery_receipt)
  ON ollama_gateway.admission TO gateway_recovery;
GRANT SELECT, INSERT ON ollama_gateway.recovery_receipt TO gateway_recovery;
GRANT SELECT, INSERT ON ollama_gateway.request_binding TO gateway_runtime;
GRANT SELECT ON ollama_gateway.request_binding TO gateway_recovery;
GRANT SELECT, INSERT ON ollama_gateway.upstream_peer_observation TO gateway_runtime;
GRANT SELECT ON ollama_gateway.upstream_peer_observation TO gateway_recovery;
GRANT SELECT ON ollama_gateway.provider_stop_intent,
  ollama_gateway.provider_stop_observation TO gateway_recovery;
```

Do not grant receipt/binding UPDATE/DELETE/TRUNCATE or schema ownership. Their triggers
also reject modification/deletion by ordinary users; privileged DBAs can override
database controls, so retain the external incident record. Recovery does not need
provider tokens, gateway bearer tokens, Docker access or application DB access.

## Private configuration and inspection

Create a private JSON file outside the repository, mode 0600 on Linux or restricted
user ACL on Windows, inside a private directory. Maximum size: 64 KiB. Linux
rejects a final symlink. Use a local socket/loopback DB or verified database TLS.
Obtain `providerHash` from the exact configured gateway's ledger and check it
against that provider binding; do not substitute another provider to clear a slot.

```json
{
  "database": {
    "host": "/var/run/postgresql",
    "database": "gateway_test",
    "user": "gateway_recovery"
  },
  "providerHash": "REPLACE_WITH_EXACT_64_CHARACTER_PROVIDER_HASH"
}
```

Set `CLASSIFARR_GATEWAY_RECOVERY_CONFIG_FILE` to this file. Then run:

```text
node server/src/scripts/recoverOllamaGateway.mjs inspect
```

In a packaged container the entry point is `/app/src/scripts/recoverOllamaGateway.mjs`.
Inspection changes no durable state, obtains the gateway's exclusive database
lock, and prints `expected`, `latestReceipt`, `requestBinding` and `providerStop`. It never contacts Ollama.
`gateway_recovery_gateway_running` means stop and verify the intended gateway;
do not terminate arbitrary database sessions to bypass the check.

`requestBinding` preserves the admitted request's original configured provider
instance, including after acknowledgement/resume. `administrator_configured` is
not a stop attestation. `unbound` means no pins were configured; `legacy_unbound`
means the old request has no binding record. None authorizes recovery. Do not
substitute a newer provider snapshot or infer missing evidence from a current
container. Review the entire provider boundary independently in every case.

`requestBinding.transportEvidence` is null for historical/HTTP work, or records
the authenticated TLS peer's certificate/key hashes and observation time. It is
not proof of HTTP dispatch, completion, Docker ownership or a stopped provider.
It never authorizes recovery. See [upstream identity](ollama-upstream-identity.md).

`providerStop` is the optional [reviewed stop controller](ollama-provider-stop.md)
journal, not recovery authority. An intent without an observation means the stop
outcome is unknown. Establish that any pending Docker operation has settled before
acknowledgement or restart. A historical observation does not prove the provider
is still stopped; independently verify the entire boundary again.

## Acknowledge verified stop

Copy the exact `expected` object from inspection into a **separate private review
file**. Do not edit its identities or attempt count. Use this shape, with real
review references and the UTC time at which you verified the stopped state:

```json
{
  "version": 1,
  "action": "acknowledge-stop",
  "expected": {},
  "operatorRef": "admin-alias",
  "evidenceRef": "incident-reference",
  "observedAt": "2026-10-14T22:00:00.000Z",
  "assertions": {
    "ingressIsolated": true,
    "allProviderRunnersStopped": true,
    "automaticRestartDisabled": true,
    "administratorVerified": true
  }
}
```

The empty object and historical timestamp above are intentionally not executable
approval. Complete the real checks first; never automate filling `true` in live
use. Aliases/references allow only letters, digits, `_`, `-`, `.` (64/96 characters).
No URLs, raw logs, credentials or response bodies. Stop observation must be after
the admitted request and within the last 15 minutes; freshness alone proves nothing.

Set `CLASSIFARR_GATEWAY_RECOVERY_REVIEW_FILE` to the private review file, then run:

```text
node server/src/scripts/recoverOllamaGateway.mjs acknowledge-stop
```

Success returns a UUIDv7 `receiptId` and `state: maintenance`. The old request is
retained in an append-only receipt as `administrator_attested`, not successful.
Attempts and cooldowns are unchanged. Restarting the gateway leaves compute and
upstream inspection blocked; authenticated gateway status remains available.

## Separate resume

Keep provider isolation in place. Stop any gateway accidentally restarted during
maintenance. Inspect again: a gateway restart changes ownership, invalidating an
older review. Prepare a new private review with `action: resume`, the new exact
`expected` (including the held receipt), new references/time, and these assertions:

```json
{
  "providerIsolationMaintained": true,
  "controlledRestartReviewed": true,
  "noRequestReplay": true,
  "administratorVerified": true
}
```

Run `node server/src/scripts/recoverOllamaGateway.mjs resume`. This appends a
second UUIDv7 receipt and removes the hold; it does not start anything, replay the
old request, refund budgets, or clear cooldowns. `resumed` does not mean the
provider is healthy or the cooldown expired. Restore the reviewed network and
provider lifecycle deliberately, then start the gateway. Existing caller policies
decide whether any new request is allowed. Never open a temporary direct bypass.

## Refusal, interruption and unknown commit

- Changed snapshot, provider or ownership: inspect and redo the human review.
  Never copy a new snapshot into an old approval without rechecking it.
- Invalid/stale observation or missing assertions: redo the relevant checks.
- Database failure or cancellation: no automatic retry. Inspect state first.
- `gateway_recovery_commit_unknown`, process death, or the 20-second deadline:
  the commit may have succeeded. Reconnect and inspect `latestReceipt` and the
  hold before taking another action. A stale document is deliberately rejected.

All SQL is bounded and parameterized. No HTTP request occurs inside a transaction.
For design tradeoffs and the next lifecycle-supervisor opportunity, see the
[design](../architecture/ollama-gateway-offline-recovery-design.md).
