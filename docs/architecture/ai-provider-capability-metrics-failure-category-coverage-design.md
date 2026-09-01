# AI Provider Capability Metrics Failure Category Coverage Design

## Decision

Add a separate administrator-only report that measures adoption of the existing
safe telemetry category contract over three adjacent, completed UTC days. For
each fixed day, the report returns only:

- total capability-metric persistence warnings;
- warnings carrying both the fixed metric-write stage and one allow-listed
  database-condition category; and
- a count-derived, nearest-whole safe-category coverage percentage.

The report is automatically requested only while the existing rolling health
aggregate already reports an active persistence warning. It is read-only and
cannot invoke AI, retry telemetry, modify settings, select a policy, influence
RAG, classify media, or route media.

## Problem

The rolling 24-hour breakdown explains whether the present warning set has safe
categories. It does not distinguish a newly deployed metadata contract from
historic records that predate it. An administrator needs to know whether a
partial category result reflects historical retention or a continuing failure
to attach the safe fields, without opening broad Error Logs or exposing raw
diagnostics in the AI Settings screen.

## Research Basis

- [OpenTelemetry Metrics Data Model](https://opentelemetry.io/docs/specs/otel/metrics/data-model/)
  supports temporal and spatial reaggregation. Three server-defined periods and
  a fixed category count are a bounded aggregate, rather than high-cardinality
  log dimensions.
- [OpenTelemetry Metrics SDK](https://opentelemetry.io/docs/specs/otel/metrics/sdk/)
  supports meter configuration and filtering. The system retains only a fixed
  metadata vocabulary before the aggregate query, never caller-selected values.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends collecting proportionate data and restricting database-log access.
  The endpoint is administrator-only and reports no error text, stack, provider,
  model, media, endpoint, raw SQLSTATE, or record identifier.
- [W3C WCAG 2.2 status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  treats a result or waiting indication as a status message while cautioning
  against disorienting context changes. The existing parent health state remains
  the sole live announcement; this automatically refreshed support panel has a
  labelled heading and does not move focus or duplicate announcements.

## Data Contract

| Field | Server-defined values | Excluded data |
| --- | --- | --- |
| Period | `baseline`, `previous`, `current`; adjacent completed UTC days | Caller range, timezone, or interval |
| Warning total | Non-negative decimal count | Log record identity |
| Safe total | Warning count with one fixed stage and allow-listed SQLSTATE category | Raw SQLSTATE, error text, or stack |
| Coverage | Nearest whole percentage derived from safe / total | Provider, model, media, policy, RAG data |

A period with zero warnings has no percentage rather than a manufactured
`100%`. The client recomputes every percentage from counts, derives all text
locally, requires exactly the three fixed period IDs, and fails closed if a
count, percentage, or status is incoherent.

## Architecture

```text
fixed telemetry warning metadata
  -> protected Error Log records
  -> server-owned completed UTC-day window builder
  -> parameterized aggregate: total vs allow-listed safe categories
  -> administrator-only, rate-limited, no-store endpoint
  -> AI Settings only after an active rolling warning
  -> compact automatic coverage context; no new action or authority
```

The coverage service reuses the same completed-window builder as the existing
health trend, avoiding overlapping or in-progress periods. The repository binds
the fixed reason code, stage, and category identifiers as SQL parameters. It
never selects a metadata document or raw log field.

## Alternatives

| Option | Pros | Cons |
| --- | --- | --- |
| Treat all legacy warnings as `100%` | Minimal UI | Misrepresents untagged records and defeats the adoption signal |
| Parse historic error text | May categorize older data | Unsafe, locale-dependent, and can expose diagnostics |
| Use a caller-selected report range | Flexible incident inspection | Expands data-query surface and makes comparisons unstable |
| Fixed completed-day coverage | Honest, stable, privacy-bounded, and auto-refreshable | Does not diagnose the underlying database incident |

## Final Recommendation Stack

1. Keep the rolling health summary as the current operational trigger.
2. Keep the 24-hour safe breakdown for current bounded category counts.
3. Add this completed-window coverage report to reveal safe metadata adoption
   without guessing about historic records.
4. Preserve protected Error Logs for administrator-led root-cause work.
5. Do not tie coverage to AI admission, policy scoring, RAG, classification,
   retries, or routing; it describes telemetry quality only.

## Security Boundaries

- Administrator authorization runs before the service and database aggregate.
- The endpoint is parameter-free, rate-limited, and `Cache-Control: no-store`.
- All SQL values are fixed server-owned parameters; no metadata, error text,
  provider, model, stack, raw SQLSTATE, or row identifier is selected.
- The client accepts only the versioned count-only contract and fixed periods.
- The report is observational only and exposes no mutating operation.
