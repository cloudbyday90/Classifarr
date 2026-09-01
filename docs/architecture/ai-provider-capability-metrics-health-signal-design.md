# AI Provider Capability Metrics Health Signal Design

## Status

Implemented and locally verified on 2026-08-31. This design adds one compact,
administrator-only health projection for capability-metric persistence. It
does not change AI provider admission, strict-verification eligibility, policy
evaluation, RAG, classification, or routing.

## Problem

Capability metrics are intentionally fail-open: an aggregate-write problem
must not turn a successful AI response into a failed classification. That
keeps media work safe, but previously left an operator to infer persistence
health from individual warnings in Error Logs. The recent PostgreSQL type
inference failure demonstrated that a telemetry warning can look like an AI
failure despite successful underlying work.

The signal answers only this bounded operational question:

> Did aggregate capability telemetry persist recently, and were capability
> telemetry write failures recorded in the same fixed period?

It does not answer whether a provider is reachable, whether a model is
admitted for strict verification, or whether a media item should route.

## Design

```text
ai_provider_capability_metrics ─┐
                                 ├─ fixed aggregate repository
error_log (stable reason code) ──┘           │
                                             ▼
                         admin-only, rate-limited, no-store endpoint
                                             │
                                             ▼
                 existing visible-page AI Readiness auto-refresh lifecycle
                                             │
                                             ▼
                compact status panel + polite transition-only announcement
```

The server owns a rolling 24-hour window because persistence health needs to
be timely. It returns only:

| Field | Meaning | Excluded data |
| --- | --- | --- |
| Active metric streams | Number of provider/model/mode metric rows updated in the window | Provider, model, endpoint, media, prompts, responses |
| Persistence warnings | Number of allow-listed write-failure events in the window | Error text, stack, request/system context, credentials |
| Latest timestamps | Recency of the two aggregate facts | Event identity and raw diagnostic detail |
| Fixed status ID | `operational`, `persistence_failures_detected`, or `no_recent_activity` | Database-supplied prose or action controls |

The query matches a new stable reason code
`ai_provider_capability_metrics_persistence_failed`, while preserving the
existing fixed warning message as a backward-compatible fallback for earlier
rows. The browser reconstructs all user-facing labels and guidance from its
fixed vocabulary rather than rendering database-provided text.

## Security And Authority Boundaries

- The endpoint requires administrator authorization, has no request
  parameters, is rate-limited, and sends `Cache-Control: no-store`.
- Both SQL filters use parameters. The aggregate selects no provider/model
  dimension, media, policy, prompt, model output, endpoint, credential, actor,
  raw error, stack trace, or log metadata.
- The read-only service does not import provider clients or routing/policy
  services; it cannot call AI, write telemetry, mutate configuration, retry a
  task, or route media.
- The metric-write warning remains fail-open. The new reason code improves
  aggregation without making logging availability part of classification
  success.
- The UI has one `role="status" aria-atomic="true"` region that announces a
  meaningful status transition only; timestamps and routine automatic refresh
  activity are not announced.

## Research Basis — August 2026

- [OpenTelemetry Metrics Data Model](https://opentelemetry.io/docs/specs/otel/metrics/data-model/)
  defines metrics as pre-aggregated time series and supports temporal/spatial
  reaggregation to control reliability and cost. The design therefore uses
  bounded aggregate counts instead of raw event history.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  says logging failure must not stop the application and recommends testing
  log failure behavior, protecting access, and minimizing/sanitizing event
  data. The signal observes those failures without changing the fail-open
  classification boundary.
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
  requires access control at each non-public REST endpoint. The aggregate is
  guarded at its own endpoint rather than relying on the settings page.
- [W3C ARIA22](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22)
  describes `role="status"` as a polite live region and recommends explicit
  `aria-atomic="true"` for reliable whole-message announcements. The panel
  follows that pattern only for material status transitions.
- [W3C Understanding WCAG 2.2 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  emphasizes communicating important changes without unnecessarily
  interrupting work. Routine polling timestamps are therefore visual only.

## Alternatives

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Aggregate admin health signal | Timely, low-noise, privacy-bounded, actionable | Does not expose per-event diagnostics | Selected |
| Display raw Error Log rows in AI Settings | Detailed debugging | Leaks raw errors/context, creates a busy primary screen | Rejected |
| Treat metric write failure as an AI failure | Very visible | Violates fail-open telemetry and can block valid media work | Rejected |
| Depend on the warning message alone | No writer change | Brittle if wording changes | Rejected; stable reason code plus legacy fallback |
| Per-refresh `alert` announcement | Hard to miss | Repeatedly interrupts assistive technology users | Rejected |

## Validation Plan

1. Unit-test the versioned status contract and ensure untrusted source strings
   cannot reach the presentation.
2. Unit-test the repository's parameterized, dimension-free query and its
   rejection of malformed ranges.
3. Integration-test the real PostgreSQL aggregate against both a synthetic
   metrics row and a reason-coded warning.
4. Test the administrator guard, rate-limit wiring, no-store response, API
   helper, client presentation, and transition-only announcement.
5. Rebuild local Compose without cache and verify the running container's
   protected endpoint and UI behavior.

## Final Recommendation Stack

1. Keep capability telemetry fail-open and record a stable reason code for a
   failed write.
2. Surface only a server-owned 24-hour aggregate to administrators, with no
   caller-selected filter or dimension.
3. Refresh through the existing visible-page AI Readiness lifecycle; do not
   introduce a second poller or manual-refresh burden.
4. Preserve status-only, transition-only accessibility announcements and direct
   detailed investigation to the existing protected Error Logs view.

## Open Pull-Request Check

The public GitHub pull-request listing reported **0 open pull requests** on
2026-08-31. No unrelated or closed pull request was substituted for the
requested local implementation.
