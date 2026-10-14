# Shared Ollama provider context

Date: 2026-10-14. Status: implementation contract; local opt-in dependency only.

## Problem and scope

The generation gateway adapter binds one endpoint, but embeddings and model
warming have separate direct HTTP paths. Enabling gateway routing for generation
alone would not coordinate the provider. Build one immutable context for
generation, verification, text embeddings, model inspection and warming before
adding application activation. Ordinary saved settings remain unchanged.

No fresh-install work, scheduled inference, Unraid deployment or shared-provider
configuration change is authorized by this feature. No schema is needed. Existing
gateway records retain PostgreSQL 18 time-based UUIDv7 identities.

## Contract

- One context owns one authenticated transport, endpoint, generation model,
  optional embedding model and close/cancellation lifetime. Configuration changes
  require replacement and closing the old context. No cached model success.
- Model tags are exact after adding the explicit `:latest` default. Fresh tags
  inspection must find one matching model before compute; an optional expected
  digest must match. This is an observation, not an atomic lock against an
  administrator replacing a model directly in Ollama.
- Inspection uses the bound transport. Explicit embedding host/port overrides
  must match the bound origin; partial or conflicting overrides fail closed.
  The optional embedding adapter branch never enters direct HTTP or retry code.
- Embeddings use `/api/embed`, one text input, `truncate: false`, five-minute
  keep-alive, and the existing finite, nonzero float32 vector validator. No
  automatic pull, multimodal input, cloud fallback or automatic retry.
- Warming is compute, not inspection. Generation warming permits only a buffered
  empty prompt with a five-minute keep-alive, and requires an exact-model terminal
  empty response. It cannot unload a model. Embedding warming uses a bounded
  synthetic text input and the same validated embedding operation. No fallback
  from failed generation warming to another operation.
- Retain gateway limits: one active compute, eight foreground waiters (one per
  installation), no background backlog, 32 in-flight client requests, 256 KiB
  request, 1 MiB generation/inspection and 4 MiB embedding response. Inspection
  defaults to five seconds; compute deadlines never exceed 300 seconds. The
  gateway's shorter configured deadline still wins.
- Admission durably reserves an attempt and UUIDv7 request before upstream I/O;
  only a validated response followed by the completion write clears it. HTTP
  remains outside database transactions. Warming spends an attempt too.
- Authentication/model/shape refusals are permanent for that request. Known
  upstream rejection retains the existing policy; 429/503 persist a five-second
  cooldown. Transport loss, cancellation after dispatch, malformed completion
  and completion-write loss remain uncertain. Restart, close or credential
  rotation never resets attempts or treats a closed socket as proof of completion.
- No bypass endpoint, credential or untrusted provider error is exposed or logged.
  Closing one context aborts all its operations, including inspection, and
  prevents later dispatch. Other independently created contexts are unaffected.

## Alternatives and recommendation

| Approach | Benefit | Cost / risk |
| --- | --- | --- |
| Generation-only gateway | Small integration | Embeddings and warming bypass coordination |
| Rewrite the Ollama singleton now | Immediate broad wiring | Mixes transport, settings, timers and live activation |
| Bound, composed provider context | Shared identity and cancellation; isolated proof | Application composition still needs a separate cutover |

Choose the composed ESM context, reusing generation leaves, strict embedding
validation, the authenticated gateway and PostgreSQL 18 admission ledger. Keep
the generation-only public factory compatible. Add dependency injection to the
embedding adapter without enabling it. Cross-host rollout still requires TLS
and a verified all-call-site composition; the loopback-only client is not a
production multi-host deployment.

## Research

Official sources discovered and opened through the search MCP on 2026-10-14:

- [Ollama API documentation](https://github.com/ollama/ollama/blob/main/docs/api.md):
  an empty generation prompt loads a model; zero keep-alive unloads it. Embedding
  input may be text or a batch, truncation defaults on, and keep-alive defaults
  to five minutes. Our deliberately narrower contract rejects unloading and
  disables truncation to avoid silently changing embedding evidence.
- [Node.js 24 HTTP documentation](https://r2.nodejs.org/docs/latest-v24.x/api/http.html):
  aborted message signals describe local transport destruction. They do not
  establish whether remote inference finished; the existing uncertainty marker
  must therefore survive cancellation. The moving documentation URL may report
  a newer Node patch than the pinned application runtime.
- [OWASP REST security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html):
  protect credentials in transit, authorize each endpoint, validate allowed input
  and bound request sizes. We retain scoped gateway authentication and strict
  request limits; cross-host deployment remains blocked on TLS design.

## Proof and deferred work

Unit tests cover immutable identity, exact model selection, no direct fallback,
deadline bounds, invalid inputs and close. Real loopback HTTP plus isolated
PostgreSQL tests cover mixed operations, admission accounting, malformed warm
responses, cancellation and preserved uncertainty. Extend the immutable-image,
network-disabled Linux rehearsal with embedding and warming before rebuilding
and replacing only the local Compose application.

Next: wire all application call sites (classification, embedding router/provider,
health, settings tests and warming) through a single lifecycle owner, prove no
direct bypass, then design secure cross-host activation. Do not advertise shared
routing as enabled or complete until that cutover is verified.
