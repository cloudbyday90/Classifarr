# Web Search Provider Route Diagnostics

Status: implemented slice.

## Goal

Make quota-aware provider routing understandable from Settings without requiring
container logs or database access. The diagnostics answer one bounded operational
question: which provider would receive the next provider-backed cache miss, and
why are all other providers eligible or skipped?

## Research Notes: June 2026

Official guidance supports a narrow, authorization-protected diagnostic read model:

- OWASP Secrets Management guidance treats API keys as secrets and requires them
  to remain unavailable to ordinary display and diagnostic paths. The route
  projection therefore excludes API keys and all provider configuration values.
- OWASP API3:2023 highlights object-property authorization risks. Settings
  diagnostics remain within the existing authenticated settings boundary and
  expose only a deliberately allow-listed response model.
- OpenTelemetry's data-protection guidance recommends controlling telemetry data
  and avoiding sensitive or high-cardinality values. This design excludes search
  queries, cache keys, correlation IDs, raw provider payloads, and error bodies.
- W3C WCAG status-message guidance supports announcing asynchronous status
  changes without a focus shift. The selected-route summary uses a polite live
  status region; failure to load diagnostics is an alert.
- Tavily's rate-limit documentation and RFC 6585 reinforce showing a cooldown
  and aggregate usage state rather than retrying an unavailable provider.

Source URLs:

- <https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html>
- <https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/>
- <https://opentelemetry.io/docs/specs/otel/logs/data-model/#data-protection>
- <https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html>
- <https://docs.tavily.com/documentation/rate-limits>
- <https://datatracker.ietf.org/doc/html/rfc6585>

The June 19, 2026 MCP retrieval attempt was blocked by an upstream `403` in the
research service. The cited URLs are official sources already recorded in the
provider architecture documents; implementation does not depend on an
unverified provider behavior change.

## Options Considered

### Option A: Log-only diagnostics

Pros:

- No new settings API or UI code.
- Keeps operational data off the browser.

Cons:

- Requires container access and log correlation for routine configuration work.
- Does not explain why priority changes or quota limits affect routing.

### Option B: Return the internal router candidate object

Pros:

- Minimal server code.
- Exact internal state is visible.

Cons:

- Risks exposing API keys and provider configuration.
- Couples the settings API to the internal router representation.
- Makes later router refactors a breaking UI API change.

### Option C: Dedicated allow-listed route diagnostic projection

Pros:

- Exposes only operator-relevant state: selected provider, priority, eligibility,
  skip reason, quota counters, request/cache-hit counters, and cooldown time.
- Preserves a strict browser-facing boundary around credentials, queries,
  cache identities, trace IDs, and provider error content.
- Reuses the deterministic route evaluation already used by the router.
- Supports future adapters without adding provider-specific UI branches.

Cons:

- Adds a small API contract and projection service to maintain.
- Shows current aggregate state, not historical per-request routing timelines.

## Final Recommendation Stack

Use Option C:

```text
WebSearchProviders settings view
  -> authenticated GET /settings/web-search/providers/route-diagnostics
  -> route diagnostics projection
  -> WebSearchProviderRouter.getRouteCandidates()
  -> quota policy + usage summaries + registry + storage
```

The endpoint is read-only. It evaluates the existing candidates in priority order
and does not issue provider network calls.

## Security Boundary

The browser-facing candidate shape is allow-listed to:

- provider key and display name
- priority and availability/skipped state
- skip reason
- enabled/configured/adapter-available booleans
- cooldown timestamp
- daily/monthly quota totals, limits, and remaining capacity
- daily/monthly request and cache-hit counts

It intentionally does **not** include:

- API keys, raw provider configuration, or project IDs
- search queries, query previews, result content, cache keys, or cache metadata
- correlation IDs or classification IDs
- raw errors, HTTP response bodies, or stack traces

The endpoint uses the existing settings authentication and authorization path; it
does not add a public diagnostics surface.

## Implementation Outcome

Added:

- `webSearchProviderRouteDiagnostics.mjs`, a pure allow-listed projection from
  internal router candidates to the settings response.
- `GET /settings/web-search/providers/route-diagnostics`.
- Dependency injection that binds the diagnostics router to the same provider
  storage and registry used by settings, including overridden/test dependencies.
- A Route Diagnostics card in Web Search Providers settings with refresh,
  selected-route, skipped-reason, quota, cooldown, request, and cache-hit state.
- Polite status announcement and alert semantics for asynchronous UI feedback.

## Validation

```text
server: route diagnostic projection, handler, route dependency, and route tests
client: provider settings view and API tests
```

The test suite asserts that sensitive API-key/config values cannot appear in the
diagnostic response.

## Next High-Value Items

1. **Brave and Serper adapter activation**: add real adapters under the existing
   contract, normalization, cache, error taxonomy, and routing layers.
2. **Provider usage retention and cleanup**: bound usage/cache table growth while
   retaining enough aggregate data for soft-limit routing and diagnostics.
3. **Route decision history**: retain a bounded, sanitized per-request route
   outcome record so operators can distinguish configuration changes from provider
   outages and quota events over time.
