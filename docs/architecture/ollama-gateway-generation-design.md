# Ollama gateway generation integration

Status: local-only implementation, 2026-10-14. Extends the
[streaming contract](ollama-gateway-streaming-design.md).

## Decision

Reuse the primary generation leaf functions through an explicit, private gateway
dependency. Add a small configuration-bound generation factory and use it from
the saved-verification factory when that dependency is supplied. Do not add an
environment switch, change the application singleton, start a gateway, or reroute
Unraid. Fresh installations and callers without the dependency do no new work.
This is transport integration, not whole-provider cutover: classification orchestration,
warming, embeddings and model administration still need a coordinated activation design.

Bind each factory to one saved upstream and exact model (an absent tag means
`:latest`, never an arbitrary installed tag). Preflight, version, probe and
generation all use the authenticated client. Do not cache gateway preflight;
read the current exact model/digest, reject duplicates, and reject model overrides.
Configuration changes require closing the old factory and constructing a new one.
Closing cancels active calls; closed factories never fall back to direct HTTP.

## Completion and failure contract

- Keep the existing one-compute-request admission, bounded foreground queue,
  persisted five-second overload cooldown and UUIDv7 ownership/attempt ledger.
  No new schema, attempt reset, retry or unknown-outcome recovery is introduced.
- Buffered generation uses its existing default 120-second timeout; streamed
  generation uses the caller's hard timeout, capped at 300 seconds. The gateway's
  independently configured timeout may be shorter. Preflight is inside streaming
  initial/hard budgets and receives cancellation. All inspection requests are
  capped at 300 seconds; existing 256 KiB request / 1 MiB response bounds apply.
- Strict completion disables both partial-on-abort and partial-on-stall. A strict
  external controller must reject partial stalls, because the adapter cannot own
  its early-resolution cleanup. Ordinary requests with adapter-owned controllers
  may retain their explicitly permitted partial output
  on caller abort/stall; no complete progress event is emitted for those results.
- Returning an owned-controller partial result must cancel the transport. Partial
  output is not proof of remote termination: the durable unknown marker remains.
  Malformed/truncated streams and failed completion writes never become partial
  success, even in permissive mode. The final record still follows clean EOF and
  durable completion. A hard deadline never becomes partial success.
- Rejected credentials/configuration/model bindings fail closed. Known overload
  remains a cooldown; cancellation after dispatch, process loss and uncertain
  completion retain the original request/attempt across restart. No retry is safe
  merely because time passed or a socket closed. Reads may be repeated, but a
  generation requires existing admission and ownership checks every time.
- Credentials and raw provider errors stay out of logs, URLs and persisted state.
  Existing consent, local attempt limits and memory guards remain authoritative.

## Alternatives and recommended stack

| Option | Pros | Cons / decision |
| --- | --- | --- |
| Global proxy or singleton switch | Few call-site edits | Hidden preflight/admin bypasses and broad live effect; reject |
| Separate copied generator | Isolated implementation | Duplicated strict/partial policies drift; reject |
| Bound factory plus shared generation leaves | Reuses result semantics; explicit lifetime and target | More contract tests; selected |
| Expand gateway to every Ollama API now | Broader compatibility | Warming/model pulls have different side effects; defer |

Recommended stack: existing ESM request builder and generation leaves, a small
bound gateway adapter, native Node HTTP, bounded NDJSON and PostgreSQL 18 UUIDv7
admission. No dependency upgrade or new table is needed. Supporting the existing
boolean and low/medium/high/max thinking controls does not guarantee a model
honors them; strict verification still validates the returned schema.

## Research and acceptance

Official sources discovered/opened through MCP on 2026-10-14:

- [Ollama generate API](https://github.com/ollama/ollama/blob/main/docs/api.md?plain=1)
  documents schema format, streaming completion and thinking controls.
- [Ollama thinking](https://github.com/ollama/ollama/blob/main/docs/capabilities/thinking.mdx)
  explains model-specific supported levels and default behavior. Preserve the
  bounded existing allowlist rather than accepting arbitrary values.
- [Node 24 HTTP](https://r2.nodejs.org/docs/latest-v24.x/api/http.html)
  distinguishes a timeout event from actual cancellation with an AbortSignal.
  Retaining uncertain provider ownership after cancellation is our safety design,
  not a claim that HTTP proves inference has stopped.

Acceptance: direct-path regression tests; real HTTP/PostgreSQL tests of the actual
generation and saved-verification factories, current digest checks, cancellation,
partial/strict behavior, authentication and unknown completion; packaged isolated
image rehearsal; no-cache Compose rebuild and unchanged live safeguards.
GitHub MCP returned no open Classifarr PRs; none can be randomly implemented.

Next: design one coherent installation-level cutover covering all generation,
preflight, warming, embedding and administration paths, including credential
rotation and cross-host TLS. Do not enable this partial integration in production.
