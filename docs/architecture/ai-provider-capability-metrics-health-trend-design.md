# AI Provider Capability Metrics Health Trend Design

## Status

Implemented and locally verified on 2026-09-01. This is a descriptive
follow-on to the rolling capability-telemetry health signal. It does not alter
AI-provider admission, strict verification, policy evaluation, RAG,
classification, or routing.

## Problem

The existing 24-hour health signal is deliberately timely: it describes
current telemetry persistence and recent write warnings. It cannot establish
whether a warning was newly observed, persisted across independent periods, or
cleared. Comparing moving 24-hour windows would make a count shift on every
refresh, including when no new event occurred.

The trend answers one bounded operator question:

> Across three adjacent completed UTC days, did aggregate capability-metric
> persistence warnings persist, newly appear, clear, recur, or have no
> telemetry data?

It does not establish provider health, model correctness, strict-verification
admission, or the destination for an item.

## Design

```text
ai_provider_capability_metrics ─┐
                                 ├─ fixed three-window aggregate repository
error_log (stable reason code) ──┘                │
                                                  ▼
                         admin-only, rate-limited, no-store endpoint
                                                  │
                                                  ▼
                      existing visible-page AI Readiness refresh lifecycle
                                                  │
                                                  ▼
                   compact nested trend + polite transition-only announcement
```

The server creates exactly three non-overlapping, one-day periods ending at
the start of the current UTC day:

| Period | Interval | Purpose |
| --- | --- | --- |
| `baseline` | Older completed UTC day | Distinguishes new signals from a recurrence |
| `previous` | Immediately preceding UTC day | Establishes persistence or clearing |
| `current` | Latest completed UTC day | Keeps the comparison stable during refreshes |

The endpoint accepts no period, date, provider, model, policy, media, or log
selector. It returns only the fixed window metadata, the three allow-listed
period IDs, two count fields per period, and a server-owned status ID.

### Status Vocabulary

| Status | Rule | Meaning |
| --- | --- | --- |
| `persistent_persistence_failures` | Warnings in `previous` and `current` | Pattern requires operational follow-up if it continues |
| `newly_observed_persistence_failures` | Warning only in `current` | Observe one more completed window before calling it persistent |
| `persistence_failures_cleared` | Warning in `previous`, none in `current` | Improvement, not proof that recurrence is impossible |
| `no_data` | No stream or warning in all three periods | Telemetry observation gap, distinct from successful persistence |
| `recurring_persistence_failures` | Warning in `baseline` and `current`, none in `previous` | Intermittent condition; never mislabeled as newly observed |
| `no_active_persistence_failure_trend` | All other coherent combinations | No current warning pattern |

The final two states close the factual gaps between the four primary operator
states. They avoid calling an old, returning failure “new” or treating the
absence of current telemetry as a success.

## Security And Authority Boundaries

- The route requires administrator authorization, is rate-limited,
  parameter-free, read-only, and returns `Cache-Control: no-store`.
- SQL receives only server-created timestamps and parameterized stable logging
  identifiers. It returns no provider/model dimension, media, policy, prompt,
  response, endpoint, credential, error text, stack, or metadata.
- The trend repository and service do not import provider, policy, RAG,
  classification, queue, or routing services. They cannot call AI, write a
  metric, retry work, change settings, or route media.
- The client reconstructs all labels and guidance from a versioned local
  vocabulary. It fails closed to “unavailable” when the response version,
  periods, counts, or status relationship is incoherent.
- The existing fail-open telemetry boundary remains intact: a metrics write
  warning can be monitored but cannot turn valid AI work into failed routing.

## Accessibility And Hands-Off Operation

The trend is nested in the existing compact capability-telemetry panel rather
than creating a second settings workflow. It uses the AI Readiness
visible-page auto-refresh lifecycle and respects its pause control.

The UI renders the three exact count pairs visibly, but uses one polite,
atomic `role="status"` region only when the trend status changes. Initial
rendering and routine timestamps do not create announcements, avoiding a
chatty background poller.

## Research Basis — Current Through August 2026

- [OpenTelemetry Metrics Data Model](https://opentelemetry.io/docs/specs/otel/metrics/data-model/)
  defines metrics as pre-aggregated time series, supports temporal
  reaggregation, and treats gaps/absence as meaningful. The trend therefore
  uses equal, non-overlapping completed periods and keeps no-data separate
  from a clean warning count.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends proportionate logging, restricted access, and exclusion or
  sanitization of secrets and sensitive data. The endpoint is aggregate-only
  and administrator-protected rather than rendering Error Log details.
- [W3C Understanding WCAG 2.2 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  calls for important changes to be programmatically determinable without
  interrupting the user, while warning against overly chatty live regions.
  [ARIA22](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22) documents
  `role="status"` as a polite live region. The component announces only a
  material status transition.

## Alternatives

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Three completed UTC days | Stable adjacent comparison; separates new/persistent/cleared/no-data | Delays a same-day trend verdict | Selected; the rolling signal remains timely |
| Three rolling 24-hour windows | Immediate | Overlaps and changes on every refresh | Rejected |
| Show raw Error Log entries in AI Settings | Detailed diagnostics | Exposes sensitive context and makes settings busy | Rejected |
| Treat telemetry warnings as AI failure | Highly visible | Breaks fail-open telemetry and may misrepresent valid AI work | Rejected |
| Four states only | Smaller vocabulary | Mislabels recurrence or stable clean activity | Rejected; two factual completion states added |

## Validation Plan

1. Unit-test exact UTC boundaries, all primary states, recurrence, no-data,
   malformed rows, and non-disclosure of source strings.
2. Unit-test the parameterized, dimension-free SQL contract and reject invalid
   period sets before a query can run.
3. Integration-test the PostgreSQL aggregate across the previous and current
   completed days and clean synthetic records after the test.
4. Test administrator authorization, rate-limit wiring, no-store headers,
   API helper, client fail-closed presentation, and transition-only status
   announcement.
5. Run complete workspace checks and rebuild local Compose without cache.

## Open Pull-Request Check

GitHub reported **0 open Classifarr pull requests** on 2026-09-01. No closed
or unrelated change was substituted for the requested local PR evaluation.

## Final Recommendation Stack

1. Keep the current rolling 24-hour health signal for timely feedback.
2. Add this fixed, completed three-day trend only as an aggregate operational
   context layer.
3. Keep the endpoint admin-only, no-store, rate-limited, parameter-free, and
   unable to influence any AI or routing authority.
4. Use one shared visible-page auto-refresh lifecycle and transition-only
   polite status messages.
5. Send operators to the protected Error Logs view for detailed diagnosis;
   never copy raw diagnostics into AI Settings.
