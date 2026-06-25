# Web Search Provider Health and Cooldown History

## Status

Implemented for provider-neutral web-search routing.

## Problem

The provider router already tracks current provider state on
`web_search_provider_config` and records individual route decisions, but current
state only answers "what is true now." It does not show the recent pattern of
provider successes, errors, and cooldown transitions that explains why routing
behavior changed over time.

Operators need enough history to distinguish a transient provider failure from a
recurring cooldown loop without exposing search queries, API keys, provider
configuration, cache identities, request fingerprints, raw responses, or full
error messages.

## Current Best-Practice Inputs

- OpenTelemetry semantic conventions model errors, operations, and correlation
  fields as structured telemetry attributes. Classifarr is not adopting a full
  telemetry stack here, but the same principle applies: store bounded,
  typed diagnostic fields instead of parsing unstructured logs.
- Google SRE guidance treats monitoring as a way to answer system health
  questions quickly. Provider health history should make "is this provider
  repeatedly cooling down?" answerable from the app without requiring container
  log inspection.
- OWASP Logging Cheat Sheet recommends excluding sensitive data from logs and
  using consistent event attributes. Provider history must therefore avoid
  credentials, raw requests, search strings, raw provider responses, and
  unbounded error bodies.
- PostgreSQL documentation recommends routine vacuuming and index-aware cleanup
  for tables with row churn. Health events should be append-only at write time,
  indexed by recent lookup paths, and eligible for future retention cleanup.

Sources:

- <https://opentelemetry.io/docs/specs/semconv/general/trace/>
- <https://sre.google/workbook/monitoring/>
- <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>
- <https://www.postgresql.org/docs/current/routine-vacuuming.html>

## Options Considered

### Option A: Keep only current provider state

Pros:

- No extra table.
- Existing settings read model remains simple.

Cons:

- Loses the sequence of failures and cooldowns.
- Requires log inspection to understand repeated routing skips.
- Cannot distinguish "provider recovered" from "provider never failed."

### Option B: Use application logs as health history

Pros:

- No schema change.
- Captures broad runtime context.

Cons:

- Logs are not a stable app data contract.
- Higher risk of accidental sensitive data exposure.
- Harder to query safely in the settings UI.
- Log retention and operator diagnostics become coupled.

### Option C: Store sanitized structured health events

Pros:

- Gives operators a durable recent timeline of success, error, and cooldown
  transitions.
- Uses typed fields that are safe to project into the settings UI.
- Keeps provider-health diagnostics separate from raw logs and route-decision
  attempts.
- Can be retained or aggregated later without changing the routing contract.

Cons:

- Adds one table and one write path.
- Requires careful field allow-listing to avoid storing sensitive provider
  request context.

## Final Recommendation Stack

Use Option C:

- Add `web_search_provider_health_events` for sanitized health transitions.
- Record events from provider usage state updates, so live provider successes,
  taxonomy errors, and cooldown starts are captured at the same point current
  provider state changes.
- Keep health-history writes best-effort and non-fatal; provider routing must
  not fail because diagnostics could not be persisted.
- Store only bounded diagnostic fields: provider key, event type, health status,
  purpose, operation, error code, HTTP status, retry-after seconds, cooldown
  expiry, optional correlation/classification IDs, and allow-listed metadata.
- Surface the latest health events in the Web Search Providers Route
  Diagnostics panel alongside recent route decisions.

## Security Model

Health events deliberately do not store:

- Search query text.
- API keys or masked-key placeholders.
- Provider-specific configuration.
- Cache keys or request fingerprints.
- Raw provider responses.
- Raw exception messages or stack traces.

Metadata is allow-listed to `cacheHit` and `routedProvider`. Future metadata
fields must be explicitly reviewed before being exposed.

## Outcome

Provider health and cooldown behavior is now visible from the settings UI:

- Successful live provider calls record `success` / `available`.
- Taxonomy errors record `error` / `degraded`.
- Rate-limit or quota failures that enter cooldown record
  `cooldown_started` / `cooldown`.
- Recent health events appear in Route Diagnostics without exposing sensitive
  request or provider details.
- Fresh installs receive the new table through the schema snapshot path.

## Follow-Up Items

1. Add health aggregates for "cooldowns/errors per provider over 24h/7d" so
   operators can spot repeat failures without reading event rows.
2. Add operator-visible retention controls in Web Search Providers settings.
3. Add route-result quality feedback that connects provider choice, result
   usefulness, and downstream classification outcome.
