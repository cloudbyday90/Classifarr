# Bounded Arr and metadata health probes

Date: 2026-10-12. Follow-up to
[provider adapter verification](health-provider-adapters-outcome.md).

## Findings

The health caller now rejects explicit helper failures, but the helpers retain
different transport contracts. Arr's settings test makes four requests (including
the status request twice), accepts an unvalidated first response and loads root
folders/profiles that health does not need. TMDb accepts any successful HTTP
response without validating configuration data. OMDb already validates payloads
and caps decoded bytes, but its health caller loses structured failure categories
and permits redirects. These are observation problems, not evidence that saved
credentials need replacement.

## Recommended contract

- Separate small ESM health probes from the richer settings-page connection
  tests. Do not change those APIs, routing, lookups, quotas, database schema,
  ownership, retry budgets, memory safeguards or classification behavior.
- One read-only request per configured provider/Arr instance, no retry or fan-out.
  Preserve one in-flight health check per service and sequential Arr instances.
  Existing heartbeat/manual admission is unchanged. No request on an empty or
  disabled installation. Cached status reads never start provider work.
- Keep the shared 1 MiB decoded-body limit and reject redirects. Arr health uses
  the smaller of a positive saved timeout and ten seconds (invalid values fall
  back to ten seconds). TMDb retains five seconds; OMDb retains ten seconds.
  The deadline includes body consumption. No provider response is persisted.
- Arr uses the existing v3 status endpoint and X-Api-Key header. Preserve saved
  URL precedence, host/port/base-path fallback, and explicit `verify_ssl: false`
  compatibility. Never switch TLS verification off automatically after failure.
  Reject embedded credentials/query/fragment and unsupported URL schemes.
  Require a nonempty bounded version and the expected app name, or a legacy
  status object without appName but with a boolean isProduction field.
- TMDb uses the existing fixed HTTPS configuration endpoint and v3 query key;
  a v3 API key is not a Bearer access token. Require recognizable image
  configuration and string arrays, not merely HTTP 200. Never fetch returned URLs.
- OMDb uses its fixed HTTPS endpoint with the existing synthetic title/year query.
  Reuse the existing response classifier; success still requires a valid lookup.
  Authentication, quota and rate-limit failures get allowlisted safe reasons.
  Not-found or malformed probe results do not claim a verified connection.
  In this original increment, ordinary health requests consumed upstream quota
  outside the lookup budget. The subsequent
  [OMDb admission change](omdb-health-admission-design.md) brings System-health
  attempts into the shared local budget; it does not claim account-wide isolation.
- Configuration-invalid, malformed, oversized and cancelled checks are unknown.
  Refusal, timeout, authentication and quota/rate-limit responses are disconnected.
  Preserve last-success history on all non-success outcomes. Expose fixed messages
  and codes only: never body text, URL, credentials, raw error details or headers.
- Capture/re-read current settings with the existing completion guard and
  reconciliation, including failed provider observations. A saved correction
  retires the previous failure; incidental quota-counter changes do not. A changed
  configuration discards the old result. Restart loses
  volatile health observations; no durable cooldown or write fence is introduced.
  Repeating these bounded reads has no remote mutation, though it consumes quota.

## Options, pros and cons

| Option | Advantages | Costs / limits |
| --- | --- | --- |
| Dedicated bounded health probes (recommended) | One request, explicit payload contract, safe reasons | Small separate adapter surface to maintain |
| Rewrite shared settings-test helpers | One common implementation | Wider UI/API regression scope and richer response contracts |
| Retain current helpers | Minimal code | Unnecessary fan-out, malformed success and inconsistent bounds |
| Disable metadata probing | No probe quota | Loses actual connection evidence; not selected |

Recommendation stack: reuse bounded transport; separate provider-specific
validation; reuse the OMDb classifier; retain configuration/freshness coordination;
prove rejection paths through real HTTP and PostgreSQL fixtures. A later quota
and cadence review should measure automatic health traffic before changing it.

## Verification plan

Test valid and legacy responses, empty/disabled configurations, malformed JSON,
HTML/204, wrong provider identity, authentication/refusal/rate-limit/quota results,
redirect credential confinement, compressed oversize and body-stall cancellation.
Verify URL precedence, explicit TLS settings, shorter saved timeouts and the hard
deadline cap. Use synthetic providers only, including packaged-image probes.
Retain real PostgreSQL configuration drift checks and settings-test regressions.
Run quality gates, an uncached Compose build and backed-up local replacement;
do not alter Unraid, Plex or the shared Ollama service. Record outcomes separately.

## Official sources

Discovered through search/GitHub MCP and reviewed on 2026-10-12. The bounds and
minimal validators above are Classifarr design choices, not provider guarantees.

- [OWASP API4 resource consumption](https://api-security.owasp.org/editions/2023/en/0xa4-unrestricted-resource-consumption/):
  enforce execution, memory, payload and interaction limits; account for external
  provider costs. Supports the bounded-probe approach and separate cadence review,
  not these specific numeric thresholds.
- [Radarr API](https://radarr.video/docs/api/) and its linked
  [OpenAPI document](https://github.com/Radarr/Radarr/blob/develop/src/Radarr.Api.V3/openapi.json):
  status GET, SystemResource fields and header API-key authentication.
- [Sonarr API](https://sonarr.tv/docs/api/) and
  [main-branch OpenAPI](https://github.com/Sonarr/Sonarr/blob/main/src/Sonarr.Api.V3/openapi.json):
  the v3 API supports Sonarr v3/v4. Do not silently switch existing installations
  to the separately documented v5 API.
- [TMDb application authentication](https://developer.themoviedb.org/docs/authentication-application),
  [image configuration](https://developer.themoviedb.org/docs/image-basics) and
  [configuration endpoint](https://developer.themoviedb.org/reference/configuration-details), plus
  [errors](https://developer.themoviedb.org/docs/errors): v3 query keys differ from
  Bearer access tokens; image configuration provides URL/size fields; failure
  statuses must not be treated as success.
- [OMDb usage and parameters](https://www.omdbapi.com/) and
  [API-key limits](https://www.omdbapi.com/apikey.aspx): query authentication,
  title/year lookup and the free daily quota. Retain HTTPS despite the usage
  page's older HTTP example.
