# AI Provider Capability Metrics Failure Breakdown Design

## Decision

Expose a compact, administrator-only, fixed 24-hour aggregate of capability
telemetry persistence failures in AI Settings. Each new warning retains only:

- the fixed `metric_persistence_write` stage; and
- one fixed SQLSTATE-class category, including `not_available` when the
  database driver supplies no valid SQLSTATE.

The aggregate is requested automatically only after the existing health signal
already reports an active persistence warning. It is diagnostic-only and cannot
test a provider, retry a metric write, change settings, influence RAG, select a
policy, classify media, or route media.

## Problem

The prior health signal identified persistence warnings but not their safe
operational category. Reading raw Error Logs is useful for an administrator but
is too broad and too detailed for AI Settings. Existing log events also lacked
the retained category fields needed for a trustworthy aggregate, so inferring a
category from free-form error messages would be unsafe and unstable.

## Research Basis

- [OpenTelemetry Metrics Data Model](https://opentelemetry.io/docs/specs/otel/metrics/data-model/)
  supports spatial reaggregation and removal of unwanted attributes. The
  breakdown therefore uses a fixed low-cardinality vocabulary rather than an
  error string, model, provider, endpoint, or SQLSTATE value as a dimension.
- [OpenTelemetry Metrics SDK](https://opentelemetry.io/docs/specs/otel/metrics/sdk/)
  recommends filtering attributes before enforcing cardinality limits. The
  logger emits only its allow-listed stage/category values before they can be
  persisted or queried.
- [PostgreSQL Error Codes](https://www.postgresql.org/docs/16/errcodes-appendix.html)
  defines a stable five-character SQLSTATE and two-character error class.
  Classifying only the class avoids locale-sensitive error text and avoids
  exposing the raw code.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  advises sanitizing or excluding sensitive log data and restricting log-read
  privileges. This design removes the raw exception, stack, provider, model,
  and authority mode from this particular persistence-warning event and keeps
  the aggregate administrator-only.
- [W3C WCAG 2.2 status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  requires important non-focus status changes to be programmatically available
  without unnecessarily interrupting the user. The existing health summary
  announces a meaningful warning-state change; this subordinate detail uses a
  native user-controlled `<details>` disclosure and does not duplicate a live
  announcement on every automatic refresh.

## Data Contract

The server owns the full vocabulary:

| Field | Allowed values | Excluded data |
| --- | --- | --- |
| Failure stage | `metric_persistence_write` | Provider, model, authority mode, media, policy |
| SQLSTATE category | Connection exception, transaction rollback, insufficient resources, operator intervention, database system error, other database condition, no SQLSTATE available | Raw SQLSTATE and error message |
| Aggregate window | Fixed rolling 24 hours | Caller-selected range or filter |

Unknown, malformed, or legacy records are never parsed from their error text.
They contribute only to an `uncategorizedFailureCount`. This makes the initial
post-deployment state honest: historic warnings can remain aggregate-only while
new warnings populate the bounded vocabulary automatically.

## Architecture

```text
metric persistence write fails
  -> fixed metadata builder (stage + SQLSTATE class only)
  -> protected Error Log record (no raw exception or stack for this event)
  -> admin, rate-limited, no-store aggregate endpoint
  -> AI Settings only after active health warning
  -> optional native disclosure of fixed count labels
```

The API accepts no query parameters. The client derives labels locally from the
versioned count-only contract and rejects incoherent totals, statuses, or
unknown category identifiers.

## Alternatives

| Option | Pros | Cons |
| --- | --- | --- |
| Show raw Error Logs in AI Settings | Fast incident detail | Exposes broad diagnostics and makes a primary settings view busy |
| Parse historic error messages | Can populate old records | Locale- and vendor-dependent, can leak sensitive text, and cannot be trusted |
| Categorize only new warnings, aggregate unknown history | Stable, privacy-bounded, auditable | Historic warnings initially show as uncategorized |
| Fixed stage + SQLSTATE-class aggregate | Low cardinality, actionable, automatic, and least-privilege | Does not replace administrator Error Logs for a complex incident |

## Final Recommendation Stack

1. Keep the 24-hour health summary and three-day trend as the primary signal.
2. Create only fixed, privacy-bounded metadata on new metric-write failures.
3. Automatically retrieve the protected breakdown only while the primary signal
   reports an active warning.
4. Use a compact native disclosure for category counts, with no raw diagnostic
   text or duplicate refresh announcements.
5. Retain the explicit administrator Error Logs handoff for full incident work.

## Security Boundaries

- Administrator authorization is checked before the breakdown service runs.
- Rate limiting and `Cache-Control: no-store` protect the read endpoint.
- No caller-provided range, category, provider, model, or log identifier is
  accepted.
- This telemetry-warning path persists no raw exception text or stack trace.
- The endpoint returns fixed labels and decimal counts only; it cannot mutate
  telemetry, invoke AI, or affect policy, RAG, classification, or routing.
