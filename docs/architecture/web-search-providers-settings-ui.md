# Web Search Providers Settings UI

Status: implemented slice.

## Goal

Replace the Tavily-only settings screen with a provider-neutral Web Search Providers screen that can configure Tavily today and stage Brave Search and Serper.dev without exposing raw provider JSON or duplicating settings flows.

The user-facing intent is:

```text
Configure web-search providers in one place, preserve existing Tavily behavior, and prepare for quota-aware provider routing.
```

## Research Notes: June 2026

Official sources point to the same design constraints:

- Vue recommends `v-model` for form input bindings across native input/select controls, which maps well to small provider-card form models rather than hand-built DOM state.
- W3C WAI form guidance emphasizes explicit labels, instructions, and error notification in text. Provider settings therefore use labeled controls, visible stored-key state, and toast-visible save/test feedback.
- OWASP Secrets Management guidance treats API keys as secrets that must not be exposed next to the material used to protect them. Provider read APIs therefore keep returning masked keys only, and the UI never echoes a masked key back as a submitted secret.
- OWASP REST guidance recommends generic client errors while logging operational detail server-side. Provider test routes return bounded validation errors and avoid exposing raw provider payloads or stack traces.
- Tavily documents API-key authentication and a bounded search endpoint. The new screen keeps Tavily-specific search-depth, max-result, include-domain, and exclude-domain controls while storing them in the provider-neutral config model.
- Brave documents a standalone Search API, and Serper presents a Google Search API with free-query onboarding. Both are represented as staged providers until their adapters are implemented and validated.
- PostgreSQL supports idempotent DDL patterns, but the app already uses explicit migrations and schema snapshots. This slice does not add new tables; it consumes the existing provider-neutral config table and keeps Tavily legacy mirroring in application code.

Source URLs:

- https://vuejs.org/guide/essentials/forms
- https://www.w3.org/WAI/tutorials/forms/
- https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html
- https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html
- https://docs.tavily.com/documentation/api-reference/introduction
- https://docs.tavily.com/documentation/api-reference/endpoint/search
- https://brave.com/search/api/
- https://api-dashboard.search.brave.com/api-reference/web/search/get
- https://serper.dev/
- https://www.postgresql.org/docs/current/sql-createtable.html

## Options Considered

### Option A: Keep Tavily UI and add Brave/Serper later

Pros:

- Lowest immediate code change.
- No routing or tab compatibility work.

Cons:

- Keeps Tavily as the user-facing product concept.
- Forces each future provider to repeat the same settings UI work.
- Does not validate the provider-neutral config storage from the UI.

### Option B: Provider-neutral UI backed by provider-neutral storage

Pros:

- One settings surface for all web-search providers.
- Preserves Tavily behavior while staging Brave/Serper safely.
- Keeps provider adapters as the activation boundary, so unsupported providers cannot be tested or routed accidentally.
- Removes the duplicate long-term Tavily-only screen.

Cons:

- Requires route dependency wiring and compatibility handling now.
- Some labels still mention Tavily where settings are provider-specific.
- Brave/Serper configuration is visible before execution adapters exist.

### Option C: Raw JSON provider config editor

Pros:

- Fast to add for advanced users.
- Flexible for unknown future provider options.

Cons:

- Easy to misconfigure.
- Poor fit for accessibility and validation.
- Exposes implementation details instead of intent.
- Increases risk of unsupported provider fields being assumed operational.

## Final Recommendation Stack

Use Option B:

```text
Provider-neutral settings UI
  -> provider-neutral settings API
  -> provider-neutral config storage
  -> Tavily legacy mirror for current runtime compatibility
  -> adapter availability gates for test/use actions
```

Security and compatibility rules:

- Read APIs return masked keys only.
- Blank API-key input means "keep existing key".
- A separate clear-key checkbox is required to remove a stored key.
- Provider test actions are enabled only when an adapter exists and a submitted or stored key is available.
- Tavily writes mirror back to `tavily_config` until all runtime consumers move to provider-neutral storage.
- `/settings?tab=tavily` remains a deep-link alias to the new `web-search` tab.

## Implemented Outcome

Server:

- Added a provider metadata/adapter registry in `webSearchProviderRegistry.mjs`.
- Added provider settings support and handlers for:
  - `GET /settings/web-search/providers`
  - `PUT /settings/web-search/providers/:providerKey`
  - `POST /settings/web-search/providers/:providerKey/test`
- Added explicit API-key clearing to `webSearchProviderStorage.mjs`.
- Mirrored Tavily provider saves back to `tavily_config` in the same transaction.
- Activated Brave Search and Serper.dev adapters so both providers can be
  tested and selected by the quota-aware provider router when configured.
- Added bounded, intent-level provider options: Brave country and strict Safe
  Search, plus Serper country (`gl`) and language (`hl`).
- Kept legacy Tavily enrichment and retry runtime behavior unchanged pending a
  dedicated provider-router compatibility migration.

Client:

- Replaced the Tavily-only settings screen with `WebSearchProviders.vue`.
- Added provider cards for Tavily, Brave Search, and Serper.dev.
- Added provider status badges for enabled/disabled, key stored/missing, and adapter ready/pending.
- Added priority and soft daily/monthly limit fields.
- Kept Tavily-specific search-depth, max-result, include-domain, and exclude-domain controls.
- Updated service links from the old Tavily tab to the Web Search tab.
- Preserved the old `tab=tavily` deep link as an alias.

## Validation

Targeted validation:

```text
server: 8 suites, 59 tests passed
client: 4 files, 82 tests passed
```

Coverage includes:

- Provider storage key clearing.
- Provider registry metadata and adapter availability.
- Provider settings handler list/update/test behavior.
- Settings route dependency wiring.
- Settings route registration.
- Client API functions and default API exports.
- Provider UI rendering and masked-key save behavior.

## Follow-Up Targets

1. **Legacy Runtime Migration to Provider Routing** - move Tavily-specific
   enrichment and retry execution to the provider router without breaking
   existing Tavily configurations or historical rows.
2. **Provider Usage Retention** - define bounded retention and cleanup for
   usage and cache tables while preserving quota calculations.
3. **Route Decision History** - retain bounded, sanitized route outcomes to
   distinguish configuration changes from provider failures and quota events.

## Route Diagnostics Outcome

The settings view now includes a read-only Route Diagnostics card. It displays the
next eligible provider, deterministic priority order, skip reasons, quota counters,
request/cache-hit counts, and cooldown state. The browser response is an
allow-listed projection and excludes credentials, provider configuration, search
queries, cached content, trace IDs, and error payloads. See
[`web-search-provider-route-diagnostics.md`](web-search-provider-route-diagnostics.md).
