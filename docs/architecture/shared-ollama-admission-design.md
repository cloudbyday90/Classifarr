# Shared Ollama admission: proposed design

Status: standalone prototype implemented, 2026-10-14; not enabled on either
installation. Broader client integration remains proposed. This follows
[installation-local evaluation controls](evaluation-workload-controls-design.md).
The subsequent [streaming/client slice](ollama-gateway-streaming-design.md)
extends the first implementation below without enabling production routing.

## Approved first implementation slice

The administrator selected an optional gateway, tested locally only. Implement
the standalone dispatch boundary first; do not change existing Classifarr client
routing in this slice. Bind only to IPv4 loopback, with bearer credentials mapped
to installation and foreground/background permission in a private configuration
file. Cross-host TLS deployment and application-client integration remain later
work, not implicitly enabled by building the gateway.

Support non-streaming `/api/generate`, `/api/embed`, and bounded inspection
(`/api/tags`, `/api/show`, `/api/ps`, `/api/version`). Reject streaming, chat,
model administration and all other routes explicitly. Use a configured model
allowlist and a fixed private/loopback IPv4 upstream, without DNS or redirects.
Limits: 256 KiB request, 1 MiB generation/inspection response, 4 MiB embedding
response, 32 concurrent HTTP handlers, 64 connections, eight waiting foreground
requests, one waiting request per installation, 30-second maximum queue wait and
180-second default total request deadline (configurable up to 300 seconds).
No automatic retries. Completed upstream 429/503 responses impose a persisted
five-second admission cooldown; caller budgets remain authoritative and unchanged.

Use a separate, explicitly initialized gateway database. Its initial migration
and fresh schema are the same SQL artifact under `database/ollama-gateway/`,
outside the application's automatic migration runner. One dedicated PostgreSQL
session holds the gateway singleton advisory lock; durable row ownership and an
in-flight request marker fence dispatch and completion. Losing that session stops
the gateway. A replacement gateway never clears an outstanding marker. There is
no reset endpoint or automatic uncertainty expiry. Only safe status reads remain
available while uncertain. A corrupt/missing row or changed upstream fails closed.
The new table primary key, request references and gateway owner references use
PostgreSQL 18's native time-ordered `uuidv7()`, with version checks in the schema.
The singleton constraint is separate from its UUID primary key. Existing
application identifiers are unchanged; UUID timestamps are not authorization.

Completion of this slice means real HTTP/PostgreSQL tests, a packaged-image local
rehearsal, documented limits and no activation of real inference. It does not mean
that local and Unraid are already coordinated or that streaming clients can be
pointed at this restricted gateway unchanged.

## Problem and evidence

Local Classifarr and Unraid can use the same Ollama server while keeping separate
databases. Their individual admission locks cannot coordinate provider use.
Neither a daily request limit nor an idle check in one installation establishes
that another installation has no work. Local inference has resource costs even
without per-token billing: GPU time, memory and foreground latency.

The inspected code has several transport paths, not one inference client:

| Path | Existing responsibility | Coordination requirement |
| --- | --- | --- |
| `ollamaGeneration.mjs` | Generation, streaming, embeddings and model pulls | Distinguish inference from model administration; retain streaming behavior |
| `embeddingProviderAdapters.mjs` | Separately configured Ollama embeddings | Resolve the provider independently; do not assume the primary endpoint |
| `localDescriptionBenchmarkClient.mjs` | Bounded local evaluation | Preserve installed-model checks, exact checkpoints and attempt reservations |
| `localStudyEmbeddingClient.mjs` | Bounded study embeddings | Preserve endpoint trust, model checks and response validation |
| `ollamaConnection.mjs` and saved verification client | Inspection and generation probes | Readiness generation is resource-consuming work too |
| `ollamaModelWarming.mjs` | Model loading and embedding warmup | Warming is not a harmless status read |

This is an initial path inventory, not proof that every call site is covered.
An evaluation-only lock must not be presented as provider-wide coordination.

## Options and recommendation

| Option | Advantages | Disadvantages / decision |
| --- | --- | --- |
| Enable evaluation on one installation | No new infrastructure; available now | Other inference still competes; interim recommendation |
| Separate daily UTC windows | Existing durable controls; easy to reverse | Cannot prevent foreground overlap or prove remote cancellation; interim only |
| Shared expiring lease, with clients calling Ollama directly | Small coordination API | A disconnected holder may continue after expiry; reject as an exclusive-execution guarantee |
| Shared request gateway | Controls dispatch for participating clients; can prioritize waiting foreground work | New service, authentication, durable state and an availability dependency; recommended only after explicit architecture selection |

Recommended implementation stack, subject to that selection: small Node.js ESM
transport/admission modules, an authenticated single active gateway, a dedicated
PostgreSQL control ledger/least-privilege role, fixed upstream routing, and the
existing installation-local consent, memory checks and attempt ledger. Do not
share Classifarr application tables between installations. No new broker is
needed for the first implementation.

The gateway would be optional and inactive by default. Both installations would
need configuration changes before it could coordinate them. A local-only
prototype is not authorization to deploy it, change Unraid, or restart Ollama.
Until selected, retain the existing controls and do not change live consent.

## Proposed admission and failure contract

The following are acceptance requirements, not current runtime behavior.

- Scope admission to the configured provider, across participating installations.
  Do not use model names alone as a resource key. Credential identity determines
  the installation; trusted server-side call sites determine the work class.
- Start with one active compute request per provider, at most eight waiting
  foreground requests globally and one waiting request per installation. Do not
  queue background prompts: refuse admission and let the existing durable worker
  defer. Waiting foreground work has priority over the next background dispatch.
  This does not preempt work already accepted by Ollama or guarantee background
  progress under continuous foreground load.
- Keep current request, context, output and memory bounds. Evaluation retains
  five attempts per tick, the existing daily ceilings, 180-second request timeout,
  1 MiB response limit and 20-minute capture bound. A transport-wide change must
  also preserve the other clients' existing streaming and embedding contracts;
  do not impose evaluation limits on them accidentally.
- Require a finite queue deadline within the caller's existing total deadline.
  Establish endpoint-specific request/response byte caps before gateway activation.
  A queued cancellation removes only undispatched work. Never refund a dispatched
  attempt or increase a retry budget. The gateway must not retry generation.
- Persist an in-flight marker before dispatch; keep database transactions short
  and outside HTTP. Configuration revisions fence local publication, not remote
  GPU execution. Credential, endpoint or consent changes invalidate undispatched
  work without rewriting reservations or existing cooldowns.
- A definitive terminal response and durable completion can release the active
  slot. Transient busy responses defer within existing cooldowns. Invalid input,
  authentication refusal or an unsupported model needs correction, not retries.
- Cancellation, connection loss, timeout, malformed/truncated completion or a
  crash after dispatch can leave an unknown remote outcome. Bound the local wait,
  retain the durable uncertainty marker and stop new compute dispatch. Do not
  automatically clear it because time elapsed, a lease expired or a database
  session ended. Missing/corrupt control state also fails closed.
- After restart, unresolved in-flight markers remain unresolved. Safe recovery
  needs provider-supported proof of completion, or an administrator-controlled
  provider reset/epoch transition with all old dispatchers excluded. This work
  must not invent such proof, automatically restart shared Ollama, or offer an
  unqualified "clear lock" action. This availability cost must be accepted before
  adopting the gateway.

Ollama's documented `/api/ps` response describes loaded models, not an individual
request-completion acknowledgement. It is useful telemetry, not permission to
clear uncertain work. Similarly, aborting a local HTTP request does not establish
that the upstream GPU stopped. These are conservative design inferences, not a
claim that every disconnected Ollama request continues running.

## Security and integration boundary

Use separate installation credentials, rotation/revocation and authenticated
transport across hosts. Never put gateway credentials in frontend code or URLs,
or forward them to Ollama. Authorize work classes rather than trusting arbitrary
client priority headers. Limit connections, header sizes, authentication attempts,
body sizes and queue occupancy before expensive work.

Use a fixed administrator-configured upstream with validated destination
addresses and an allowlisted method/path set. Reject redirects, arbitrary proxy
targets and tunnelling. Model pull/create/delete/push operations are not part of
the inference interface; explicitly account for existing model-install behavior
before changing clients. Do not silently fall back to direct Ollama when a
configured gateway is unavailable.

Retain only bounded operational metadata: opaque request/installation references,
work class, revision, timestamps and fixed outcome codes. Never store prompts,
responses, authorization headers or raw provider errors in the control ledger or
logs. Read-only status must not cause inference. Keep browser status concise and
place detailed correlation references in diagnostics.

The guarantee applies only to requests passing through the gateway. Whole-server
exclusivity additionally needs controlled network access so other clients cannot
bypass it. Neither network enforcement nor live cutover is included here.

## Implementation order and completion criteria

1. Select the infrastructure approach and explicitly accept its failure behavior.
2. Complete a call-site inventory and central transport contract without changing
   prompts, budgets, provider identity checks or fresh-install behavior.
3. Build an isolated gateway fixture with synthetic clients/provider. Prove
   authentication, bounded waiting, fairness between installations, foreground
   precedence, no-dispatch cancellations and fixed-target transport.
4. Exercise real HTTP and PostgreSQL failure boundaries: crash before dispatch,
   crash after dispatch, lost completion write, restart, concurrent gateway
   startup, expired ownership, credential rotation, malformed/oversized responses
   and unavailable persistence. An uncertain request must never grant a new slot.
5. Integrate every participating compute client, then run the normal quality
   gates and no-cache local image rehearsal. Verify unchanged local consent and
   memory safeguards. A two-client fixture is not a production/shared-GPU test.
6. Treat deployment, credential provisioning and network cutover as a separate
   approved operation with rollback planning. No release is included.

## Official research

Retrieved 2026-10-14. URLs were discovered with MCP search and the official
documentation index. The search tool could not render Ollama's Markdown content
type; those exact discovered URLs were read with a read-only HTTP request.

- [Ollama FAQ](https://docs.ollama.com/faq.md): concurrency increases memory demand;
  its bounded queue can return 503. This supports keeping resource limits, not
  raising shared server parallelism as a workaround.
- [Ollama authentication](https://docs.ollama.com/api/authentication.md): the local
  API does not require authentication. A new network gateway must supply its own
  installation authentication; a cloud API key is not that mechanism.
- [Ollama running models](https://docs.ollama.com/api/ps.md): the documented schema
  reports model residency and memory information, not per-request completion.
- [Node.js 24 HTTP](https://nodejs.org/download/release/latest-v24.x/docs/api/http.html):
  a timeout event alone does not terminate a request. Explicit cancellation and
  observed transport cleanup are required, without assuming remote rollback.
- [PostgreSQL 18 advisory locks](https://www.postgresql.org/docs/18/functions-admin.html):
  session locks end with their session. Our inference is that this cannot fence
  a previously dispatched request at a separate inference server.
- [PostgreSQL 18 UUID support](https://www.postgresql.org/docs/18/datatype-uuid.html):
  native UUIDv7 avoids a custom time-based identifier generator. The gateway
  requires PostgreSQL 18 and verifies UUID version 7 in its schema and tests.
- [OWASP SSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html):
  allowlist trusted destinations and disable redirects. Apply this to a fixed
  upstream rather than exposing a general-purpose proxy.
