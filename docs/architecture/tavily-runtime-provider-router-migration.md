# Tavily Runtime Provider-Router Migration

Status: implemented
Date: 2026-06-24

## Decision

Move all new web-search enrichment and retry execution from direct Tavily
services to the configured, quota-aware web-search provider router.

Keep existing Tavily settings, historical metadata, retry rows, and read
projections compatible. Do not rewrite historical records merely to rename a
provider capability.

## Problem

The provider framework already supported Tavily, Brave Search, and Serper.dev
configuration, normalized results, usage accounting, routing, and route
diagnostics. Classification enrichment and retry processing still called
Tavily-specific services directly. That bypassed configured provider priority,
cooldowns, quota limits, cache usage, and fallback behavior.

It also caused two competing meanings:

```text
Tavily = a configured provider
Tavily = the generic product capability used for web-search enrichment
```

The second meaning prevented other configured providers from participating in
enrichment and retry processing.

## Research

The implemented design follows these current official sources:

- [Tavily Search API](https://docs.tavily.com/documentation/api-reference/endpoint/search):
  Tavily uses bearer-token authentication and bounds `max_results` to 0-20.
- [Tavily rate limits](https://docs.tavily.com/documentation/rate-limits):
  provider limits can reject requests and must be handled as an expected
  operational outcome.
- [RFC 6585, section 4](https://datatracker.ietf.org/doc/html/rfc6585#section-4):
  HTTP 429 may include `Retry-After`, which should control cooldown handling.
- [OWASP API4: Unrestricted Resource Consumption](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/):
  external API integrations need bounded requests, rate limits, and
  consumption controls.
- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html):
  credentials must not appear in normal logs, diagnostics, or client-facing
  projections.

## Options Considered

### 1. Retain direct Tavily execution

Pros:

- Lowest short-term change.
- Existing Tavily-specific tests need little modification.

Cons:

- Brave and Serper cannot serve enrichment or retries.
- Bypasses provider quotas, cooldowns, cache, and route diagnostics.
- Preserves Tavily as a generic workflow name.

Rejected.

### 2. Add provider selection inside each legacy Tavily service

Pros:

- Can preserve most call sites.
- Looks incremental.

Cons:

- Duplicates routing policy in each execution surface.
- Makes cache, error handling, and evidence persistence inconsistent.
- Keeps deprecated service boundaries alive as technical debt.

Rejected.

### 3. Use the provider router with provider-neutral request and evidence modules

Pros:

- One execution path for provider priority, quota, cooldown, cache, and typed
  fallback behavior.
- New evidence records preserve the actual responding provider.
- Small, composable modules keep queue, retry, and classification concerns
  separate.
- Historical Tavily records remain readable without unsafe data rewrites.

Cons:

- Requires a compatibility bridge for historical retry queue values and
  metadata.
- Test fixtures must distinguish legacy storage terminology from new runtime
  terminology.

Selected.

## Final Architecture

```text
classification metadata enrichment
queue metadata enrichment
retry enrichment
          |
          v
webSearchEnrichmentService
          |
          v
webSearchProviderRouter
          |
          +--> quota and cooldown policy
          +--> provider registry
          +--> cache-aware executor
          +--> normalized provider response
          |
          v
provider-neutral evidence builders
          |
          v
media_server_items.metadata.web_search_*
```

The migration adds these modular boundaries:

- `webSearchEnrichmentRequests.mjs`: bounded, purpose-specific requests.
- `webSearchEnrichmentService.mjs`: router-backed enrichment facade with a
  bounded six-hour cache TTL.
- `webSearchEnrichmentEvidence.mjs`: bounded provider-neutral evidence and
  IMDb extraction.
- `queueWebSearchEnrichmentService.mjs`: queue enrichment for advisory,
  holiday, and anime evidence.
- `enrichmentRetryWebSearch.mjs`: retry execution and legacy monthly-quota
  deferral compatibility.

The legacy direct Tavily runtime modules are removed.

## Compatibility Contract

| Existing data or API contract | Migration behavior |
| --- | --- |
| `tavily_*` metadata | Remains readable and contributes to historical state/read models. |
| `enrichment_provider_state = tavily` or `omdb+tavily` | Remains valid historical state. |
| New enrichment evidence | Writes `web_search_*` metadata with the actual provider identity. |
| New state values | Uses `web_search` or `omdb+web_search`. |
| Existing retry rows with `enrichment_type = tavily` | Are accepted and executed through the generic router. |
| New retry rows | Default to `enrichment_type = web_search`. |
| Legacy monthly Tavily quota row | May remain deferred only when Tavily is the sole available candidate and its quota is exhausted. |
| Tavily configuration endpoints and settings | Remain compatible through the existing configuration bridge. |

The database migration expands the existing state check constraint. It does not
mutate user data, avoiding long-running locks and preserving audit history.

## Error, Retry, and Security Rules

- Only typed provider failures can trigger fallback: authentication/forbidden,
  quota/rate-limit, timeout, network/TLS, not-found, malformed provider
  response, and provider 5xx errors.
- Invalid requests do not fall through to another provider. Retrying malformed
  input would spend quota without changing the outcome.
- Router errors expose only sanitized provider keys, error categories, HTTP
  status, and bounded retry-after values. API keys, raw response bodies, and
  search text stay out of diagnostics.
- Purpose-specific builders bound result counts to 2-3 and constrain trusted
  domains for IMDb, holiday, and anime evidence.
- Evidence persistence truncates provider content before storage and downstream
  prompt use.
- Provider usage cache and cooldowns are applied consistently because all new
  runtime calls use the same router.

## Validation

Focused server coverage verifies:

- Router fallback after a typed, quota-related provider failure.
- No fallback after invalid input.
- Bounded generic queue enrichment for advisory, holiday, and anime data.
- Generic retry persistence to `web_search_imdb`.
- Historical Tavily retry compatibility and monthly-quota deferral.
- Generic state detection, read-model counters, queue routes, and UI-facing
  projections.

The repository migration checks and complete server/client suites remain the
release gate.

## Follow-up Targets

1. **Provider usage retention and cache compaction**: bound long-term
   `web_search_provider_usage` and cache growth while retaining the aggregate
   window required for quota-aware routing.
2. **Sanitized route-decision history**: persist a short retention record of
   selected providers, skip reasons, and typed outcomes to diagnose provider
   changes without retaining queries or secrets.
3. **Purpose-aware provider quality calibration**: use outcome feedback to
   rank providers differently for metadata, content advisory, holiday, and
   anime searches without treating search evidence as deterministic truth.
