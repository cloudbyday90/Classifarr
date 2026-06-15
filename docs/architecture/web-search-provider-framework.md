# Web Search Provider Framework Roadmap

Status: active roadmap. The first hardening slices are implemented: provider-neutral result normalization, prompt-safe formatting, runtime provider contract validation, provider-neutral error taxonomy, provider config/usage storage, and Tavily provider-client modernization.

## Goal

Expand Classifarr from a Tavily-specific web-search integration to a provider-neutral web search framework that can use Tavily, Brave Search API, Serper.dev, and future providers without duplicating classification, enrichment, retry, settings, and observability logic.

The user-facing goal is:

```text
Use the available free/low-cost search quota across providers without changing how classification works.
```

The engineering goal is:

```text
Normalize provider-specific search APIs behind one secure, observable, quota-aware contract.
```

## Current Problem

Tavily is currently embedded as a product concept instead of one implementation of a broader capability.

Today, "Tavily" appears in several different responsibilities:

- Settings API and UI.
- Health status and service-status UI.
- Queue enrichment retry state.
- OMDb fallback enrichment.
- Classification AI prompt formatting.
- Command Center counters and retry actions.
- Provider-specific quota deferral handling.

That makes adding Brave or Serper risky because a direct copy of Tavily would multiply the same concepts across the codebase.

## Design Principle

Search providers should be adapters. Classifarr should reason about normalized web-search evidence.

Current:

```text
classification/enrichment -> tavilyService -> Tavily response shape
```

Target:

```text
classification/enrichment
        -> webSearchOrchestrator
        -> provider registry
        -> provider adapter
        -> normalized web-search evidence
```

Provider-specific behavior belongs at the adapter boundary. Classification and enrichment should not need to know whether a result came from Tavily, Brave, or Serper except for traceability, scoring, and quota reporting.

## Research Notes: May 2026

Official provider and security docs point to the same hardening direction:

- Tavily's search response includes structured `results`, `answer`, `usage`, and `request_id`, while `max_results` is bounded to `0 <= x <= 20`. Tavily also documents that `advanced` depth costs more credits than `basic`, and rate-limit responses use HTTP `429` plus `retry-after`.
- Brave's Web Search API caps web `count` at 20, supports safe-search settings, and publishes separate product capacity/pricing for Search vs Answers. This means provider cost and result-count limits must be modeled per provider.
- Serper advertises a free query allowance and returns Google-style SERP structures such as `organic` results with `title`, `link`, `snippet`, and `position`, so normalization must support non-Tavily shapes.
- OWASP API Security guidance for unrestricted resource consumption recommends maximum sizes on incoming parameters/payloads, rate limiting, throttling, and spending limits for service-provider/API integrations.
- OWASP authentication guidance treats API keys as API-client credentials, not user authentication. Classifarr should continue storing provider API keys as admin-managed credentials and never use them to identify Classifarr users.

Source URLs:

- https://docs.tavily.com/documentation/api-reference/endpoint/search
- https://docs.tavily.com/documentation/rate-limits
- https://api-dashboard.search.brave.com/api-reference/web/search/get
- https://api-dashboard.search.brave.com/documentation/pricing
- https://serper.dev/
- https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/
- https://owasp.org/API-Security/editions/2023/en/0xa2-broken-authentication/

## Hardening Recommendation

The highest-value next item is:

```text
Provider-neutral result normalization and prompt-safe evidence formatting.
```

Intent:

- Keep raw provider response shapes at the adapter boundary.
- Drop unsafe/non-HTTP result URLs.
- Bound result counts to the strictest shared provider maximum used by Tavily and Brave.
- Collapse and truncate provider text before it reaches AI prompts.
- Preserve provider identity and source domains for traceability.
- Support Tavily `results[]` and Serper-style `organic[]` shapes before Brave/Serper adapters exist.

Pros:

- Reduces prompt-injection and resource-consumption surface before adding more providers.
- Creates a reusable adapter boundary for Brave and Serper.
- Keeps existing Tavily behavior compatible.
- Makes future provider quality scoring easier because every result has one normalized shape.

Cons:

- Does not yet provide quota-aware provider routing.
- Does not yet persist provider usage.
- Does not yet add Brave or Serper settings.
- A small prompt heading change exposes provider identity, which is desirable but still a visible output change in tests.

Final recommendation stack:

```text
1. Normalize and bound provider results before prompt use.
2. Keep Tavily wired through the normalizer without changing outbound behavior except max-result clamping.
3. Add provider config/usage storage next.
4. Add quota-aware fallback routing after storage exists.
5. Add Brave/Serper adapters only after Tavily is stable behind the generic contract.
```

## Non-Goals

- Do not remove Tavily support in the first implementation.
- Do not force users to configure multiple providers.
- Do not treat all provider rankings as equivalent.
- Do not use web-search evidence as deterministic truth.
- Do not rewrite the classification prompt stack in the same change.
- Do not expose raw provider responses to the UI as the primary contract.

## Provider Contract

Each provider adapter should implement a common ES module contract:

```js
{
  providerKey: 'tavily',
  displayName: 'Tavily',
  capabilities: {
    generalSearch: true,
    answerSummary: true,
    siteSearch: true,
    safeSearch: true
  },
  testConnection(config),
  search(request, config)
}
```

Search request:

```js
{
  purpose: 'classification' | 'content_advisory' | 'holiday' | 'anime' | 'manual_test',
  query: 'Office Romance 2026 parental guide',
  media: {
    title: 'Office Romance',
    year: 2026,
    mediaType: 'movie',
    tmdbId: 1358005
  },
  options: {
    maxResults: 5,
    includeAnswer: true,
    safeSearch: true,
    domains: []
  },
  traceContext: {
    correlationId: '...',
    classificationId: 13300
  }
}
```

Normalized response:

```js
{
  provider: 'tavily',
  providerRequestId: null,
  query: 'Office Romance 2026 parental guide',
  answer: 'optional provider summary',
  results: [
    {
      title: '...',
      url: 'https://...',
      snippet: '...',
      rank: 1,
      score: 0.74,
      publishedAt: null,
      sourceDomain: 'example.com',
      providerMetadata: {}
    }
  ],
  usage: {
    costUnits: 1,
    quotaBucket: 'monthly'
  },
  warnings: []
}
```

## Provider Modes

Initial modes should stay simple:

- `primary_only`: use the selected provider only.
- `fallback`: try providers in priority order until one succeeds.
- `quota_aware`: skip providers that are disabled, rate-limited, in cooldown, or over their configured soft quota.

Later modes:

- `round_robin`: distribute ordinary searches evenly.
- `quality_weighted`: prefer providers with better recent match quality for the same purpose.
- `multi_provider_consensus`: query more than one provider only for ambiguous or high-impact cases.

Recommended first shipped mode:

```text
quota_aware fallback
```

This gives the benefit the user wants, spreading free quota, without tripling search calls for every item.

## Evidence Quality Rules

Provider expansion should not make classification noisier.

Minimum rules:

- Every normalized result must keep `provider`, `rank`, `url`, and `sourceDomain`.
- Provider rank is not confidence by itself.
- Search evidence should be traceable in the decision trace.
- Provider-specific answer summaries should be marked as summaries, not facts.
- Classification prompts should receive a compact normalized evidence block, not raw JSON.
- The scoring layer should be able to down-weight providers or result types independently.

Recommended first calibration:

```text
Tavily, Brave, and Serper all produce normalized evidence,
but the policy/classification scorer assigns provider reliability weights separately.
```

## Configuration Model

The first migration should introduce generic provider configuration while preserving existing Tavily settings.

Suggested table:

```sql
CREATE TABLE web_search_provider_config (
  id SERIAL PRIMARY KEY,
  provider_key VARCHAR(40) NOT NULL UNIQUE,
  display_name VARCHAR(120) NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  priority INTEGER NOT NULL DEFAULT 100,
  api_key TEXT,
  config JSONB NOT NULL DEFAULT '{}',
  soft_daily_limit INTEGER,
  soft_monthly_limit INTEGER,
  cooldown_until TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error_at TIMESTAMPTZ,
  last_error_code VARCHAR(80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Suggested usage table:

```sql
CREATE TABLE web_search_provider_usage (
  id BIGSERIAL PRIMARY KEY,
  provider_key VARCHAR(40) NOT NULL,
  purpose VARCHAR(60) NOT NULL,
  status VARCHAR(40) NOT NULL,
  cost_units INTEGER NOT NULL DEFAULT 1,
  searched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  correlation_id UUID,
  classification_id BIGINT,
  error_code VARCHAR(80)
);
```

Legacy bridge:

- Keep `tavily_config` reads working during the first phase.
- On read, project active Tavily config into the provider-neutral shape.
- On save from the new UI, write through the new provider table.
- Keep a compatibility endpoint or response shape for old Tavily settings until the UI is fully migrated.

## Security Requirements

- API keys must use the existing encryption helpers or an equivalent shared credential path.
- API keys should be masked in every read response.
- Provider test endpoints must be admin-only and rate-limited.
- Search endpoints must be admin-only or internal-only unless explicitly exposed later.
- Logs must include provider keys and error codes, not raw API keys or full sensitive payloads.
- Provider responses must be normalized and length-limited before being passed to AI prompts.
- URLs must be treated as untrusted external content.
- Per-provider timeouts and retry limits must be bounded.

## Observability Requirements

Every search should produce a compact trace event:

```js
{
  stage: 'web_search',
  provider: 'brave',
  purpose: 'content_advisory',
  outcome: 'success' | 'skipped' | 'rate_limited' | 'failed',
  duration_ms: 482,
  result_count: 5,
  quota_state: 'within_limit',
  correlation_id: '...'
}
```

Admin UI should show:

- Provider status.
- Last success.
- Last error.
- Daily/monthly usage counts.
- Current cooldown.
- Whether the provider is eligible for routing.

Command Center should eventually rename Tavily-specific counters to generic web-search enrichment counters, with a provider breakdown available in detail views.

## Implementation Phases

### Phase 0: Current-State Audit

Inventory every Tavily dependency before editing behavior:

- `server/src/services/tavily.mjs`
- `server/src/services/queueTavilyEnrichmentService.mjs`
- `server/src/services/classificationMetadataService.mjs`
- `server/src/services/classificationAiService.mjs`
- `server/src/services/enrichmentRetryService.mjs`
- settings routes and settings dependency builders
- `client/src/views/settings/Tavily.vue`
- service health/status stores and System view
- Command Center enrichment counters
- migrations and retry state using `tavily`

Exit criteria:

- A replacement map exists for each Tavily-specific surface.
- Tests that lock current Tavily behavior are identified.

### Phase 1: Provider Contract and Normalization

Add the provider-neutral service layer without changing UI behavior:

- `webSearchProviderContract.mjs`
- `webSearchResultNormalizer.mjs`
- `webSearchProviderRegistry.mjs`
- `webSearchOrchestrator.mjs`
- Tavily adapter wrapping existing Tavily behavior.

Exit criteria:

- Existing Tavily tests still pass.
- New contract tests prove provider responses normalize consistently.
- Classification/enrichment can call the orchestrator for Tavily without behavior drift.

Implemented slice:

- Added `webSearchResultNormalizer.mjs`.
- Added `webSearchProviderContract.mjs`.
- Added `webSearchProviderErrorTaxonomy.mjs`.
- Added `webSearchProviderStorage.mjs`.
- Added `web_search_provider_config` and `web_search_provider_usage`.
- Added a contract-compatible `tavilyWebSearchProvider.mjs` wrapper for future orchestration.
- Tavily `formatForAI(...)` now formats through normalized web-search evidence.
- Tavily outbound `max_results` is clamped to the shared hard maximum of 20.
- Normalization currently supports Tavily-style `results[]` and Serper-style `organic[]` payloads.
- Non-HTTP result URLs are dropped before prompt formatting.
- Provider text is collapsed and length-limited before entering prompts.
- Normalizer hardening is detailed in `docs/architecture/web-search-normalizer-hardening.md`.
- Provider contract validation is detailed in `docs/architecture/web-search-provider-contract-validation.md`.
- Provider error taxonomy is detailed in `docs/architecture/web-search-provider-error-taxonomy.md`.
- Provider config and usage storage are detailed in `docs/architecture/web-search-provider-config-usage-storage.md`.
- Tavily modernization is detailed in `docs/architecture/tavily-modernization.md`.
- Web Search Providers settings UI is detailed in `docs/architecture/web-search-providers-settings-ui.md`.

### Tavily Modernization Slice

Implemented slice:

- Added `tavilyProviderClient.mjs` as the provider-native Tavily client.
- Moved Tavily outbound auth to `Authorization: Bearer ...` headers with optional `X-Project-ID` support.
- Converted `tavily.mjs` into a compatibility facade for existing enrichment and settings code.
- Updated `tavilyWebSearchProvider.mjs` so the provider wrapper calls the provider-native client and consumes provider-neutral nested config.
- Preserved legacy dependency injection for existing tests and staged migration code.

### Phase 2: Configuration Storage and Legacy Bridge

Add generic provider config tables and bridge existing Tavily settings:

- New migration for `web_search_provider_config`.
- New migration for `web_search_provider_usage`.
- Backfill Tavily config into `web_search_provider_config`.
- Compatibility read/write support for existing Tavily endpoint shape.

Exit criteria:

- Existing Tavily settings UI still works.
- New provider config service can read Tavily as provider-neutral config.
- API keys remain masked in provider-neutral read models.

Implemented slice:

- Added generic provider config and usage tables.
- Backfilled Tavily config into provider-neutral storage during migration when legacy `tavily_config` exists.
- Seeded disabled Brave and Serper config rows for future adapters.
- Added `webSearchProviderStorage.mjs` for masked config reads, legacy Tavily projection, config upsert, usage recording, and last success/error state updates.
- Updated `database/schema/current.sql` so fresh installs include the provider-neutral storage model.

### Phase 3: Routing, Quota, and Cooldown

Implement provider selection:

- `primary_only`.
- `fallback`.
- `quota_aware`.
- Soft daily/monthly limits.
- Cooldown after rate-limit/auth/network failures.
- Usage recording for success, failure, and skipped provider attempts.

Exit criteria:

- Unit tests cover provider order, quota skip, cooldown skip, and fallback.
- Retry queue no longer needs Tavily-specific quota assumptions for new paths.
- Decision traces show provider attempts and routing outcomes.

### Phase 4: Brave and Serper Adapters

Add providers behind the framework:

- `braveSearchProvider.mjs`
- `serperSearchProvider.mjs`
- Provider-specific config validation.
- Provider-specific test connection.
- Normalized result mapping tests using fixture responses.

Exit criteria:

- Both providers can be enabled independently.
- Provider test endpoints validate credentials without exposing secrets.
- Search orchestration can fall back across Tavily, Brave, and Serper.

### Phase 5: Settings UI Modernization

Replace the Tavily-only page with a Web Search Providers page:

- Provider cards for Tavily, Brave, Serper.
- Enable/disable.
- API key.
- Priority.
- Soft daily/monthly limits.
- Test connection.
- Last status and quota summary.

Compatibility:

- Existing `/settings?tab=tavily` should redirect or deep-link to the Tavily card.
- Existing labels can mention "Tavily" only where provider-specific.

Exit criteria:

- Users can configure Tavily exactly as before.
- Users can add Brave/Serper without touching raw JSON or environment variables.

Implemented slice:

- Replaced the Tavily-only settings view with a provider-neutral Web Search Providers settings view.
- Added provider cards for Tavily, Brave Search, and Serper.dev.
- Added provider enablement, API key, priority, and soft daily/monthly limit controls.
- Kept Tavily-specific search-depth and domain-filter controls.
- Added provider-neutral settings API routes for listing, updating, and testing providers.
- Preserved `/settings?tab=tavily` as an alias to the new Web Search tab.
- Mirrored Tavily provider writes back to `tavily_config` until runtime consumers fully migrate.

### Phase 6: Classification and Enrichment Cleanup

Remove Tavily-specific naming from generic flows:

- Rename queue service concepts from Tavily fallback to web-search fallback where safe.
- Keep database enum/string compatibility where migration risk is high.
- Update command-center labels to "Web Search" with provider breakdown.
- Update health status from `tavily` only to `webSearch` aggregate plus providers.

Exit criteria:

- No user-facing generic workflow says "Tavily" unless the provider selected is Tavily.
- Existing historical rows still render correctly.
- Retry processing can handle provider-neutral enrichment types.

## Testing Strategy

Server tests:

- Provider contract validation.
- Normalization fixtures for Tavily, Brave, Serper.
- Orchestrator routing modes.
- Quota and cooldown decisions.
- Config encryption/masking.
- Compatibility reads for existing Tavily config.
- Classification prompt formatting from normalized evidence.
- Retry queue behavior when providers are exhausted.

Client tests:

- API layer functions for provider config.
- Provider settings card validation.
- Legacy Tavily tab compatibility.
- System/service-status display.
- Command Center web-search counters.

Integration checks:

- Fresh install with no providers configured.
- Existing install with only Tavily configured.
- Existing install with Tavily monthly quota deferred rows.
- Multi-provider fallback where Tavily fails and Brave succeeds.
- All providers disabled or exhausted.

## Migration Risk

High-risk areas:

- `enrichment_retry_queue.enrichment_type = 'tavily'` has historical meaning.
- `media_server_items.enrichment_provider_state` includes `tavily`.
- Dashboard and Command Center counters expect Tavily-specific fields.
- Health response currently exposes a `tavily` field.

Mitigation:

- Do not rename persisted values in the first framework phase.
- Add provider-neutral fields alongside legacy fields.
- Keep legacy response fields until the UI migration is complete.
- Migrate display labels separately from storage values.

## Recommended First Implementation Slice

The first code slice should be:

```text
Provider contract + Tavily adapter + normalized orchestrator path,
with existing Tavily behavior preserved.
```

This is intentionally boring. It creates the extension point without changing quota behavior, UI semantics, or persisted data.

After that, provider-neutral config and usage tracking can be added safely.

## Open Questions

- Should provider usage limits be hard stops, soft warnings, or both?
- Should each purpose have its own provider priority order?
- Should classification use more than one provider only when confidence is low?
- Should web-search evidence be cached by query hash to reduce quota usage?
- Should provider reliability weights be user-configurable or internal-only at first?
- How long should provider cooldown last after 401, 403, 429, 5xx, or timeout failures?

## Next High-Value Items

1. **Provider Usage Cache** — cache normalized search responses by query/purpose/provider for a bounded TTL to reduce repeated free-tier usage.
2. **Provider Reliability Calibration** — track which provider evidence later agrees with final outcomes so provider weights can be adjusted.
3. **Web Search Evidence Trace UI** — show which provider was queried, why it was selected, what was skipped, and how the results affected classification.
