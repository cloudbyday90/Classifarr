# Queue task correlation for gateway work

Design, 2026-10-15. Optional gateway only; local synthetic validation. No release,
production rollout, Unraid change, new inference, or automatic recovery.

## Problem and decision

A gateway attempt has a UUIDv7 and installation owner, but its record cannot yet
identify the application queue task that initiated it. Add a bounded diagnostic
source reference from the queue processor through the existing provider context
to the immutable gateway request binding. Preserve gateway-generated ownership:
the source reference is a caller assertion, not proof of a valid claim or consent.

Only persisted top-level task ID, allowlisted task type and queue attempt count
are eligible. Never read these values from payloads or incoming application HTTP
headers. Do not propagate claim tokens, titles, media IDs, prompts, credentials or
arbitrary baggage. Existing numeric task IDs remain references, not new primary
keys. Gateway request/binding IDs continue using native PostgreSQL UUIDv7.

## Research and options

Official sources discovered and read through MCP on 2026-10-15:

- [Node.js async context](https://nodejs.org/download/release/v24.16.0/docs/api/async_context.html)
  recommends `AsyncLocalStorage.run()` over `enterWith()` for scoped work. Use a
  small module with a per-invocation lifetime, not mutable global current-task state.
- [OpenTelemetry context security](https://opentelemetry.io/docs/concepts/context-propagation/)
  warns about forged incoming context and sensitive outgoing baggage. Apply strict
  parsing and a narrow allowlist; do not forward the application source to Ollama.
- [PostgreSQL UUID functions](https://www.postgresql.org/docs/current/functions-uuid.html)
  supplies time-ordered UUIDv7. Keep identity generation at durable admission; do
  not replace it with caller-supplied queue IDs.

| Option | Advantages | Costs / risks | Choice |
| --- | --- | --- | --- |
| Thread new parameters through every AI call | Explicit dependencies | Broad signature churn; easy to miss streaming, embedding or warming paths | Defer |
| Scoped task context plus explicit gateway header | Small integration boundary; concurrent tasks stay separate | Must test escaped callbacks and context lifetime | Implement |
| General tracing/baggage SDK | Wider observability ecosystem | New dependencies and export/privacy policy beyond this task | Defer |

Recommended stack: existing ESM queue processor + native AsyncLocalStorage + a
strict versioned source header between application and gateway + PostgreSQL
append-only request binding. No new dependency or application database migration.

## Contract

1. Enter a new diagnostic scope for each queue processor invocation. Snapshot the
   eligible fields and freeze them. Invalid/incomplete legacy task metadata means
   no source reference, not a classification failure. End the scope in `finally`;
   detached callbacks must not retain a finished task reference. Nested tasks
   restore their parent context and unrelated tasks cannot inherit it.
2. At each gateway provider-context request, read the current active source, not
   the context present when a reusable client was created. Only compute requests
   carry it. Call options cannot override the source selected by the queue scope.
3. The gateway client sends one bounded canonical base64url JSON source header.
   The server authenticates first, rejects duplicate/malformed/extra fields and
   source headers on inspection routes before admission. Ownership/installation
   still come exclusively from the gateway credential and durable UUIDv7 claim.
4. Store source kind `queue_task`, canonical positive bigint decimal task ID,
   allowlisted type and nonnegative 32-bit queue attempt in the same SQL statement
   that admits compute. Gateway attempts remain separate and monotonic. The source
   does not change content fingerprints; identical inputs from different tasks
   may have matching fingerprints but always different attempt IDs.
5. Source context stays in the gateway database and application-to-gateway link.
   Do not include it in prompts, provider headers, status responses or general
   logs. Existing offline binding inspection exposes it as diagnostic-only data.

## Failure, bounds and migration

No source creates new work or changes route, credential, cooldown, timeout, queue
capacity, concurrency-one admission, attempt limits or the 100,000-binding cap.
Malformed remote metadata is a permanent 400 refusal with zero provider calls or
attempts. Admission/transport/completion failure, cancellation, revocation,
restart and unknown results retain the existing rules; source metadata never
authorizes retries, cancellation, result reuse or provider lifecycle control.
No HTTP request runs inside a database transaction.

Standalone schema v6 adds nullable source columns and exact-shape constraints.
Upgrade only a stopped/backed-up v5 gateway under the existing advisory lock;
preserve old records, active request, attempt count, cooldown and recovery receipts.
Old writers are fenced by version. Do not invent historical task correlations.
Fresh application installations still do not initialize or enable the gateway.

## Completion and next step

Verify concurrent/nested scopes, asynchronous rejection and detached work; numeric
boundaries; spoofed payloads/options/headers; generate/stream/embed/warm transport;
real HTTP plus isolated PostgreSQL persistence, legacy migration and restart.
Exercise the packaged image using existing isolated runners and evaluate a no-cache
local Compose rebuild without changing the shared provider.

Next: bounded read-only task-to-gateway history diagnostics and a reviewed routing
rollout. Scheduler/study operations outside queue tasks stay explicitly uncorrelated
until their own stable source contract exists; never label them as a nearby task.
