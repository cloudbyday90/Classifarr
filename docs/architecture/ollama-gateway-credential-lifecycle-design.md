# Ollama gateway credential lifecycle and cutover design

Status: implementation design, 2026-10-14. Local-only; no deployment, release,
production routing, provider inference or Unraid changes are authorized here.
See the separate [outcome](ollama-gateway-credential-lifecycle-outcome.md).

## Problem and bounded next step

The optional gateway validates credentials only at startup. Restarting to remove
a credential interrupts unrelated work, while changing a file alone revokes
nothing. Implement explicit credential reload in the standalone Linux process;
do not activate the gateway in the normal application or broaden its listener.
Fresh installations and existing direct configurations do no new work.

## Official research and recommendation

Discovered through MCP search and opened on 2026-10-14:

- [OWASP secrets management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html):
  use scoped secrets, rotation and explicit revocation; a stopped consumer does
  not revoke its credential. This motivates gateway-side enforcement.
- [OWASP REST security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html):
  protect credentials in transit with HTTPS and authorize each endpoint. The
  current loopback HTTP prototype is not a cross-host deployment solution.
- [Node 24 process signals](https://nodejs.org/download/release/v24.20.0/docs/api/process.html):
  a Linux SIGHUP handler can reload configuration; Windows signal behavior differs.
  Test the real CLI inside the Linux image, not just Windows process mocks.
- [Ollama authentication](https://github.com/ollama/ollama/blob/main/docs/api/authentication.mdx):
  local API access does not require authentication. Gateway credentials alone
  cannot prevent callers bypassing the gateway to reach Ollama directly.

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Restart for every rotation | Small implementation | Interrupts every caller; keep as fallback, not the routine path |
| Private file plus explicit SIGHUP | No new HTTP administration surface; scoped revocation | Operator must replace the file safely and confirm reload; selected |
| Secret manager / expiring credentials | Central lifecycle and expiry | Additional deployment dependencies; defer until topology is chosen |
| Native gateway TLS | One service to deploy | Certificate issuance, renewal and trust management still required |
| Managed TLS proxy with private upstream | Separate certificate lifecycle | Another service; streaming, disconnect and bypass rules need real tests |

Recommended current stack: existing ESM Node HTTP gateway, PostgreSQL 18 UUIDv7
admission ledger, scoped random bearer credentials in an operator-owned private
file, explicit atomic reload, and AbortSignal cancellation. For future cross-host
deployment, prefer verified TLS at a managed ingress with gateway and Ollama
reachable only through their intended private paths. This is a design preference,
not an implemented TLS claim or permission to expose the service.

## Contract

1. Read the same resolved private JSON path on startup and explicit Linux SIGHUP.
   Limit reads to 64 KiB, regular private files, strict UTF-8/JSON, and unchanged
   database, provider, model allowlist, port, timeout and queue configuration.
   Reject final-component symlinks on POSIX; require a trusted parent directory.
   Windows requires private ACLs and process restart, not signal-based reload.
2. Only the credential list changes live. Validate the entire candidate before
   synchronously replacing authority. Each request holds a credential-bound
   cancellation scope until it finishes. A removed token or changed installation
   or work class cancels that scope, including body reads, inspection, queued and
   dispatched work. Unchanged credentials continue. New requests use new authority.
3. Reload has one active file read and at most one coalesced follow-up request,
   with a five-second deadline per read. Shutdown fences late reads. Invalid,
   incompatible, missing or timed-out reload stops the standalone gateway with a
   fixed error, rather than claiming revocation while silently retaining old keys.
   Until publication (or failure shutdown), the current credentials remain valid.
4. Adding a second token for the same installation/work class permits staged
   rotation. It does not increase the per-installation queue allowance. Remove the
   old token in a later reload. File persistence controls restart; never restore a
   revoked token from an old configuration backup. Automatic expiry is deferred.
5. No automatic retry, fallback or new attempt budget. Authentication failures
   have no provider effect. Revocation before admission has no attempt; revocation
   during a durable claim may conservatively leave uncertainty even before HTTP.
   Once dispatched, cancellation does not prove the remote computation stopped.
   Preserve the UUIDv7 marker and attempt count unless a validated terminal result
   was received and its completion durably written. Never replay uncertain work.
6. Existing bounds remain: one active computation, eight foreground waiters,
   one waiter per installation, no background backlog, 32 handlers, 64 connections,
   120 requests/minute, maximum five-minute request and 30-second queue deadlines,
   bounded bodies/responses, and persisted five-second overload cooldown. A reload
   changes none of these, does not release the database owner lock, and creates no
   new tables or identifiers.
7. No credential/digest, config contents, prompts or raw exception text in output.
   CLI emits fixed ready/reloaded/reload-failed messages. No HTTP reload/reset route.
   All request scopes are removed on completion; stop revokes all scopes.

Completion means the new authority is published and affected scopes are aborted,
not that provider execution has ended. Durable uncertainty remains visible through
the existing authenticated, database-only status endpoint.

## Whole-provider cutover inventory

The following is a source-level inventory, not proof that direct routing is closed.

| Path | Current owner | Required before activation |
| --- | --- | --- |
| Classification and response repair | `classificationAiService.mjs`, `aiRouter.mjs`, `ollamaGeneration.mjs` | One installation context for generation, preflight and repair; preserve local locks and attempts |
| Smart library rule suggestions | `librariesRouteRuleSuggestSmart.mjs` | Use that same installation context; do not overlook interactive routes outside services |
| Saved verification/readiness | `ollamaVerificationSavedConfigurationClient.mjs`, capability/readiness services | Supply the same context explicitly; retain digest and consent checks |
| Text/image embeddings | `embeddingProviderAdapters.mjs`, `embeddingRouter.mjs`, `ollamaGeneration.mjs` | Inventory text/image payload and keep-alive differences; reject unsupported operations, never direct-fallback |
| Warming/preload | `ollamaModelWarming.mjs`, scheduled preflight, `ollamaSettingsHandlers.mjs` | Admission for empty-prompt compute; current 24-hour keep-alive is outside gateway contract |
| Health/model inspection | `healthCheckAiProvider.mjs`, `ollamaConnection.mjs` | Fixed authenticated target and bounded reads; no URL override bypass |
| Model installation | `ollama.mjs`, `ollamaGeneration.mjs` pull behavior | Disable implicit pulls when coordinated; separately authorized maintenance only |
| Study tools | `localDescriptionBenchmarkClient.mjs`, `localStudyEmbeddingClient.mjs` | Existing optional transport; include all operator-launched tools in cutover checks |

The normal application still uses direct paths. No half-proxy global setting is
introduced. Cross-host TLS, all-path composition, network bypass prevention and
evidence-based uncertain-execution recovery remain activation blockers.

## Verification plan

Unit-test authority replacement, role changes, scope cleanup, overlapping tokens,
read bounds, reload coalescing, deadline, shutdown fencing and invalid candidates.
Use real HTTP plus isolated PostgreSQL for active/queued revocation, buffered and
streamed results, inspection, claim/completion races, cooldown and owner continuity.
Extend the existing network-none packaged rehearsal with real Linux SIGHUP, atomic
file replacement, old/new credential checks, invalid reload shutdown and restart.
No live inference. Preserve source/image provenance and verify fixture cleanup.
