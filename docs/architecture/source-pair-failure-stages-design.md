# Scheduled source-pair evaluation failure stages

Reviewed November 24, 2026. A retained scheduler error reported
`evaluation_unavailable`, and the next successful evaluation replaced the
failed status. The logging stack and saved reason could identify neither the
operation nor the underlying cause.

## Options and recommendation

| Option | Benefit | Cost |
| --- | --- | --- |
| Log the raw exception | Immediate debug detail | May disclose SQL, provider data or configuration |
| Save the stage in evaluation state | Status readers gain another field | Requires storage and public contract changes |
| Project fixed stages onto the existing scheduler error | Diagnoses the affected operation within the current log boundary | The operator still needs deeper evidence to explain an unexpected failure |

1. Observe lock handling, state reads, admission, initial snapshot reads,
   quality collection, evaluation, snapshot rechecks and publication at their
   owning boundaries. Track the observed rejection within one run. A
   replacement rejection from admission or lock cleanup belongs to that
   wrapper. A rejected failure-recording operation can carry the original stage
   as a second bounded field.
2. Pass the projection privately from the exact failed worker result to the
   existing scheduler error. Keep the error message and saved failure reason.
   The existing error record can show the stage after the evaluation recovers.
3. Verify real scheduler logging and PostgreSQL publication and rollback, plus
   wrapper replacement, failure recording, and opt-out behavior for sibling
   workers.

Use the existing one-active-run admission, advisory locks, deadlines, receipt
outcomes and durable cooldown policy. The current in-process fallback applies
when durable failure bookkeeping is unavailable. Deferred, superseded,
successful and stopped runs continue on their current paths. A later ownership
failure gets its own stage and follows the existing failure-recording rules.
The readiness and adjudication wrappers retain their separate authority.
The projection includes stage labels only, with no raw error, arguments or
SQL. It adds no query, retry, storage field, endpoint or operator action.

OWASP's event guidance supports recording outcome and relevant context with
data minimization. OpenTelemetry favors predictable, low-cardinality error
attributes. W3C's provenance guidance supports identifying where data comes
from. Apply that principle to the worker that observed the failure, while
preserving existing consumers of the saved status. Sources verified using MCP.
[OWASP logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet)
[OpenTelemetry error attributes](https://opentelemetry.io/docs/specs/semconv/registry/attributes/error/)
[W3C Data on the Web Best Practices](https://www.w3.org/TR/2017/REC-dwbp-20170131/)
