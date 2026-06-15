# Tavily Modernization

Status: implemented slice, June 2026.

## Goal

Move Tavily from a legacy, app-specific service implementation into the provider-neutral web-search framework without breaking existing Tavily settings, enrichment calls, or classification prompt formatting.

The key migration principle:

```text
The provider adapter owns Tavily API semantics; the legacy Tavily service remains a compatibility facade.
```

## Current Problem

The earlier integration treated Tavily as the only web-search provider:

- `tavily.mjs` owned outbound API payloads.
- `tavilyWebSearchProvider.mjs` wrapped the legacy service instead of being provider-native.
- Tavily API keys were sent in the JSON request body.
- Provider-neutral storage existed, but Tavily execution still depended on the old service shape.

That made Brave/Serper additions risky because the provider framework would depend on legacy Tavily behavior instead of a common adapter contract.

## Official Research: June 2026

- Tavily documents `https://api.tavily.com` as the API base URL and requires API key authentication with an `Authorization: Bearer ...` header. It also supports optional `X-Project-ID` headers for usage tracking.
- Tavily Search is `POST /search`, requires `query`, bounds `max_results` to `0 <= x <= 20`, exposes `request_id`, and reports `usage.credits`.
- Tavily's JavaScript SDK models Tavily as an instantiated client with a `search` method, which supports keeping provider behavior at a client boundary.
- OWASP secrets guidance recommends centralizing and standardizing secret management, applying least privilege, and avoiding secret leakage through operational surfaces.
- OWASP REST security guidance states HTTPS protects API keys in transit and warns that API keys should not appear in URLs.
- OWASP error handling guidance supports returning safe client-facing errors while preserving operational details in server-side logs.

Source URLs:

- https://docs.tavily.com/documentation/api-reference/introduction
- https://docs.tavily.com/documentation/api-reference/endpoint/search
- https://docs.tavily.com/sdk/javascript/reference
- https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html

## Options

### Option 1: Keep `tavily.mjs` as the implementation

Pros:

- Lowest immediate code churn.
- Existing tests stay closer to the previous shape.

Cons:

- The provider-neutral framework depends on a legacy service.
- Brave and Serper adapters would be forced to mimic a Tavily-specific service contract.
- Tavily API behavior remains mixed with compatibility helper methods.

### Option 2: Provider-native Tavily client with compatibility facade

Pros:

- Aligns Tavily with the provider framework now.
- Keeps existing enrichment/classification code working.
- Moves Tavily auth, payload, health, and error metadata behavior into a small dedicated module.
- Makes future provider orchestration cleaner because adapters call native provider clients directly.

Cons:

- Requires updating tests from body API-key auth to bearer header auth.
- Leaves compatibility helper methods in place until generic web-search enrichment replaces them.

### Option 3: Full Tavily endpoint/UI removal now

Pros:

- Eliminates legacy Tavily naming immediately.

Cons:

- Too broad for this slice.
- High risk to settings, setup, enrichment retry, and user muscle memory.
- Would force UI and queue migrations before the provider framework is fully consumed.

## Final Recommendation Stack

1. Add a provider-native `tavilyProviderClient.mjs`.
2. Use Tavily bearer auth headers and optional project tracking headers.
3. Keep request payloads bounded through shared web-search result limits.
4. Preserve HTTP response metadata so provider-neutral error taxonomy can classify auth, quota, rate-limit, and provider failures.
5. Convert `tavily.mjs` into a compatibility facade for older enrichment and settings call sites.
6. Wire `tavilyWebSearchProvider.mjs` to the provider-native client while still supporting legacy dependency injection in tests.
7. Defer UI rename/removal until the generic Web Search Providers settings page exists.

## Implemented Outcome

- Added `server/src/services/tavilyProviderClient.mjs`.
- Tavily requests now send the API key via `Authorization: Bearer ...` instead of `api_key` in the request body.
- Added optional `X-Project-ID` support for future provider usage attribution.
- Centralized Tavily search payload construction, search-depth validation, result-count clamping, health checks, and test-connection probes.
- Preserved HTTP status, response, retry headers, and network error codes for provider-neutral error taxonomy handling.
- Converted `server/src/services/tavily.mjs` into a compatibility facade that keeps `searchIMDB`, `getContentAdvisory`, `searchAnimeInfo`, `getReviewInfo`, and `formatForAI` stable.
- Updated `server/src/services/tavilyWebSearchProvider.mjs` to call the provider-native client and consume provider-neutral nested config values.

## Legacy Compatibility

Legacy support remains intentional:

- Existing `tavily_config` projection through `webSearchProviderStorage.mjs` still works.
- Existing metadata enrichment code can continue calling `tavilyService.search(...)`.
- Existing settings routes can continue testing and searching with the old service interface.
- Provider-neutral config can pass nested `config.searchDepth`, `config.maxResults`, `config.includeDomains`, and `config.excludeDomains`.

The next removal boundary should be the generic Web Search Providers UI and orchestrator adoption. Until then, the facade prevents breaking current users.

## Security Notes

- API keys are no longer serialized into Tavily JSON bodies.
- API keys are never placed in URLs.
- Provider failures keep structured metadata for server-side handling, but test/health responses return bounded messages.
- Search payloads remain bounded by the shared provider maximum.
- Raw provider results still flow through `webSearchResultNormalizer.mjs` before prompt use in provider-compatible paths.

## Validation

Focused server validation:

```powershell
cd server
node ./scripts/run-jest.mjs --testPathPatterns="tavily|webSearchProviderContract|webSearchProviderErrorTaxonomy|webSearchResultNormalizer" --runInBand --no-coverage
```

Result:

```text
Test Suites: 6 passed, 6 total
Tests: 82 passed, 82 total
```

## Next High-Value Design Targets

1. Provider orchestration and fallback routing: consume provider configs and usage/cooldown state so Tavily, Brave, and Serper can be selected through one policy.
2. Web Search Providers settings UI: replace the Tavily-only settings page with provider cards while preserving old Tavily deep links.
3. Tavily-specific queue naming cleanup: rename generic queue, command-center, and status concepts from "Tavily" to "Web Search" after orchestration owns execution.
