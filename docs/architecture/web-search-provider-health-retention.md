# Web Search Provider Health Retention

## Status

Implemented for sanitized provider health/cooldown events.

## Problem

`web_search_provider_health_events` records provider success, error, and
cooldown transitions for Route Diagnostics. The table is intentionally
append-only at write time so provider health behavior is auditable, but without
retention it can grow indefinitely on installs with active enrichment traffic.

The retention policy must keep recent troubleshooting value while limiting
long-lived diagnostic metadata.

## Current Best-Practice Inputs

- OWASP Logging Cheat Sheet recommends retaining log and event data only for
  the required retention period and protecting event data from unauthorized
  access, modification, or deletion.
- OWASP Logging Cheat Sheet also warns that logs can contain sensitive
  information, so Classifarr's health events keep the existing sanitized shape:
  no queries, API keys, provider configs, cache keys, request fingerprints, raw
  responses, stack traces, or full error messages.
- NIST Privacy Framework frames retention and deletion as privacy risk
  management activities. Health diagnostics are operational data, but the same
  data-minimization principle applies: retain recent data with a clear default,
  then remove older rows automatically.
- PostgreSQL documentation states regular vacuuming reclaims reusable space from
  dead rows and keeps indexes/table statistics healthy. Retention deletes should
  be indexed and batched so autovacuum can keep up without long blocking
  maintenance work.

Sources:

- <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>
- <https://www.nist.gov/privacy-framework>
- <https://www.postgresql.org/docs/current/routine-vacuuming.html>
- <https://www.postgresql.org/docs/current/sql-vacuum.html>

## Options Considered

### Option A: Keep health events indefinitely

Pros:

- Maximum historical detail.
- No cleanup code.

Cons:

- Unbounded append-only growth.
- Retains diagnostic metadata beyond likely operator usefulness.
- Makes settings diagnostics depend on a table that can grow forever.

### Option B: Reuse route-decision retention setting

Pros:

- Fewer settings.
- Simple scheduler wiring.

Cons:

- Couples two different diagnostic surfaces.
- Prevents future tuning where route decisions need longer history than health
  transitions, or vice versa.
- Makes operator intent less clear.

### Option C: Dedicated 30-day health-event retention

Pros:

- Keeps recent provider-health behavior available for troubleshooting.
- Uses a dedicated setting that can evolve independently.
- Deletes through bounded indexed batches using the existing daily web-search
  retention scheduler.
- Matches the existing route-decision retention pattern.

Cons:

- Adds one setting and one cleanup service.
- Future high-volume installs may still need aggregate rollups.

## Final Recommendation Stack

Use Option C:

- Seed `web_search_provider_health_event_retention_days` with default `30`.
- Run cleanup from the existing daily web-search provider retention task.
- Delete old health events in batches ordered by `created_at ASC, id ASC`.
- Keep cleanup non-fatal and return bounded summaries.
- Keep health-event retention independent from usage/cache and route-decision
  retention.

## Security Model

Retention cleanup only evaluates health-event timestamps and IDs. It does not
read or expose provider queries, API keys, provider configs, cache keys, request
fingerprints, raw responses, stack traces, or raw error messages.

The retention setting is an integer day count. Invalid values fall back to the
default and unusually high values are capped.

## Outcome

Provider health events now have explicit retention:

- Recent success/error/cooldown transitions remain visible in Route Diagnostics.
- Older diagnostic rows are deleted automatically.
- Fresh installs receive the default setting through the schema snapshot seed
  path.
- Cleanup shares the existing daily web-search retention schedule.

## Follow-Up Items

1. Add health aggregates for "cooldowns/errors per provider over 24h/7d" so
   operators can spot unstable providers without reading individual events.
2. Add operator-visible retention controls in Web Search Providers settings.
3. Add provider outcome feedback that links provider choice to downstream
   classification quality.
