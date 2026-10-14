# Scoped Ollama application routing

Date: 2026-10-14. Local composition only; no startup activation setting.

## Contract and scope

The shared provider context is ready, but application leaves still use direct
HTTP. Add one explicit lifecycle owner around application execution, using
Node's `AsyncLocalStorage.run` to carry its binding across asynchronous work.
Do not monkey-patch fetch, HTTP, global settings or the existing Ollama singleton.
Unscoped applications retain current direct behavior. A closed, changed or invalid
binding must remain present and refuse work, never become unscoped/direct.

The owner creates foreground and background contexts against the same gateway
origin and upstream, with distinct scoped credentials. Code chooses workload
class: interactive generation uses foreground; inspection, readiness, embeddings,
warming and studies use background. Caller headers cannot select a class. The
gateway's credential registry remains the authority for actual class/installation.
Operators must provision the corresponding tokens correctly.

Configuration is immutable per revision. Replacing it requires a greater positive
integer revision, closes both old contexts and publishes both new ones together.
Invalid replacement closes the owner. Already-borrowed clients are fenced by
their old closed context. Close/replacement must cancel ongoing work without
resetting the gateway ledger, attempts or uncertainty. No database schema changes;
existing identities remain time-based UUIDv7.

## Application coverage

| Entry family | Boundary |
| --- | --- |
| Classifier, AI router, rule suggestions, queue | Generation leaves, including streaming |
| Model listing, saved tests, scheduled preflight | Connection leaves; no stale preflight cache in scope |
| Embedding router and explicit-host adapters | Embedding leaf/adapter before retry or model pull |
| Health checks | Bound read-only model inspection |
| Saved verification | Borrowed background context, fixed saved endpoint/model |
| Description and embedding studies | Captured binding plus per-call scope check |
| Warming | Bound background context; five-minute retention reported accurately |
| Model pull | Explicit unsupported-operation refusal in scope |

Check the saved endpoint before dispatch, including explicit overrides. A second
embedding host is not silently routed through the first provider. A different
endpoint/model or private gateway override is refused. Specialized studies retain
their schema, digest, vector dimensions and attempt-reservation hooks; their raw
request view remains path/model allowlisted and shares the owned transport.

Gateway mode caps warm/embedding retention to five minutes; zero/unload and
unrecognized durations are refused. Existing direct-mode defaults remain intact.
Warming errors cannot trigger generation-to-embedding fallback. Gateway embedding
errors bypass direct retry wrappers. A model-admin refusal never downloads data.

## Safety and outcomes

No new inference, scheduler, automatic retry, consent or budget is introduced.
Fresh installs do no additional work. Existing gateway bounds remain: one active
compute, eight foreground waiters, one waiter per installation, no background
backlog, 32 in-flight requests per context, 256 KiB requests, 1 MiB general and
4 MiB embedding responses, at most 300-second compute deadlines. Two workload
contexts do not increase the gateway's global 32-handler bound.

Durable claim/attempt precedes external HTTP; validated completion and its database
write precede success. Known 429/503 refusals retain the five-second persisted
cooldown. Permanent identity/authentication/shape errors require correction.
Cancellation, timeout, process death or lost completion after dispatch remain
uncertain; close/replacement does not prove remote work stopped. No HTTP inside
database transactions, no retry-budget resets and no raw credential/error logging.

Application-scope coverage is not a network firewall. Application startup must
eventually bind the listener, timers and workers together; unscoped maintenance
tools and unrelated external clients are not governed by this owner. Keep normal
startup unchanged until deployment configuration, TLS and network bypass controls
are designed. This work tests the composition against synthetic local providers.

## Research and tradeoffs

Official sources discovered/opened through MCP on 2026-10-14:

- [Node.js 24 async context](https://nodejs.org/download/release/v24.16.0/docs/api/async_context.html)
  recommends `run` over `enterWith` to avoid leaking context into adjacent event
  handlers. `getStore` is undefined outside a scope. We retain closed stores rather
  than disabling the shared storage, preventing a closed scope from falling back.
- [OWASP SSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
  recommends destination allowlists and disabled redirects. Bound endpoint checks
  and the existing no-redirect transport implement that policy; network controls
  remain a distinct deployment prerequisite.
- [Ollama API](https://github.com/ollama/ollama/blob/main/docs/api.md) documents
  five-minute default model retention, explicit buffered/streaming selection and
  JSON-schema output. We retain those shapes and cap warming retention to five
  minutes; longer historical direct-mode retention is not a shared-host default.

| Alternative | Benefit | Cost |
| --- | --- | --- |
| Inject a client through every singleton/router now | Most explicit dependencies | Large constructor churn and migration surface |
| Globally intercept all HTTP | Few call-site changes | Affects unrelated providers; hidden coupling |
| Scoped owner plus named leaf checks | Small boundaries, isolated concurrent tests, shared lifetime | Requires careful async-scope and factory-lifetime tests |

Recommend the scoped owner with modular ESM leaves, Node 24 async context,
authenticated gateway and PostgreSQL 18 UUIDv7 admission. No additional package.

The owner is an explicit Knip composition entry because isolated consumers import
it without application startup activation. This is not an ignored-file/export
baseline exemption. The owner is also included in backend type checking.

## Acceptance and next item

Prove each existing call family reaches only the authenticated gateway while in
scope, including factories created before/inside scope, asynchronous callbacks,
configuration replacement, closure, unsupported operations and injected failures.
Use real HTTP and isolated PostgreSQL, a source-boundary inventory regression,
the full backend suite and a no-cache immutable-image rehearsal. Preserve local
rollback and evaluation consent. Keep design/outcome documents separate.

Next: design explicit installation activation with verified TLS and endpoint
network restrictions; do not enable Unraid/shared Ollama as part of this change.
