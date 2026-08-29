# Ollama verification runtime mismatch operational panel design

## Decision

Add an administrator-authorized, read-only panel to **Settings → AI** that
reports only the aggregate count of strict-Ollama model-digest mismatches and
the most recent observation time. It must not return model names, model
digests, endpoint details, exception text, prompts, media data, or an event
history.

The panel is a separate stats resource rather than an addition to the editable
AI-settings response. This keeps the read model narrow, allows a short
server-side cache, and makes authorization and the response contract explicit.

## Research and principles

Reviewed on 2026-08-29:

- [OpenTelemetry Metrics Data Model](https://opentelemetry.io/docs/specs/otel/metrics/data-model/)
  describes pre-aggregated metric streams and spatial/temporal reaggregation
  for cost control. The panel therefore projects a count and a maximum
  timestamp, not a list of observations or high-cardinality dimensions.
- [OpenTelemetry Metrics SDK](https://opentelemetry.io/docs/specs/otel/metrics/sdk/)
  defines aggregation cardinality limits. The API has no client-selectable
  model, date, or dimension parameter.
- [OWASP API3:2023](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/)
  recommends returning the minimum explicitly selected properties. The
  response is built from an allow-list rather than forwarding a database row.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  identifies internal network data and sensitive information as data to avoid
  recording directly. The panel repeats the existing telemetry boundary by
  excluding endpoint and exception fields.
- [OWASP API4:2023](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/)
  motivates a bounded, parameter-free query and a short server-side cache.

## Options

| Option | Pros | Cons |
| --- | --- | --- |
| Add the aggregate to the editable AI settings response | Fewer HTTP requests | Couples observability to configuration reads and broadens a sensitive response contract. |
| New admin-only stats resource without a cache | Clear contract and fresh data | Repeated UI refreshes can repeatedly query the metrics table. |
| **New admin-only stats resource with a short in-memory cache** | Narrow API, protected route, bounded query volume, no new stored state | Data can be up to one cache interval old. |
| Persist one mismatch event per occurrence | Detailed investigations | Creates an unnecessary identity/history data set and increases privacy and retention risk. |

## Recommended stack

1. A parameterized repository query aggregates only `SUM(model_digest_mismatch_count)` and `MAX(last_model_digest_mismatch_at)` for fixed `ollama` and `verification` dimensions.
2. A dedicated service normalizes the database row into an immutable,
   allow-listed response and coalesces concurrent reads behind a 30-second
   in-memory TTL cache.
3. An `/api/stats/ollama-verification-runtime-mismatch-summary` route requires
   existing administrator authorization, applies a dedicated 30-request-per-15
   minute limiter after authorization, and has no request parameters or
   provider side effects.
4. A small Vue settings component renders the two safe fields, a manual refresh
   action, an explicit no-observations state, and an explanation that re-testing
   the saved configuration restores verification after a model update.
5. Tests cover authorization, query parameterization, response normalization,
   cache behavior, API wiring, and UI non-disclosure assertions.

## Security and privacy properties

- Authorization is enforced by the server, not inferred from the settings UI.
- The query filters fixed provider and authority values; callers cannot select a
  model, date range, or database field.
- The public response preserves exact non-negative count text rather than
  converting a PostgreSQL `BIGINT` through an unsafe JavaScript number.
- The service never forwards raw rows and does not retain error text or model
  identity in its cache.
- This panel is diagnostic only: it cannot invoke a provider, alter settings,
  retry classification, or change routing/policy state.

## Non-goals

- It is not an event log, audit trail, or model inventory.
- It does not expose model names, digests, hostnames, ports, or raw errors.
- It does not automatically re-test or re-enable verification.
- It does not create a release.
