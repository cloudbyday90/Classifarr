# Ollama gateway: authenticated clients and streaming

Status: approved local-only implementation slice, 2026-10-14. Extends the
[admission design](shared-ollama-admission-design.md); no production activation.

## Decision and scope

Implement a shared authenticated client, bounded NDJSON streaming and explicit
dependency injection into the description and embedding study clients. Those
clients retain their existing model/digest checks, request bounds, cancellation
and attempt reservations. No environment switch or saved setting reroutes live
clients. Fresh installs do nothing. Existing direct calls remain unchanged when
no gateway dependency is supplied. No new database/table is needed; the existing
time-based UUIDv7 ledger stays authoritative.

The primary streaming classifier, warming, model administration and readiness
paths remain a later integration step. Their different timeout, model-name and
partial-result contracts must not be silently changed by a global HTTP proxy.
This slice proves the common client and actual study adapters locally, not
whole-provider coordination or deployment readiness.

## Failure and completion contract

- Credentials stay in a server-side client closure, never a URL or response.
  The prototype client accepts only a loopback gateway. It binds to an expected
  upstream origin and sends its hash; a differently configured gateway rejects
  it before admission. Fixed routes and body allowlists apply on both sides.
  No redirects, ambient proxy, direct fallback, model pulls or generation retries.
- One active compute request; existing foreground queue, persisted cooldown and
  attempt rules stay unchanged. Caller cancellation/deadlines include waiting
  and streaming. An attempt is never refunded after dispatch.
- Stream incrementally with strict UTF-8 and JSON validation, at most 1 MiB total,
  64 KiB per record and 8,192 records. Validate model identity and `done` on every
  record; reject errors, remote-model indicators, duplicate final records and
  data after completion. Respect downstream backpressure under the same deadline.
- Forward partial records, but hold `done: true` until clean upstream EOF and the
  durable completion write succeed. Otherwise clients that stop reading on `done`
  could abort before persistence. A final JSON record alone is not clean EOF.
- Before response headers, failures return sanitized JSON/status. After streaming
  starts, failures terminate the connection without a fabricated final record.
  Partial output must never be mistaken for verified completion.
- Cancellation, timeout, broken stream, session loss and failed completion writes
  retain the durable unknown-outcome marker. Restart never clears it. Known
  terminal overload responses retain the existing five-second cooldown.
- The client enforces its own body/response/deadline bounds and strict stream
  completion, and never includes raw provider errors or credentials in errors.
  Its explicit close cancels in-flight work and rejects future requests.

## Options and recommendation stack

| Option | Pros | Cons / decision |
| --- | --- | --- |
| Buffer the whole generation | Simple completion ordering | Removes token progress; reject for streaming |
| Blindly pipe provider bytes | Little code; preserves bytes | Cannot validate completion or control final-message ordering; reject |
| Bounded record relay and explicit client injection | Preserves progress, model checks and durable completion | More protocol tests; selected |
| Automatically reroute every Ollama call | Broad coverage quickly | Risks credential leakage, bypasses and changed warming/partial-result behavior; defer |

Recommended stack: small ESM parser/client/relay modules, existing Node HTTP
transport, the PostgreSQL 18 UUIDv7 ledger and unchanged installation-local
consent/attempt/memory safeguards. No extra broker or dependency is necessary.
Availability remains deliberately limited after uncertain execution. Cross-host
TLS, revocation/cutover and evidence-based uncertainty recovery are prerequisites
to production use, not bypasses to implement in this slice.

## Research and acceptance

Official sources discovered/opened through MCP on 2026-10-14:

- [Ollama API](https://github.com/ollama/ollama/blob/main/docs/api.md) documents
  multiple generation records and final `done`/statistics. Our persistence-before-
  final-forwarding rule is a design inference, not an Ollama acknowledgement API.
- [Node.js streams](https://nodejs.org/download/release/v24.20.0/docs/api/stream.html)
  requires stopping writes after backpressure until drain. Unbounded socket
  writes can retain memory; retain byte limits and abortable drain waits.
- [OWASP REST security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
  supports authenticated encrypted transport and keeping credentials out of URLs.
  This loopback-only test boundary does not establish secure cross-host transport.

Acceptance: unit parsing/backpressure/credential tests; real HTTP and isolated
PostgreSQL completion, disconnect, trailing-data and lost-write tests; actual
study adapters against synthetic models; packaged no-network image rehearsal;
no-cache local Compose health and unchanged consent/security settings. Record
outcomes separately. No real provider inference, Unraid change, release or PR
merge. Enumerating open repository PRs returned none for this iteration.
