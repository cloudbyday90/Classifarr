# Source-pair evidence budget classification

Reviewed November 24, 2026. The real PostgreSQL publication rollback in the
[failure-stage outcome](source-pair-failure-stages-outcome.md) raised a
constraint error on `adjudication_capture_budget`. The source-pair classifier
matched the word `budget` in its message and recorded `evidence_budget`.

| Option | Benefit | Cost |
| --- | --- | --- |
| Match an exact list of messages | Small edit that avoids broad substring matches | Identical text can still come from an unrelated failure |
| Mark errors at verified resource guards | Ties the reason to an observed count or size violation | Each new limit must opt in at its owning guard |
| Add worker failure types to the transport | Could identify limits reached during worker computation | Expands the message contract beyond the observed regression |

## Recommendation

1. Privately mark errors where source-pair snapshot, vector preparation, and
   source-pair or quality worker input checks measure an exceeded limit.
   Keep compatible messages for other callers of shared guards.
2. Use the mark to select the existing `evidence_budget` reason. Missing
   configuration, malformed corpus input, arbitrary message text and
   publication errors use `evaluation_unavailable`. Validate discovery
   deferrals against the three reasons its admission service emits. Keep
   the other documented deferrals and deadline handling.
3. Verify real snapshot and input limits, equal-message and malformed
   controls, and publication rollback through the production worker and
   scheduler on disposable PostgreSQL.

The mark stays within the process and carries no raw data. Keep the
existing worker messages, cancellation checks, stages, stored status shape,
transaction ownership and cooldown behavior. New failures classify according
to the evidence observed on that run. Existing saved reasons retain their
meaning and data. The task adds no query, provider call, or work on fresh
installations. Any later expansion of the worker's failure message needs
separate evidence from a limit reached in the child.

Official sources verified using MCP. Node.js recommends stable identifiers
when callers act on errors. PostgreSQL recommends SQLSTATE for database error
classification. OpenTelemetry favors predictable attributes. Apply W3C's
provenance principle by recording which application boundary measured the
limit, while keeping the existing stage and reason vocabulary.
[Node.js errors](https://nodejs.org/download/release/v24.22.2/docs/api/errors.html)
[PostgreSQL error codes](https://www.postgresql.org/docs/18/errcodes-appendix.html)
[OpenTelemetry error attributes](https://opentelemetry.io/docs/specs/semconv/registry/attributes/error/)
[W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)
