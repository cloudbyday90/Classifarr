# AI Provider Capability Metrics Failure Recency Design

## Decision

Add a separate administrator-only report that classifies retained
capability-metric persistence warnings across three adjacent, completed UTC
days. The report returns only one fixed count per day and a derived age band:

- `warning_in_latest_completed_day` — a warning exists in the latest completed
  UTC day;
- `cleared_for_one_completed_day` — the latest completed UTC day is clear and
  the preceding completed day had a warning; or
- `older_completed_warning_only` — both latest completed days are clear and
  only the oldest fixed aggregate had a warning.

No exact event timestamp, raw log, database detail, provider, model, media,
policy, RAG context, or routing detail is returned or shown. The report is
requested automatically only after the existing rolling health aggregate has
already detected an active persistence warning. It is observational and cannot
invoke AI, alter telemetry, modify settings, retry, select a policy, influence
RAG, classify media, or route media.

## Problem

A rolling 24-hour warning count explains that telemetry persistence currently
needs attention. The fixed completed-window coverage report explains whether
retained warnings use the safe category contract. Neither clearly answers
whether the completed-day evidence is current, newly clear, or retained only as
older context.

Without that distinction, an administrator can mistake a historical aggregate
for a current problem or repeatedly open Error Logs merely to establish the
age of retained evidence.

## Research Basis

- [OpenTelemetry Metrics Data Model](https://opentelemetry.io/docs/specs/otel/metrics/data-model/)
  describes pre-aggregated time series and temporal reaggregation. Three
  server-defined adjacent windows and a count-derived band preserve bounded
  temporal context without adding high-cardinality dimensions.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends purpose-appropriate logging and restrictive database-log access.
  This endpoint exposes only proportionate aggregate counts after
  administrator authorization; it never serves raw diagnostics.
- [W3C WCAG 2.2 status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  defines non-disruptive result/status updates. The existing parent health
  summary remains the sole live region, while this labelled support panel
  refreshes without moving focus or duplicating announcements.

## Data Contract

| Field | Server-defined values | Excluded data |
| --- | --- | --- |
| Period | `baseline`, `previous`, `current`; adjacent completed UTC days | Caller range, timezone, interval |
| Warning total | Non-negative decimal count per period | Log record identity or timestamp |
| Age band | One of the three fixed bands, derived from the latest warning-bearing period | Incident severity, diagnosis, SLA age |
| Status | A duplicate fixed ID for client contract validation | Server-provided display text |

The client accepts only the versioned three-period contract, validates decimal
counts, derives the expected age band locally, and requires the server
`recency` and `status` IDs to agree. A malformed report produces a small
unavailable state rather than being silently treated as no warning. A valid
three-day aggregate with no warning produces no panel because there is no
retained evidence to contextualize.

## Architecture

```text
fixed telemetry warning records
  -> protected Error Log table
  -> server-owned completed UTC-day window builder
  -> parameterized count-only aggregate
  -> locally derived fixed recency band
  -> administrator-only, rate-limited, no-store endpoint
  -> AI Settings only after active rolling health warning
  -> compact contextual status; no new action or authority
```

The ESM repository validates exactly three adjacent UTC-midnight windows before
querying and binds only the existing fixed warning module, message, and reason
code as SQL parameters. The service owns the window and report construction;
the route owns authorization, rate limiting, and no-store delivery. The client
presentation owns all operator prose and ignores server text.

## Alternatives

| Option | Pros | Cons |
| --- | --- | --- |
| Return the latest raw timestamp | Precise chronology | Broadens telemetry disclosure and falsely implies incident duration |
| Query a caller-selected date range | Flexible inspection | Unbounded query shape, unstable comparisons, and more confusing UI |
| Infer recovery from a current rolling count | Fast | In-progress time makes a true completed-day comparison impossible |
| Fixed completed-day age bands | Stable, privacy-bounded, auto-refreshable, clear scope | Deliberately coarse and not a root-cause diagnosis |

## Final Recommendation Stack

1. Keep the rolling health summary as the operational source of truth.
2. Keep the 24-hour safe breakdown for current bounded category counts.
3. Keep category coverage for safe-metadata adoption context.
4. Add this completed-window recency band so retained context is clearly
   current, newly cleared, or older-only.
5. Keep protected Error Logs as the intentional administrator path for
   root-cause investigation; do not let age-band telemetry influence AI,
   policies, RAG, classification, retries, or routing.

## Security Boundaries

- Administrator authorization executes before the service and aggregate query.
- The parameter-free endpoint is rate-limited and `Cache-Control: no-store`.
- The repository permits only exactly three server-owned adjacent UTC-day
  periods and uses fixed SQL parameters.
- The query selects no metadata document, timestamp, error text, stack,
  provider, model, media, policy, raw SQLSTATE, or record identifier.
- The client recomputes the band locally and fails closed on an incoherent
  response.
- No mutation, AI call, policy or RAG update, classification, retry, or route
  action exists in this feature.
