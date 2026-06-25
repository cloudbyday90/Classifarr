# Web Search Provider Usage Retention

Status: implemented

## Purpose

Web-search provider routing now records provider usage events and normalized
cache entries. Those rows are useful for quota-aware routing, diagnostics, and
cache savings, but they are append-heavy operational data. The retention layer
keeps the current quota month intact, removes old detailed events in bounded
batches, and purges expired cache entries on a schedule.

## Official Guidance Reviewed

- OWASP API4:2023 recommends rate limiting, maximum input sizes, and spending
  controls for service-provider integrations:
  <https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/>
- OWASP Logging guidance warns that logs can contain sensitive data and should
  be protected, consistent, and limited to what supports the operational goal:
  <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>
- OWASP Secrets Management guidance reinforces that API credentials must not
  leak through operational data:
  <https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html>
- NIST Privacy Framework treats retention and disposal as part of the data
  lifecycle, supporting purpose-limited operational retention:
  <https://www.nist.gov/privacy-framework>
- PostgreSQL documents that time-based retention can use ordinary deletes, while
  table partitioning is better reserved for very large retention workloads:
  <https://www.postgresql.org/docs/current/sql-delete.html>
  <https://www.postgresql.org/docs/current/ddl-partitioning.html>
- Tavily documents rate-limit handling through HTTP `429` and `retry-after`,
  reinforcing that recent usage/cooldown state must remain accurate:
  <https://docs.tavily.com/documentation/rate-limits>

## Design Options

### Option A: No retention

Pros:

- No scheduler or migration work.
- Maximum historical detail.

Cons:

- Append-only usage rows grow forever.
- More operational data than needed for current routing.
- Diagnostics become noisier over time.

### Option B: Delete by fixed age only

Pros:

- Simple.
- Easy to make configurable.

Cons:

- A short retention value could delete current-month usage and break monthly
  soft-limit routing.
- Does not address expired response-cache rows unless paired with cache cleanup.

### Option C: Purpose-aware bounded retention

Pros:

- Keeps the full current quota month regardless of configured retention.
- Preserves recent diagnostics while bounding detailed operational history.
- Cleans expired cache entries through the same maintenance path.
- Uses small delete batches to avoid long locks.

Cons:

- Requires one scheduler hook and a retention service.
- Adds a setting that must be documented and tested.

### Option D: Partitioned usage tables

Pros:

- Best fit for very large time-series retention.
- Dropping partitions avoids large delete/vacuum work.

Cons:

- More schema complexity than the current workload needs.
- Requires more migration and operational handling.
- Premature for a self-hosted app with bounded provider usage.

## Final Recommendation

Use Option C now. Keep Option D as a future scale path if usage rows become a
large operational table.

Implementation stack:

- `webSearchProviderRetentionService.mjs` owns provider usage/cache cleanup.
- `settings.web_search_provider_usage_retention_days` defaults to `62`.
- Usage deletion uses:

```sql
searched_at < LEAST(now - retention_days, date_trunc('month', now))
```

That protects current-month quota accounting even if an operator configures a
short retention window.

- Deletion uses bounded batches with deterministic `searched_at, id` ordering.
- Expired cache entries continue using `webSearchProviderUsageCache.deleteExpired`.
- Scheduler runs provider retention daily at 03:14.

## Security Controls

- Retention deletes only operational usage/cache rows, not provider
  configuration or API keys.
- Cache identities are SHA-256 fingerprints; raw API keys are already excluded
  from cache keys and metadata.
- Detailed usage retention is bounded by purpose, while current-month quota
  data remains available for route decisions.
- Cleanup errors are logged without throwing from the scheduler path.

## Outcome

Added:

- `database/migrations/20260624_220000_add_web_search_provider_retention.sql`
- `server/src/services/webSearchProviderRetentionService.mjs`
- scheduler integration through `SchedulerRetentionService`
- daily scheduler registration
- unit coverage for policy normalization, usage deletion, cache cleanup, and
  scheduler delegation
- schema snapshot coverage for fresh installs

## Validation

Targeted validation:

```bash
cd server
node ./scripts/run-jest.mjs --testPathPatterns="services/webSearchProviderRetentionService|schedulerRetentionService|scheduler|migrations" --runInBand --no-coverage
```

Broader validation:

```bash
npm --prefix server run test:unit
npm --prefix server run typecheck
npm --prefix server run lint:server:security
```

## Next High-Value Items

1. Route decision history.
   Intent: retain sanitized route-attempt decisions after the request completes
   so operators can diagnose provider selection and fallbacks without logs.

2. Purpose-aware provider quality calibration.
   Intent: tune provider acceptance by enrichment purpose instead of treating
   all web-search results as equally useful.

3. Provider health/cooldown preview.
   Intent: show when a provider is in cooldown and when it becomes eligible
   again, using the same sanitized state the router already consumes.
