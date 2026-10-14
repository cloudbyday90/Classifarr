# Evidence-based gateway completion recovery

Date: 2026-10-14. Implementation and synthetic local tests only.

## Decision and prerequisites

Keep the optional gateway disabled by default. Fix two unnecessary blocking cases
inside an already admitted request: cancellation while awaiting its database claim,
before upstream dispatch, and cancellation after a validated complete upstream
response but before recording completion. Neither case requires another inference.
Use a small ESM execution module shared by every compute route. No new dependency,
schema, identifier format, consent, scheduler or public recovery endpoint.

| Evidence held by the current owner | Action | What remains preserved |
| --- | --- | --- |
| Claim returned; cancellation observed before invoking transport | Complete that exact claim; return cancellation | Counted attempt, caller limits and existing cooldown |
| Transport returned a validated response after clean HTTP completion | Persist completion before checking cancellation again | Counted attempt; 429/503 cooldown; no response to revoked caller |
| Transport threw, response was incomplete, or claim result was lost | Keep the marker; do not replay | UUIDv7 request, start time and attempts |
| Process/session lost, owner/provider changed, or completion write failed | Fail closed; no in-memory evidence transferred to a new owner | Durable uncertainty and retry budgets |

Cancellation still aborts the actual transport immediately. No detached draining,
new grace period, inference retry or lock expiry is introduced. The only work after
cancellation is bounded database completion when the current invocation already
holds sufficient evidence. A claim failure may have committed remotely; it is not
treated as proof of non-dispatch. A crash can erase local evidence even before
dispatch, so restart must remain conservative.

## Boundaries and completion

The dedicated PostgreSQL session retains its advisory lock. Completion requires
the same provider hash, owner UUIDv7 and active request UUIDv7; a stale callback
cannot clear a later request. The UPDATE never decreases attempts or refunds
application budgets. No HTTP spans a database transaction. A known rejection is
not inference success; it only establishes that this request is finished.

Keep one compute slot, eight bounded foreground waiters, no background backlog,
32 handlers, 64 sockets and 120 incoming requests/minute. Retain the total request
deadline (maximum 300 seconds), 256 KiB body limit, 1 MiB generation limit, 4 MiB
embedding limit and existing stream limits. Database queries retain their bounded
CLI timeouts; no failed completion-write retry is added. The slot stays held until
completion settles. Status remains database-only and never probes the provider.

Clean HTTP completion and existing semantic validation are both required. An
isolated `done: true` chunk without EOF, an empty model listing, a socket close,
timeout, or elapsed age is insufficient. Cancellation after verified completion
must not return an answer or trigger a replacement call. Unsupported/permanent
rejections do not auto-retry; complete overload replies retain the five-second
persisted cooldown. Unknown/transient transport failures remain blocked.

## Research and alternatives

Official sources discovered and opened through MCP on 2026-10-14:

- [Ollama API](https://github.com/ollama/ollama/blob/main/docs/api.md) documents
  terminal generation responses and defines `/api/ps` as loaded-model inventory.
  Our inference: that inventory is not a per-request completion receipt.
- [Node.js 24 HTTP](https://nodejs.org/download/release/v24.14.0/docs/api/http.html)
  distinguishes fully parsed messages (`complete`) from destroyed requests;
  aborting a request destroys its local transport. Remote compute termination is
  not established by that local event.
- [PostgreSQL 18 locking](https://www.postgresql.org/docs/current/explicit-locking.html)
  documents session advisory locks and their release when the session ends. The
  durable marker, not that lock alone, protects unknown remote work after restart.

| Option | Pros | Cons |
| --- | --- | --- |
| Clear by age, restart or model listing | Fast availability recovery | No request-specific proof; risks overlapping inference; rejected |
| Drain after cancellation | May observe eventual completion | Continues unwanted compute and weakens revocation; deferred |
| Recover only locally proven completion/non-dispatch | Small auditable change; preserves cancellation and budgets | Cannot recover evidence lost during a crash; selected |

Recommended stack: existing Node HTTPS/private CA and network isolation, modular
ESM request execution, strict bounded response validation, PostgreSQL 18 UUIDv7
ledger and compare-and-set completion. No queue package or new service is needed.

## Verification and next item

Use real loopback HTTP and isolated PostgreSQL for claim/revocation races,
terminal responses, overload cooldown, failed completion, session/owner/provider
fencing and stale request IDs. Test buffered, streaming, warming and embedding
routes. Retain crash/restart and ambiguous-outcome tests. Rehearse packaged modules
in the existing network-none image fixture; no shared provider or production data.

Next: specify operator-verified provider quiescence and durable recovery receipts
for genuinely unknown requests, with exact request/provider binding and preserved
attempts. This requires trustworthy deployment-specific evidence; neither an
automatic restart of shared Ollama nor a blind clear-lock action is authorized.
