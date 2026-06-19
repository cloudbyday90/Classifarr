# Web Search Provider Quota-Aware Routing

## Purpose

Classifarr is moving from a Tavily-only path toward a provider-neutral web-search
framework. The provider settings, usage log, error taxonomy, and usage cache now
exist. This slice adds quota-aware routing so provider selection can be deterministic
and observable before Brave and Serper adapters are activated.

## Official Guidance Reviewed

- Tavily documents environment-specific request-per-minute limits and says `429`
  responses include `retry-after`; clients should respect the header:
  <https://docs.tavily.com/documentation/rate-limits>
- Brave Search API documents bounded request inputs such as max query length,
  `count` min/max, safe-search values, and `429 Too Many Requests` responses:
  <https://api-dashboard.search.brave.com/api-reference/web/search/get>
- Serper.dev documents the Google Search API shape and free query allowance, which
  reinforces tracking usage by provider rather than assuming one global quota:
  <https://serper.dev/>
- OWASP API4:2023 calls out unrestricted resource consumption risks and recommends
  execution limits, rate limits, and spending controls:
  <https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/>
- RFC 6585 defines `429 Too Many Requests` and notes responses may include
  `Retry-After` to communicate how long to wait:
  <https://datatracker.ietf.org/doc/html/rfc6585>

## Design Options

### Option A: Keep Tavily as the hardcoded provider

Pros:

- No routing complexity.
- Lowest short-term risk.

Cons:

- Does not spread free quota across providers.
- Keeps Tavily-specific assumptions in classification/enrichment.
- Cannot use cooldown or usage data for provider selection.

### Option B: Random or round-robin provider selection

Pros:

- Simple provider spreading.
- Easy to explain.

Cons:

- Can pick exhausted providers.
- Ignores cooldown and error state.
- Hard to make deterministic in tests and traces.

### Option C: Quota-aware deterministic routing

Pros:

- Selects the first eligible provider by priority.
- Skips disabled, unconfigured, cooldown-active, quota-exhausted, or adapterless
  providers with explicit reasons.
- Uses the existing provider config and usage log.
- Delegates execution to the cache-aware executor, so cache hits still avoid
  provider quota.

Cons:

- Requires an explicit route-candidate model.
- Needs follow-up UI visibility so operators can understand why a provider was
  skipped.

## Final Recommendation

Use Option C.

Implementation stack:

- `webSearchProviderQuotaPolicy.mjs` for pure route-candidate evaluation.
- `WebSearchProviderStorage.getProviderUsageSummaries(...)` for daily/monthly
  provider usage aggregation.
- `webSearchProviderRouter.mjs` for selection and delegation to
  `webSearchProviderCachedSearch.mjs`.

## Routing Semantics

Provider configs are evaluated in priority order. A provider is eligible only when:

- provider is enabled
- provider has a configured API key
- provider has an adapter available
- provider is not in cooldown
- provider has not reached its soft daily limit
- provider has not reached its soft monthly limit

Skipped providers retain structured reasons:

- `disabled`
- `unconfigured`
- `adapter_unavailable`
- `cooldown_active`
- `daily_quota_exhausted`
- `monthly_quota_exhausted`

If no provider is available, the router throws `WebSearchProviderRoutingError` with
the candidate summary attached for diagnostics.

## Security Controls

- API keys are read only through internal unmasked provider config reads.
- Routing never logs or returns API keys.
- Provider execution still passes through the contract validator and cached-search
  executor.
- Usage summaries aggregate by cost units instead of raw request payloads.
- Cooldown uses provider error state written by the existing error taxonomy.

## Implementation Outcome

Added:

- `server/src/services/webSearchProviderQuotaPolicy.mjs`
- `server/src/services/webSearchProviderRouter.mjs`
- `WebSearchProviderStorage.getProviderUsageSummaries(...)`
- unit tests for quota policy, router selection, executor delegation, no-route
  errors, and usage aggregation

This does not activate Brave or Serper network calls yet. It makes the provider
selection layer ready for those adapters without adding provider-specific routing
branches.

## Validation

```bash
cd server
node ./scripts/run-jest.mjs --testPathPatterns="services/webSearchProviderQuotaPolicy|services/webSearchProviderRouter|services/webSearchProviderStorage|services/webSearchProviderCachedSearch" --runInBand --no-coverage
npm run lint
npm run lint:knip
```

## Follow-Up Status

Route diagnostics in the settings UI is complete. The settings endpoint projects
the selected candidate, skipped reasons, quota totals, cooldowns, and usage counts
without exposing secrets or search data. See
[`web-search-provider-route-diagnostics.md`](web-search-provider-route-diagnostics.md).

## Next High-Value Items

1. Brave and Serper adapter activation.
   Intent: implement real provider adapters behind the existing contract, cache,
   and routing layers so quota spreading becomes operational.

2. Provider usage cleanup and retention.
   Intent: bound long-term growth in `web_search_provider_usage` while preserving
   recent quota math and useful trend data.

3. Route decision history.
   Intent: retain bounded, sanitized route outcomes for troubleshooting provider
   changes, provider outages, and quota events over time.
