# Web Search Provider Route Decision History

## Status

Implemented for the provider-router modernization track.

## Problem

The provider router could explain a decision only while the search request was
still in memory. Once the request completed, operators could see aggregate usage
and the next candidate order, but not why a specific Tavily, Brave, or Serper
request selected a provider, skipped another provider, or fell through to a
fallback. That made post-incident diagnosis depend on transient logs.

## Current Best-Practice Inputs

- OWASP Logging Cheat Sheet: logs should capture enough event attributes for
  later monitoring and analysis, especially when, where, who, and what, while
  avoiding unnecessary sensitive data.
- OWASP Top 10 A09: unclear or missing logging for warnings/errors is a
  monitoring failure because operators cannot reconstruct important events.
- OpenTelemetry trace concepts: model an operation as a span-like record with
  attributes and event details instead of flattening every low-level detail into
  a single message.
- PostgreSQL JSONB documentation: JSONB is appropriate for semi-structured
  details, but frequently queried dimensions should remain typed columns and
  indexed directly.

Sources:

- <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>
- <https://owasp.org/Top10/2021/A09_2021-Security_Logging_and_Monitoring_Failures/>
- <https://opentelemetry.io/docs/concepts/signals/traces/>
- <https://www.postgresql.org/docs/current/datatype-json.html>
- <https://www.postgresql.org/docs/current/gin.html>

## Options Considered

### Option A: Console/log-only route decisions

Pros:

- Very small implementation.
- No schema change.

Cons:

- Not queryable from the settings UI.
- Lost when logs are rotated or cleared.
- Easy to accidentally log query text or provider response fragments.

### Option B: Store route details only inside usage metadata

Pros:

- Reuses the existing `web_search_provider_usage` table.
- Links to provider quota accounting naturally.

Cons:

- A single route can contain multiple provider attempts, but usage rows are
  provider-specific.
- No clean way to represent skipped candidates that never consumed quota.
- Harder to query by final provider, outcome, or classification.

### Option C: Dedicated route-decision table

Pros:

- Represents one router decision as one auditable event.
- Keeps queryable fields typed and indexed.
- Stores sanitized candidates and attempts as bounded JSONB arrays.
- Can be surfaced in settings diagnostics without exposing provider secrets,
  request content, cache keys, or raw responses.

Cons:

- Adds one migration and one append-only table.
- Needs a retention policy to keep diagnostic growth bounded.

## Final Recommendation Stack

Use Option C:

- `web_search_provider_route_decisions` stores one sanitized route decision per
  provider-router search call.
- Typed columns hold `purpose`, `operation`, `outcome`, selected/final provider,
  trace IDs, classification ID, duration, and safe error taxonomy fields.
- Bounded JSONB arrays hold candidate order and provider attempts.
- The router records decisions through a fault-tolerant service so diagnostics
  failure cannot break search execution.
- Settings Route Diagnostics includes the ten most recent decisions.
- Route decisions are cleaned by the daily web-search provider retention task
  using the `web_search_provider_route_decision_retention_days` setting.

## Security Model

Route history intentionally excludes:

- Search query text.
- API keys and provider config payloads.
- Raw provider responses.
- Cache keys and request fingerprints.
- Provider request bodies or result snippets.

The browser-facing projection remains behind the existing authenticated admin
settings route and contains only provider keys, outcome codes, candidate order,
quota counters, attempt count, timestamps, and taxonomy error fields.

## Outcome

The platform now records provider route decisions durably enough for operator
diagnostics while preserving the existing provider-neutral router contract.
This gives us an audit path for questions such as:

- Why did Brave skip and Tavily run?
- Was the result a cache hit or live search?
- Did all eligible providers fail, or was no provider eligible?
- Which classification or correlation ID produced the route decision?

## Follow-Up Items

1. Add row-count cap protection if route decisions grow faster than the
   time-based retention policy.
2. Add provider health and cooldown history to make recurring outage patterns
   visible outside individual decisions.
3. Add operator-visible retention controls in the Web Search Providers settings
   page.
