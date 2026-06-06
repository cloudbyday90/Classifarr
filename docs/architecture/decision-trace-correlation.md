# Decision Trace Correlation

## Status

Implemented under `Unreleased` for the next release train.

## Problem

Classification debugging had several useful but disconnected observability payloads:

- `classification_details.rag_loop_trace`
- `classification_details.rag_loop_summary`
- policy `candidate_diagnostics`
- RAG stage logs keyed by `correlation_id`

That made incident reconstruction possible, but only after manually stitching together a History row, RAG events, policy diagnostics, and sometimes PostgreSQL logs. The platform needed one durable decision trace identity that can correlate the final classification row with second-pass RAG work and stage-level logs.

## Official Source Research

- W3C Trace Context defines the interoperable `traceparent` format and requires a 16-byte `trace-id`, 8-byte parent/span ID, and trace flags. It also calls out uniqueness, randomness, and security/privacy considerations for trace identifiers: <https://www.w3.org/TR/trace-context/>
- OpenTelemetry Logs describe correlating logs with traces by carrying trace and span identity on log records, making logs useful for investigation without requiring every log backend to be a tracing backend: <https://opentelemetry.io/docs/concepts/signals/logs/>
- OpenTelemetry Logs Data Model standardizes trace correlation fields such as trace ID, span ID, severity, body, and attributes: <https://opentelemetry.io/docs/specs/otel/logs/data-model/>
- OWASP Logging Cheat Sheet recommends recording enough event attributes for accountability and diagnostics while avoiding sensitive data leakage and log injection risks: <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>

## Options Considered

### Full OpenTelemetry SDK

Pros:

- Gives a standard runtime model for spans, context propagation, exporters, and sampling.
- Aligns directly with observability vendors.

Cons:

- Adds runtime configuration, exporter security, sampling, and deployment complexity before Classifarr has an external telemetry backend contract.
- Risks shipping network telemetry behavior before operators explicitly opt into it.

### Metadata-Only W3C Trace Context

Pros:

- Uses standard `traceparent`, `trace_id`, and `span_id` fields without adding an exporter.
- Works inside the current embedded PostgreSQL and History UI model.
- Keeps data local and bounded, which matches Classifarr's current privacy posture.

Cons:

- Does not produce distributed traces in an external backend yet.
- Stage timing remains compact and decision-oriented rather than full span timing.

### UUID-Only Correlation

Pros:

- Matches the existing `error_log.correlation_id UUID` column.
- Minimal change.

Cons:

- Not interoperable with W3C Trace Context or OpenTelemetry naming.
- Does not give operators a `traceparent` they can carry into future API/log tooling.

## Final Recommendation Stack

1. Keep `correlation_id` as a UUID for backward compatibility with existing database columns and log queries.
2. Add W3C-compatible `trace_id`, `root_span_id`, `trace_flags`, and `traceparent` fields to decision metadata.
3. Persist a bounded `classification_details.decision_trace` block on every classification row.
4. Attach the same trace context to `rag_loop_trace.trace_context` when the targeted re-check loop runs.
5. Copy trace fields into RAG stage-log metadata so legacy UUID correlation and W3C trace correlation both work without a schema migration.
6. Surface trace ID, correlation ID, traceparent, and compact decision stages in the History detail modal.

## Security Boundaries

- No prompts, raw AI responses, raw metadata payloads, stack traces, or media paths are copied into `decision_trace`.
- `traceparent` is generated locally and is not accepted from unauthenticated HTTP headers in this implementation.
- Existing UUID `correlation_id` remains the database-facing log key to avoid type errors against the current `error_log.correlation_id UUID` column.
- Trace fields are bounded scalar values and compact stage summaries only.

## Outcome

The classification path now has a stable decision trace shape:

```json
{
  "schema_version": 1,
  "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
  "root_span_id": "00f067aa0ba902b7",
  "trace_flags": "00",
  "traceparent": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00",
  "correlation_id": "95f95cb5-fce5-4d84-9ac4-5f2838f307f4",
  "outcome": {
    "status": "completed",
    "method": "policy_engine",
    "confidence": 92
  },
  "stages": [
    { "name": "classification", "outcome": "completed", "reason_code": "policy_engine" },
    { "name": "policy", "outcome": "evaluated", "reason_code": "multi_source_support" },
    { "name": "rag_loop", "outcome": "pass2", "reason_code": "policy_upgrade" }
  ]
}
```

## Validation

- `npm --prefix server run test:unit -- --testPathPatterns="decisionTraceContext|classificationPersistenceService" --runInBand --no-coverage`
- `npm --prefix server run test:unit -- --testPathPatterns="classification.test.mjs" --runInBand --no-coverage`
- `cd client && node scripts/run-vitest.mjs run src/__tests__/views/HistoryEnhancements.test.js`

The integration RAG flow should also be run in an environment with Docker/Testcontainers access:

- `npm --prefix server run test:integration -- --testPathPatterns="rag-loop-flow" --runInBand --no-coverage`

## Next Design Targets

1. Candidate Explanation Export

   Intent: add an admin/debug endpoint that returns the full bounded evidence package for a classification ID: final row, decision trace, ranked candidates, profile scoring, RAG evidence, and linked outcome. This fits next because trace IDs make it practical to assemble one support bundle without ad hoc SQL.

   Platform improvement: faster incident triage, safer support workflows, and less need for users to paste terminal screenshots.

2. Policy/Profile Replay Harness

   Intent: replay a historical item against current policy/profile logic while preserving the original `decision_trace` as the baseline. This fits next because we can now compare old and new decisions using stable trace metadata.

   Platform improvement: safer scoring changes, better regression detection, and measurable impact before enabling a new policy heuristic.

3. Stage Timing and Span Expansion

   Intent: extend compact decision stages with bounded per-stage duration and child span IDs for policy, profile, RAG retrieval, and AI rerun phases. This fits next because current trace context establishes the root identity without committing to a full tracing backend.

   Platform improvement: identifies slow stages and makes future OpenTelemetry SDK adoption straightforward.
