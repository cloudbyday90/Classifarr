# Web Search Provider Config and Usage Storage

Status: implemented for the current development line.

## Purpose

Add provider-neutral storage for web-search provider configuration and usage before Classifarr adds quota-aware routing, Brave, Serper.dev, or a new provider settings UI.

This slice creates the database foundation and service layer only. It does not change current Tavily UI/routes or production search routing.

## Research Notes: June 2026

Official sources reviewed:

- PostgreSQL JSON/JSONB documentation recommends `jsonb` for most application storage because it is decomposed, faster to process, and supports indexing, while still enforcing valid JSON input.
- PostgreSQL partial indexes are designed for indexed subsets and can enforce or accelerate common filtered cases without indexing every row.
- PostgreSQL `CREATE INDEX` supports expression and partial indexes, including partial unique/use-case indexes when the predicate is useful.
- OWASP Secrets Management guidance recommends standardizing and centralizing secret management, tracking lifecycle, authorization, and accounting for secrets.
- OWASP Cryptographic Storage guidance recommends minimizing sensitive data storage and considering the threat model before storing protected values.
- OWASP API4:2023 recommends rate limiting, throttling, spending limits, maximum sizes, and provider/API resource bounds.

Source URLs:

- https://www.postgresql.org/docs/current/datatype-json.html
- https://www.postgresql.org/docs/current/indexes-partial.html
- https://www.postgresql.org/docs/current/sql-createindex.html
- https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html
- https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/

## Recommendation

Create two generic tables:

```text
web_search_provider_config
web_search_provider_usage
```

Keep provider-specific knobs inside bounded `jsonb` config while storing routing-critical fields as scalar columns:

- provider key
- enabled state
- priority
- soft limits
- cooldown
- last success/error
- taxonomy error fields
- usage status/result counts

Project legacy `tavily_config` into the generic read model when the generic Tavily row is absent. Existing Tavily routes continue to use `tavily_config` until the provider UI/router migration happens.

## Pros

- Gives future routing a durable source for provider priority, enablement, cooldown, and usage.
- Avoids adding Brave/Serper-specific tables that would duplicate Tavily assumptions.
- Keeps high-query fields scalar and indexed instead of burying everything in JSON.
- Preserves legacy Tavily behavior while enabling gradual migration.
- Stores usage/error events in taxonomy-ready fields suitable for trace UI and quota decisions.

## Cons

- API keys still follow the current metadata-provider storage pattern until a dedicated secret migration is planned.
- Generic config and legacy Tavily config can temporarily coexist.
- This does not yet expose provider config through routes or UI.
- Usage rows are append-only and will need retention policy later.

## Final Stack

```text
legacy tavily_config
  -> webSearchProviderStorage legacy projection

web_search_provider_config
  -> provider enablement / priority / limits / cooldown / last state

web_search_provider_usage
  -> per-attempt usage, result counts, taxonomy errors, trace IDs
```

## Implemented Outcome

Added:

- `database/migrations/20260614_103000_add_web_search_provider_storage.sql`
- `server/src/services/webSearchProviderStorage.mjs`
- `server/src/__tests__/services/webSearchProviderStorage.test.mjs`

Updated:

- `database/schema/current.sql`
- `server/src/__tests__/migrations.test.mjs`
- `docs/architecture/web-search-provider-framework.md`
- `CHANGELOG.md`

The migration:

- creates `web_search_provider_config`
- creates `web_search_provider_usage`
- indexes enabled-provider lookup, cooldown lookup, provider/time usage, status/time usage, correlation ID, and classification ID
- backfills Tavily from legacy `tavily_config` when present
- seeds disabled Brave and Serper provider rows

The service:

- lists and reads generic provider configs
- projects legacy Tavily when no generic Tavily row exists
- masks API keys in read models
- upserts provider configs
- records usage rows
- updates last success/error/cooldown state after usage

## Security Boundaries

- Provider keys are allowlisted by token pattern before SQL execution.
- Read models mask API keys by default.
- Usage storage records taxonomy fields rather than raw provider payloads.
- JSON config is kept for provider-specific options, while routing/security fields remain scalar and constrained.
- `Retry-After` and cooldown inputs stay bounded by the taxonomy layer before being used by storage.

## Verification

Targeted commands:

```bash
cd server
node ./scripts/run-jest.mjs --testPathPatterns="services/webSearchProviderStorage|services/webSearchProviderErrorTaxonomy|services/webSearchProviderContract|migrations" --runInBand --no-coverage
node ./scripts/run-jest.mjs --testPathPatterns="codeHealth" --runInBand --no-coverage
```

Repository-level:

```bash
npm run check-copyright
git diff --check
```

## Remaining Work

Next slices:

1. Quota-aware provider orchestration.
2. Web Search Providers settings API and UI.
3. Provider usage retention and summary rollups.
4. Brave and Serper adapters.
5. Web-search evidence/error trace UI.

## Three More High-Value Design Targets

1. **Usage Retention Policy** — define retention and aggregation so usage rows stay useful without unbounded growth.
2. **Provider Settings API Contract** — add admin-only routes that expose masked config, soft limits, status, and test-connection results.
3. **Legacy Tavily Migration UX** — show operators when Tavily was projected from legacy settings and provide an explicit migration/save path.
