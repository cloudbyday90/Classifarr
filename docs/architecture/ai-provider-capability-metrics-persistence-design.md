# AI Provider Capability Metrics Persistence Design

## Status

Implemented and locally verified on 2026-08-31. This document addresses a
telemetry-only PostgreSQL type-inference failure that produced misleading
warnings after otherwise successful AI work.

## Problem

`aiProviderCapabilityMetricsRepository.mjs` writes privacy-bounded aggregate
counter deltas with a parameterized upsert. The tenth parameter is the
`model_digest_mismatch_count` `BIGINT` and was reused in a `CASE` expression to
set its timestamp. PostgreSQL inferred that expression's untyped numeric
comparison separately from the target column and rejected the statement with:

```text
inconsistent types deduced for parameter $10
```

Classification deliberately continued because telemetry is fail-open, but the
warning obscured the fact that the AI request had succeeded and prevented the
aggregate counter from being recorded.

## Research Basis — August 2026

- [PostgreSQL PREPARE documentation](https://www.postgresql.org/docs/current/sql-prepare.html)
  explains that an unspecified parameter type is inferred from its usage
  context. A reused placeholder must therefore have compatible contexts or an
  explicit cast.
- [node-postgres parameterized-query guidance](https://node-postgres.com/features/queries)
  requires query text and data values to remain separate, preserving the
  server-side SQL-injection boundary.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends that logging failures not prevent business processing, that event
  fields have documented types, and that logs exclude secrets and unnecessary
  sensitive data.
- [W3C WCAG 2.2 status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  distinguishes polite operational status from interruptive alerts. A hidden
  aggregate write is not a user-facing state change and must not create a noisy
  live announcement. Existing user-visible refresh states already use polite
  status semantics.

## Decision

Keep the one parameterized upsert and make the comparison's type explicit:

```sql
CASE WHEN $10::bigint > 0 THEN NOW() ELSE NULL END
```

The cast expresses the exact type of the `BIGINT` counter, preserves the
timestamp only when an observed mismatch is present, and avoids a second
parameter or an unsafe dynamically constructed query.

## Alternatives

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Explicit `BIGINT` cast | Minimal, typed, parameterized, no data expansion | Requires regression coverage | Selected |
| Add a duplicate parameter solely for the `CASE` | Avoids reused context | Duplicates a value and expands positional-contract drift risk | Rejected |
| Build SQL text with the count | Superficially simple | Violates the parameterization boundary and risks injection mistakes | Rejected |
| Drop the timestamp write | Removes the error | Loses mismatch recency needed for safe strict-verification operations | Rejected |
| Promote telemetry failure to classification failure | Makes errors conspicuous | Lets observability availability block media work | Rejected |

## Security, Privacy, And Accessibility Boundaries

- The query accepts values only through PostgreSQL parameters; it contains no
  dynamic identifier or interpolated model/provider value.
- Only existing aggregate counts and the database-owned current timestamp are
  written. Prompts, model output, media, credentials, endpoint details, and
  raw errors remain outside the metric table.
- The capability-metrics service remains fail-open, so telemetry storage cannot
  route media or turn a valid AI result into a failed classification.
- No UI live region is added for successful background writes. If an
  administrator-visible operational state is later added, it must use one
  stable `role="status" aria-atomic="true"` container rather than repeatedly
  announce individual counter increments.

## Validation Design

1. Unit coverage asserts the explicit `BIGINT` cast remains in the
   parameterized upsert.
2. An integration test runs the actual upsert twice against a fresh PostgreSQL
   schema, verifies `BIGINT` counters accumulate, and proves the first
   mismatch timestamp is retained.
3. Local Compose invokes the repository against the embedded PostgreSQL
   database with a synthetic, immediately removed metric key.

## Final Recommendation Stack

1. Preserve the typed, parameterized single upsert and fail-open telemetry
   boundary.
2. Retain executable integration coverage for PostgreSQL parameter typing;
   mocks alone cannot detect this class of failure.
3. Keep operational UI status aggregate and polite; reserve alerts for an
   actionable, user-visible failure.
4. Continue storing only bounded counters and timestamps, and treat any future
   telemetry fields as a privacy review.

## Open-PR Check

The repository's GitHub pull-request listing reported **0 open pull requests**
on 2026-08-31. No unrelated or closed change was applied locally in place of a
requested open PR.
