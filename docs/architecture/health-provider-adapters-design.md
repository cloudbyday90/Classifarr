# Health provider adapters

Date: 2026-10-12. Scope: the next item from
[configuration dependency verification](health-configuration-dependencies-outcome.md).

## Findings and recommendation

Arr and TMDb helpers return `{ success: false }` on ordinary connection failures.
The health caller discarded that value, recording any resolved promise as healthy.
The AI adapter reads nonexistent `ollama_url`, `openai_api_key` and
`anthropic_api_key` fields. Media health similarly reads obsolete `token` and
`selected_connection` fields. These are false-positive health paths, not proof of
provider failure or a reason to change credentials.

Use explicit helper-result validation, small separate AI/media adapters and fresh
saved connection settings. Keep the public service key `ollama`, existing status
vocabulary, cache coordinator and configuration-change guard. No migration,
ownership change, backfill, classification change or release is required.

## Contract

- Success requires explicit `success === true`. Explicit false is disconnected;
  malformed results and cancellation are unknown. Exceptions are sanitized;
  provider messages, bodies, credentials and endpoint URLs never enter health
  output. Last-success history advances only on a successful probe.
- Missing configuration is not configured. Unsupported provider/server types and
  invalid saved endpoints are unknown, never implicitly healthy.
- Ollama checks only `GET /api/tags`, accepting a JSON models array (including an
  empty array). This proves connectivity, not model presence or generation ability.
  Resolve the active legacy `ollama_config` host/port first, then the AI row, then
  process environment/defaults, matching `ollama.getConfig()` precedence. Capture
  both tables in one SQL read for completion/reconciliation. Do not reuse its
  cached singleton endpoint. Process environment is startup configuration.
- Cloud providers supported by the current client (OpenAI, OpenRouter, Gemini,
  LiteLLM, custom) are configured only when required settings are present. No paid
  test generation or extra cloud call. Authentication and generation remain
  unverified; configuration alone does not refresh last-success history.
- Media checks use `url` and `api_key`. Plex uses authenticated `GET /` with JSON
  Accept and token/client headers; Emby/Jellyfin use `GET /System/Info` with the
  token in a header. Require recognizable server ID/version fields; an HTML login
  page or empty 200 response is not success. Server-side anonymous access policies
  can still permit a response; this is not independent credential verification.
- New AI/media requests have a 10-second deadline, 1 MiB decoded response cap,
  TLS verification and no redirects. Private LAN endpoints remain supported.
  Reject embedded URL credentials, query strings and fragments before sending.
  Existing Arr/TMDb/OMDb helper transport deadlines/concurrency are unchanged;
  only their result interpretation changes in this iteration.
- Admission remains one process-local flight per service; Arr instances remain
  sequential. No internal retry, new timer, persisted cooldown or external write.
  Existing heartbeat/manual checks repeat safe reads. A restart drops volatile
  observations. Completion must still validate the captured configuration; a
  disable/credential/endpoint change discards the old result. No durable lease or
  ownership fence is needed because these adapters do not mutate inventory.
- Transient transport/refusal/rate-limit failures wait for normal checks. Invalid
  settings require correction. Cancelled/unknown outcomes do not claim success.
  Cached status endpoints never initiate these probes.

## Options and recommendation stack

| Option | Benefit | Cost / limitation |
| --- | --- | --- |
| Explicit result adapter (recommended) | Fixes false success without changing settings-test APIs | Helper failures may lack structured reason codes |
| Separate bounded AI/media reads (recommended) | Uses current credentials, validates replies, avoids generation | Connectivity is not model readiness or full library access |
| Reuse cached Ollama singleton | Less code | Can test stale or different saved configuration |
| Generate content on every heartbeat | Exercises generation | Cost, shared-provider load and unintended side effects; rejected |
| Rewrite every helper transport now | Uniform limits | Broad regression surface; defer after this correction |

Stack: strict results, current-settings read-only probes, configuration-only cloud
status, existing freshness/single-flight guards, and sanitized actionable failures.
Then audit remaining helper transport bounds and Ollama runtime cache invalidation.

## Verification plan

Regression tests cover explicit false, malformed results, cancellation, refusal,
missing/unsupported settings, legacy endpoint precedence, credential headers,
redirect/size bounds, last-success preservation and configuration drift. Real HTTP
fixtures exercise transport; isolated PostgreSQL exercises the actual projections
and cross-connection changes. Run affected quality gates, uncached Compose build,
isolated image checks and backed-up local replacement. Do not change Unraid or the
shared provider. Record exact results separately, including any skipped checks.

## Official sources reviewed

Discovered/read through MCP on 2026-10-12; recommendations above are application
design decisions, not guarantees supplied by these documents.

- [Plex Media Server API](https://developer.plex.tv/pms/): authenticated PMS info
  versus public identity and explicit JSON negotiation. Search exposed the
  relevant official sections; full-page retrieval exceeded the service size cap.
- [Ollama API introduction](https://docs.ollama.com/api/introduction) and
  [official endpoint index](https://docs.ollama.com/llms.txt): model listing is
  separate from generation, loading and model mutation.
- [Emby API-key authentication](https://dev.emby.media/doc/restapi/API-Key-Authentication.html)
  and [system information](https://dev.emby.media/reference/RestAPI/SystemService/getSystemInfo.html):
  header credentials and authenticated system information.
- [Jellyfin SystemController](https://github.com/jellyfin/jellyfin/blob/master/Jellyfin.Api/Controllers/SystemController.cs):
  protected `Info` versus `Info/Public`; reviewed file SHA
  `450225c3713828a65d6e0b6369195568c9626619` through GitHub MCP.
