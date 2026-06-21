# Brave and Serper Adapter Activation

## Goal

Activate Brave Search and Serper.dev as first-class web-search providers without
weakening the existing provider contract, quota-aware routing controls, result
normalization, or secret-handling guarantees.

This implementation deliberately does not redirect the existing Tavily-specific
enrichment and retry runtime. That migration needs separate compatibility tests
because existing installations have Tavily persistence and queue semantics.

## Research

The search MCP was unavailable during this work because its upstream endpoint
returned Cloudflare HTTP 403. The implementation was therefore checked against
the following direct, official sources on 2026-06-21:

- [Brave Search API web-search reference](https://api-dashboard.search.brave.com/api-reference/web/search/get):
  `X-Subscription-Token` authentication, bounded result count, country, and
  Safe Search request controls.
- [Serper.dev](https://serper.dev/): the Google search API and regional request
  options used by the provider integration.
- [OWASP API4:2023 - Unrestricted Resource Consumption](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/):
  require bounded requests and protect quota-limited APIs from uncontrolled
  consumption.
- [RFC 6585](https://datatracker.ietf.org/doc/html/rfc6585): HTTP 429 and
  `Retry-After` semantics.
- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html):
  minimize secret exposure and avoid logging credentials.

No provider credentials or billable API calls were used for development or test
validation.

## Options Considered

### Option A: Store provider configuration only

Pros:

- Lowest immediate implementation cost.
- No additional outbound request behavior.

Cons:

- Users cannot test or route to stored providers.
- Leaves a misleading, partially implemented settings surface.

### Option B: Add direct Brave and Serper calls to legacy enrichment paths

Pros:

- Makes current enrichment use the new providers immediately.

Cons:

- Duplicates contract, normalization, cache, quota, and error logic.
- Risks changing legacy retry and persisted Tavily behavior without a migration
  boundary.

### Option C: Activate providers behind the established adapter and router

Pros:

- Uses one provider contract, error taxonomy, cache-aware executor, and quota
  policy for all active adapters.
- Keeps requests bounded, normalized, and testable with injected clients.
- Enables settings test actions and provider selection without exposing keys.
- Creates a controlled boundary for the later legacy-runtime migration.

Cons:

- Existing Tavily-specific enrichment and retry paths do not switch providers
  until the dedicated compatibility migration is implemented.

## Recommendation Stack

1. Use Option C for new provider activation.
2. Keep provider credentials server-side; return masked values only and never
   include credentials in diagnostics or logs.
3. Enforce the common request contract before each provider call, cap result
   counts, and run requested-domain filtering after response normalization.
4. Map provider failures to the shared taxonomy, preserving HTTP 429 and
   `Retry-After` for cooldown and quota routing.
5. Migrate legacy Tavily runtime consumers to the router in a separate slice
   with configuration bridge and retry-queue compatibility tests.

## Implemented Design

### Provider clients

- `braveProviderClient.mjs` sends requests to Brave with
  `X-Subscription-Token`, an explicit 30-second timeout, bounded `count`,
  two-letter `country`, and strict Safe Search by default.
- `serperProviderClient.mjs` sends requests to Serper with `X-API-KEY`, an
  explicit 30-second timeout, bounded `num`, validated `gl`/`hl`, and
  `autocorrect: false` to preserve exact media title/year identity.
- Shared client support requires a non-empty API key, preserves structured
  transport metadata for taxonomy mapping, and returns concise connection-test
  results.

### Adapters and normalization

- Brave and Serper adapters validate every common request and response.
- Both normalize native response shapes through the existing normalizer.
- When a caller requests domains, the adapter fetches only the bounded maximum
  needed for filtering, then filters normalized `sourceDomain` values before
  returning the requested result count. Provider-specific query syntax cannot
  bypass the common domain contract.
- Serper advertises `safeSearch: false` because the adapter does not expose an
  equivalent provider-level control. The settings UI does not imply otherwise.

### Registry and settings

- Brave and Serper now have `adapterAvailable: true`, so they are eligible for
  the existing settings test endpoint and quota-aware router once configured.
- The settings UI exposes only validated, provider-relevant configuration:
  Brave country and strict Safe Search; Serper country and language.
- Keys remain write-only, and blank key input retains the stored secret under
  the existing provider storage rules.

## Validation

Fixture-backed tests cover:

- Request headers, bounded payload/query construction, regional validation,
  defaults, and timeout propagation.
- Adapter contract validation, normalization, domain filtering, and taxonomy
  mapping for rate-limit and quota responses.
- Provider registry activation and settings validation.

Broader server, client, lint, build, and schema checks are recorded with the
implementation change.

## Follow-Up Work

1. **Legacy Runtime Migration to Provider Routing** — replace direct
   Tavily-specific enrichment/retry execution with the router while preserving
   `tavily_config`, historical queue values, and recovery behavior.
2. **Provider Usage Retention and Cleanup** — add bounded deletion policies and
   aggregation-safe retention for cache and usage rows.
3. **Route Decision History** — retain a bounded, credential-free history of
   selected and skipped providers for post-incident diagnosis.
