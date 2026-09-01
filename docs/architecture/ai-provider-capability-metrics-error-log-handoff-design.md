# AI Provider Capability Metrics Error Log Handoff Design

## Decision

When the fixed completed-window capability telemetry trend has an active
persistence-warning state, offer one link to the existing Error Logs view. The
link applies only the stable reason code
`ai_provider_capability_metrics_persistence_failed`; it carries no provider,
model, media, policy, raw error, stack trace, endpoint, timestamp, or
server-provided URL.

The handoff is diagnostic. It cannot test an AI provider, queue a retry, alter
settings, invoke RAG, change policy, or affect classification or routing.

## Problem

The aggregate panel correctly keeps AI Settings hands-off and privacy-bounded,
but an operator who sees an active warning previously had to switch manually to
Logs and recreate the diagnostic filter. That was slow and error-prone. The
existing Error Logs endpoints were authenticated but did not uniformly require
administrator authorization, which is too broad for detailed diagnostics.

## Research Basis

- The [OpenTelemetry metrics data model](https://opentelemetry.io/docs/specs/otel/metrics/data-model/)
  supports temporal and spatial reaggregation, including reducing attributes.
  The AI panel remains aggregate-only; detailed data stays in the dedicated
  diagnostic surface.
- The [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends excluding or masking sensitive data and restricting/reviewing
  privileges to read logs. The link uses a fixed allow-listed reason code and
  the Logs router now requires an administrator.
- [WCAG 2.2 status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  distinguishes an explicit change of context from a status update. This is a
  visible, user-activated link, not a live announcement or a focus-stealing
  redirect. The named sections preserve discoverable structure in line with
  the [WAI-ARIA landmark guidance](https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/).

## Options

| Option | Benefits | Costs and risks |
| --- | --- | --- |
| Put raw errors in AI Settings | Immediate details | Exposes diagnostics in a busy operational panel; expands privacy and access surface. |
| Add a broad Logs link | Very small implementation | Makes the operator manually locate the relevant evidence; no stable evidence boundary. |
| Add a fixed pre-filtered handoff | Preserves the aggregate/detail separation; repeatable; easy to clear | A reason code in a URL is visible and requires the Logs view to preserve access control. |
| Trigger a retry or provider test | Might appear proactive | Conflates observation with remediation and can create unwanted AI work. |

## Recommended Stack

1. Keep the current 24-hour summary for timely aggregate health.
2. Keep the fixed three completed UTC-day trend for stable comparison.
3. Show a single Error Logs handoff only for coherent active warning states:
   newly observed, persistent, or recurring.
4. Apply exactly one stable reason-code filter in the Logs view; reject
   incomplete or altered handoff query state.
5. Require administrator authorization for every Error Logs endpoint.
6. Leave retry, provider testing, routing, policy, and RAG authority outside
   this workflow.

## Architecture

```text
completed UTC aggregates
        |
        v
fail-closed trend presentation
        |
active warning only
        |
        v
fixed Settings query: tab=logs + handoff id + stable reason code
        |
        v
administrator-only Logs router -> existing parameterized reason-code query
```

## Security and Privacy Boundaries

- The browser reconstructs handoff copy and destination locally. It does not
  trust server prose or a server-provided navigation target.
- The query parser accepts only the exact handoff ID plus exact allow-listed
  reason code. Altered values do not pre-filter Logs.
- The handoff filter itself is never sent as a server query parameter; only
  the existing `reasonCode` filter is sent.
- All Logs endpoints now require authentication and administrator
  authorization before they can return a list, detail, report, export, or
  mutation result.
- The aggregate AI panel still does not display raw log contents. Detailed
  diagnostics are available only after explicit navigation to the protected
  Logs surface.

## Non-Goals

- This is not an automatic remediation mechanism.
- This is not a new logging endpoint, telemetry event, or database schema.
- This does not loosen or infer policy eligibility.
- This does not make telemetry persistence a provider capability or routing
  signal.
