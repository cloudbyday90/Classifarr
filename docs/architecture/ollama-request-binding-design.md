# Durable provider-instance references for gateway requests

Date: 2026-10-15. Optional standalone gateway, local synthetic validation only.
No Unraid/shared Ollama change, automatic activation, retry, recovery or release.

## Decision and prerequisites

Persist an immutable request-binding record in the same database statement that
claims an attempt, before provider transport. Optional administrator configuration
supplies the Docker daemon-ID hash, full container ID, immutable image ID and exact
start timestamp. Preserve nanoseconds as text, not PostgreSQL microsecond time.
The upstream hash, owner, installation, attempt and UUIDv7 request identify the
admission that used this configuration. No prompts, answers, URLs or credentials.

This records **configured intent**, not proof of the actual responding container.
Evidence is `administrator_configured`, never machine-verified. Without pins it is
`unbound`; old pending requests without a record remain `legacy_unbound`. Do not
retroactively bind them to the current container. A Docker observation alone is
not permission to upgrade evidence or clear an uncertain request.

Fresh Classifarr installations do nothing. Only an explicitly configured standalone
gateway uses its own PostgreSQL 18 database. Gateway schema version 3 and current
binaries are required. Stop the gateway and back up its separate database before
the timestamped upgrade. Versions 1/2 cannot claim against version 3. Existing
attempts, active request, cooldowns, recovery receipts and holds are preserved.

## Atomicity, ownership and limits

One data-modifying CTE updates the fenced singleton claim and inserts the binding.
Failure rolls both back; successful acknowledgement precedes transport. Set
session synchronous commit on. If the response is lost, assume the claim may have
committed: no retry, no provider dispatch, reconnect and inspect. Cancellation
after claim but before dispatch uses existing non-dispatch cleanup and retains the
binding and counted attempt. Unknown transport/completion outcomes remain blocked.

Completion checks request, provider and gateway owner, including the append-only
binding's original owner. Restart can inspect old evidence but cannot complete it
under a new owner. Configuration pins are process-fixed; credential-only reload
cannot repin or remove them. Caller bodies/headers never select the binding.
Offline recovery inspection returns the original binding even after a new gateway
configuration starts. Recovery authorization remains independently human-reviewed.

Existing one-flight concurrency, caller attempts, cooldown, 32 handlers, 256 KiB
request limit, bounded response/stream and 1–300 second compute timeouts remain.
No HTTP or Docker I/O occurs in a database transaction or status read. Binding
history has a 100,000-record admission limit with a monotonic counter, avoiding a
full-table count per request. At capacity compute fails closed (`history_full`);
completion/recovery/status remain available. No automatic purge or counter reset.
Retention/archiving requires a later reviewed design. Existing legacy attempts do
not consume fictional binding records. Native PostgreSQL UUIDv7 identifies new
records; the request ID is also unique and UUIDv7.

Use column-scoped admission grants, SELECT/INSERT (not UPDATE/DELETE/TRUNCATE) for
runtime binding access, SELECT only for offline recovery. Append-only triggers
provide defense in depth, not protection against a schema owner or compromised
trusted runtime inventing declarations. No Docker socket enters the gateway or
Classifarr. The current read-only observer remains a separate administrator tool.

## Options, tradeoffs and recommendation stack

| Option | Benefit | Cost / limitation | Decision |
| --- | --- | --- | --- |
| Infer old work from the latest Docker snapshot | No schema work | Can associate a request with the wrong start instance | Reject |
| Atomic immutable configured binding | Durable reference before dispatch; preserves uncertainty | Declared intent, bounded history and schema upgrade | Implement |
| Docker socket inside gateway | Direct observation | Privileged authority; observation still races lifecycle/transport | Reject |
| Exclusive lifecycle supervisor and isolated ingress | Can support verified instance/stop evidence | New authority, dispatch fencing and deployment boundary | Next |

Stack: strict modular ESM configuration, PostgreSQL 18 atomic claim/binding writes,
UUIDv7, fixed configuration per process, bounded append-only history and existing
offline recovery. Next bind actual transport to an exclusively controlled provider
instance before any machine-authorized recovery. Do not auto-clear legacy work.

## Completion and tests

Prove migration/fresh-schema parity, v2 refusal, preserved legacy uncertainty,
atomic rollback, lost acknowledgement, cancellation, transport failure, restart,
credential reload refusal, role boundaries, history exhaustion and UUIDv7 with
real isolated PostgreSQL/HTTP. Show the record is visible when provider HTTP first
arrives. Rehearse packaged entrypoints and inspect the original binding after
interruption. Rebuild local Compose without cache; preserve disabled defaults.
Record exact results and remaining limitations in a separate outcome document.

## Official research

Discovered and opened through MCP on 2026-10-15; choices above are design inferences.

- [PostgreSQL RETURNING](https://www.postgresql.org/docs/18/dml-returning.html):
  use returned modified rows to connect the claim and inserted record.
- [PostgreSQL consistency and locks](https://www.postgresql.org/docs/18/applevel-consistency.html):
  locks protect database state, not external provider lifecycle after commit.
- [PostgreSQL 18](https://www.postgresql.org/docs/18/release-18.html): native
  time-ordered UUIDv7 identifiers.
- [Docker daemon security](https://docs.docker.com/engine/security/): keep daemon
  authority separate from application HTTP handling.
- [Docker live restore](https://docs.docker.com/engine/daemon/live-restore/): daemon
  loss cannot establish that provider work stopped.
