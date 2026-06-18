# Web Search Provider Usage Cache

## Purpose

Classifarr now has provider-neutral search adapters, provider config storage, and usage
recording. The next hardening step is a persistent usage cache so repeated equivalent
web-search requests do not burn Tavily, Brave, or Serper quota unnecessarily.

This cache is not a browser/proxy HTTP cache. It is an application-managed cache for
normalized provider responses, keyed by the sanitized provider request shape.

## Official Guidance Reviewed

- MDN HTTP caching explains that a cache stores a response associated with a request
  and reuses it for subsequent requests, reducing origin work when the stored
  response is reusable:
  <https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching>
- RFC 9111 defines freshness as the stored response age not exceeding its freshness
  lifetime:
  <https://datatracker.ietf.org/doc/html/rfc9111>
- OWASP API4:2023 recommends rate limiting, maximum input sizes, and provider
  spending limits/alerts to prevent unrestricted resource consumption:
  <https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/>
- OWASP REST Security recommends input validation for length, range, format, type,
  and rejecting unexpected content:
  <https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html>
- PostgreSQL JSONB supports structured JSON storage and operators for future
  observability and cleanup workflows:
  <https://www.postgresql.org/docs/current/functions-json.html>
- Tavily documents request-rate limits and `429` handling with `retry-after`, which
  reinforces avoiding repeated identical searches:
  <https://docs.tavily.com/documentation/rate-limits>

## Design Options

### Option A: In-memory cache

Pros:

- Simple.
- No schema change.
- Fast.

Cons:

- Lost on restart.
- Does not help multi-process deployments.
- Hard to inspect or purge.

### Option B: Provider-local cache inside each adapter

Pros:

- Easy to add for Tavily only.
- Provider-specific behavior can be customized quickly.

Cons:

- Repeats logic across Brave/Serper.
- Makes adapters stateful.
- Harder to apply consistent security and usage accounting.

### Option C: Provider-neutral persistent cache

Pros:

- One cache model for all providers.
- Survives restarts.
- Can record cache hits as zero-cost usage events.
- Keeps provider adapters deterministic.
- Gives future routing logic a single place to inspect freshness, hit rate, and
  provider usage.

Cons:

- Requires a database migration.
- Requires cleanup policy and bounded TTL.
- Slightly more code than adapter-local caching.

## Final Recommendation

Use Option C.

Implementation stack:

- `web_search_provider_cache` table keyed by a SHA-256 cache key.
- `webSearchProviderCachePolicy.mjs` for deterministic request identity and TTL
  bounds.
- `webSearchProviderUsageCache.mjs` for DB storage, cache-hit accounting, and
  expired-entry cleanup.
- `webSearchProviderCachedSearch.mjs` as the cache-aware executor around any
  contract-valid provider.

## Cache Identity

Included in the cache key:

- provider key
- purpose
- normalized query
- media context
- bounded request options
- non-secret provider behavior config

Excluded from the cache key:

- API keys
- bearer/token/authorization fields
- project IDs
- request timeout values

Rationale:

- Secrets must never affect a stored key or be persisted in cache metadata.
- Transport-only settings do not change semantic search results.
- Behavior-changing options such as domains, max results, and provider search depth
  must change the key.

## Security Controls

- Request and response objects are validated through `webSearchProviderContract.mjs`.
- Provider keys use the existing bounded provider-key format.
- Cache keys and query hashes are SHA-256 hex strings.
- Query previews are truncated to 160 characters for diagnostics only.
- Cache TTL defaults to 24 hours and is capped at 7 days.
- Cache hits record zero-cost usage events instead of provider calls.
- Expired cleanup uses a bounded delete batch.

## Implementation Outcome

Added:

- `database/migrations/20260618_120000_add_web_search_provider_cache.sql`
- `server/src/services/webSearchProviderCachePolicy.mjs`
- `server/src/services/webSearchProviderUsageCache.mjs`
- `server/src/services/webSearchProviderCachedSearch.mjs`
- unit tests for policy, persistence, and executor behavior
- schema snapshot coverage for fresh installs

The cache executor is intentionally provider-neutral. Tavily, Brave, and Serper can
all run through the same cache once provider routing is activated.

## Validation

Targeted validation:

```bash
cd server
node ./scripts/run-jest.mjs --testPathPatterns="services/webSearchProviderCachePolicy|services/webSearchProviderUsageCache|services/webSearchProviderCachedSearch|migrations" --runInBand --no-coverage
```

Broader validation:

```bash
npm --prefix server run lint
npm --prefix server run lint:knip
npm --prefix server test -- --runInBand
```

## Next High-Value Items

1. Quota-aware provider routing.
   Intent: use provider config, usage, cooldown, and cache state to select Tavily,
   Brave, or Serper without hardcoding Tavily as the only live path.

2. Cache cleanup scheduler and admin observability.
   Intent: periodically purge expired cache rows and expose hit/miss counters so
   operators can understand whether caching is actually saving quota.

3. Brave and Serper adapter activation.
   Intent: move beyond stored provider rows by implementing provider-specific
   adapters that satisfy the existing contract and share the cache/executor stack.
