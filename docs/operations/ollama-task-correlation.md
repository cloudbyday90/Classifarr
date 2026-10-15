# Gateway queue-task diagnostics

Unreleased, 2026-10-15. Optional gateway; not enabled on Unraid/shared Ollama.

## What is recorded

Gateway schema v6 adds a nullable source reference to each immutable request
binding: `queue_task`, task ID, task type and queue attempt. Installation and
gateway UUIDv7 remain separately recorded. Queue attempts and gateway attempts
are different counters: one queue task can make several provider requests.

The queue processor supplies only persisted top-level fields. No task payload,
claim token, title, media identifiers or incoming application headers are copied.
Numeric legacy task IDs are stored as exact decimal references; no existing task
IDs change. Unsupported/missing task fields produce an uncorrelated request.
Outside queue processing, requests remain uncorrelated rather than borrowing an
unrelated task. Reusable clients read the active scope at request time.

The application sends a strictly validated, at-most-256-character source header
only to the gateway for compute. It is not sent onward to Ollama or added to the
prompt. The gateway authenticates before reading it. Malformed, duplicate and
inspection-route source headers are refused before admission. An authenticated
client could still assert a misleading valid reference: it is diagnostic data,
not verified queue ownership, consent, completion, retry or stop permission.

## Upgrade and inspect

Follow [standalone migration and role setup](ollama-gateway-offline-recovery.md).
Stop/back up the dedicated gateway database and apply the timestamped v5-to-v6
migration; do not apply it to the Classifarr application database. Existing
bindings, cooldowns, attempts and unknown requests are preserved. Historical
source columns remain null. The application update does not run this migration.

The existing offline `recoverOllamaGateway.mjs inspect` command performs no
provider I/O and exposes the active binding's `workIdentity.source` when known.
Its `authority` is always `diagnostic_only`. For completed history, an authorized
operator can use a parameterized, read-only query in the dedicated gateway DB:

```sql
SELECT request_id, installation, admitted_at, attempt AS gateway_attempt,
       source_task_id, source_task_type, source_attempt, operation, model
FROM ollama_gateway.request_binding
WHERE installation = $1 AND source_task_id = $2
ORDER BY admitted_at DESC
LIMIT 50;
```

These are SQL bind parameters, not shell substitutions or literal psql arguments.
The existing 100,000-binding cap bounds this first diagnostic query; no public
history endpoint or additional index is introduced. Always include installation:
local and Unraid databases may have identical numeric task IDs. A gateway shared
across databases must give each installation distinct credentials/identity.

Do not clear an uncertain request because its task finished, disappeared or was
retried. Its provider work may still exist. Source references and matching content
fingerprints do not permit deduplication, cancellation or automatic replay.

See [design/tradeoffs](../architecture/ollama-task-correlation-design.md) and
[verification outcome](../architecture/ollama-task-correlation-outcome.md).
