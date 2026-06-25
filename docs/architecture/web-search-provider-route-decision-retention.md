# Web Search Provider Route Decision Retention

## Status

Implemented for provider-route decision history.

## Problem

`web_search_provider_route_decisions` records sanitized provider-router
decisions so operators can diagnose why Tavily, Brave, or Serper was selected,
skipped, retried, or exhausted. The table is intentionally append-only at write
time, but without retention it can grow without bound on active installs.

The retention policy needs to preserve recent diagnostic value while limiting
long-lived operational metadata.

## Current Best-Practice Inputs

- OWASP Logging Cheat Sheet says log data should be kept for the required
  retention period and not kept beyond that period; legal or contractual
  obligations may affect the exact window.
- OWASP Logging Cheat Sheet also calls out confidentiality risks when logs hold
  sensitive data, reinforcing the current route-history design that excludes
  queries, API keys, provider configs, cache keys, request fingerprints, and raw
  provider responses.
- NIST Privacy Framework treats retention, logging, storage, destruction, and
  deletion as data life-cycle actions, so retention should be explicit and
  periodically reassessed.
- PostgreSQL documentation recommends regular vacuuming/autovacuum to remove
  dead rows. Retention deletes should therefore be batched and indexed so normal
  autovacuum can keep up without long maintenance locks.

Sources:

- <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>
- <https://www.nist.gov/privacy-framework>
- <https://nvlpubs.nist.gov/nistpubs/CSWP/NIST.CSWP.01162020.pdf>
- <https://www.postgresql.org/docs/current/routine-vacuuming.html>
- <https://www.postgresql.org/docs/current/sql-vacuum.html>

## Options Considered

### Option A: Keep route decisions indefinitely

Pros:

- Maximum historical detail.
- No cleanup code.

Cons:

- Unbounded append-only growth.
- Retains diagnostic metadata beyond normal operator usefulness.
- Makes settings diagnostics depend on a table that can grow forever.

### Option B: Delete route decisions aggressively after a few days

Pros:

- Minimal storage.
- Smaller diagnostics table.

Cons:

- Reduces incident investigation value.
- Makes recurring provider-routing behavior harder to understand.

### Option C: Configurable 30-day TTL with bounded deletes

Pros:

- Keeps recent routing evidence for operator diagnosis.
- Bounded by default and adjustable through settings storage.
- Uses the existing indexed `(created_at DESC, id DESC)` route-history path.
- Deletes in small batches so cleanup does not hold large locks.

Cons:

- Adds one setting and one scheduled cleanup path.
- Very high-volume installs may still need future row-count caps.

## Final Recommendation Stack

Use Option C:

- Seed `web_search_provider_route_decision_retention_days` with default `30`.
- Run cleanup through the existing daily web-search provider retention task.
- Delete old route decisions in bounded batches ordered by `created_at ASC, id
  ASC`.
- Keep route-decision cleanup separate from usage/cache cleanup so each policy
  can evolve independently.
- Treat cleanup failure as non-fatal and return a bounded summary.

## Security Model

Retention cleanup only evaluates route-decision timestamps and IDs. It does not
read or expose provider queries, API keys, provider configs, cache keys, request
fingerprints, or response bodies.

The setting is an integer day count. Invalid values fall back to the default,
and unusually high values are capped to keep retention bounded.

## Outcome

Route decisions now have explicit retention:

- Recent routing diagnostics remain available in settings.
- Old diagnostic rows are removed automatically.
- Cleanup shares the existing daily web-search retention schedule.
- The cleanup service is independently testable and safe to run repeatedly.

## Follow-Up Items

1. Add row-count cap protection if route decisions grow faster than expected.
2. Add provider health and cooldown history so repeated failures are visible
   without inspecting each route decision.
3. Add operator-visible retention controls in the Web Search Providers settings
   page.
