# Decision Trace Stage Timing and Span Expansion

## Status

Implemented under `Unreleased` as the second increment after Decision Trace Correlation.

## Problem

Decision trace correlation created a durable root trace identity, but it did not explain where the time went inside a classification decision. Operators could see that a targeted re-check ran, but not whether the delay came from pass-one gating, metadata enrichment, pass-two retrieval, policy recheck, AI rerun, or candidate assembly.

The platform needs bounded child spans before adopting a full telemetry exporter so we can debug latency and stage execution locally without leaking raw media metadata, prompts, provider responses, or secrets.

## Official Source Research

- OpenTelemetry Tracing API defines spans as operations inside a trace. Spans have start/end timestamps, attributes, events, status, parent span context, and can be nested for sub-operations: <https://opentelemetry.io/docs/specs/otel/trace/api/>
- OpenTelemetry trace semantic conventions recommend low-cardinality span names and common attribute naming so telemetry remains analyzable across systems: <https://opentelemetry.io/docs/specs/semconv/general/trace/>
- OpenTelemetry Semantic Conventions describe using common names for operations and data across traces, metrics, logs, profiles, and resources: <https://opentelemetry.io/docs/concepts/semantic-conventions/>
- W3C Trace Context defines the standard trace identity format and processing model for `traceparent`, including updating the parent/span ID for each operation: <https://www.w3.org/TR/trace-context/>
- OWASP Logging Cheat Sheet recommends collecting enough event information for operational and security analysis while sanitizing log data, excluding sensitive values, and ensuring logging failures do not break the application: <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>

## Options Considered

### Full OpenTelemetry SDK and Exporter

Pros:

- Native span tree, status, attributes, events, sampling, and exporter support.
- Easiest path to vendor observability tools later.

Cons:

- Adds exporter configuration and network egress before Classifarr has an operator opt-in model.
- Requires stronger decisions about sampling, retention, and redaction across AI/provider payloads.
- Larger blast radius than needed for local debugging.

### Local Span Collector in Classification Metadata

Pros:

- Keeps telemetry local in embedded PostgreSQL and existing History UI.
- Records low-cardinality child spans under the W3C-compatible trace context already introduced.
- Bounded span count and scalar-only attributes reduce leakage and storage risk.
- Provides a clean migration path to OpenTelemetry later because the shape already has trace ID, span ID, parent span ID, duration, status, outcome, and attributes.

Cons:

- Not a complete distributed tracing runtime.
- Timing precision is sufficient for diagnostics but not intended as a high-resolution profiler.
- Only classification/RAG phases are instrumented in this increment.

### Event-Only Durations

Pros:

- Minimal implementation.
- Existing RAG events already flow through persistence.

Cons:

- Events are not a span tree and do not carry parent/child relationships.
- Harder to map later to OpenTelemetry.
- Conflates final outcomes with timed operations.

## Final Recommendation Stack

1. Keep the existing root decision trace context and UUID correlation ID.
2. Add a local ES module span collector that creates child span IDs under the root trace.
3. Instrument stable RAG loop stages only: `gate`, `enrichment`, `retrieval_pass2`, `policy_recheck`, `ai_rerun`, and `rag_candidate`.
4. Persist bounded `rag_loop_trace.stage_spans` and `rag_loop_trace.timing_ms.stages`.
5. Copy span IDs and duration into RAG stage-log metadata for joinability.
6. Copy compact child spans into `classification_details.decision_trace.spans`.
7. Render child spans and duration badges in the History detail modal.

## Security Boundaries

- Span names are allow-listed and low-cardinality.
- Span attributes accept only primitive scalar values with bounded key/value length.
- Raw metadata, prompts, AI responses, stack traces, media paths, tokens, and connection strings are not copied into spans.
- Span collection is fail-local; it does not introduce a network exporter.
- Existing `error_log.correlation_id UUID` compatibility is preserved.

## Outcome

RAG loop traces now include bounded child span timing:

```json
{
  "trace_context": {
    "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
    "root_span_id": "00f067aa0ba902b7",
    "traceparent": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00"
  },
  "stage_spans": [
    {
      "name": "retrieval_pass2",
      "span_id": "1111111111111111",
      "parent_span_id": "00f067aa0ba902b7",
      "duration_ms": 405,
      "outcome": "applied",
      "reason_code": "hybrid",
      "status": "ok"
    }
  ],
  "timing_ms": {
    "total": 1626,
    "stages": [
      { "name": "retrieval_pass2", "duration_ms": 405, "outcome": "applied" }
    ]
  }
}
```

## Validation

- `npm --prefix server run test:unit -- --testPathPatterns="decisionTraceContext|decisionTraceSpanCollector|classificationPersistenceService|classification.test.mjs" --runInBand --no-coverage`
- `cd client && node scripts/run-vitest.mjs run src/__tests__/views/HistoryEnhancements.test.js`
- `npm --prefix server run typecheck`
- `npm --prefix server run lint`
- `npm --prefix client run build`
- `npm --prefix client run lint`
- `npm --prefix client run typecheck`

The integration RAG flow should also be run where Docker/Testcontainers is available:

- `npm --prefix server run test:integration -- --testPathPatterns="rag-loop-flow" --runInBand --no-coverage`

## Next Design Targets

1. Candidate Explanation Export

   Intent: provide an admin/debug endpoint that bundles final classification row, decision trace, child spans, candidate diagnostics, RAG evidence, profile scoring, and linked outcome for one classification ID.

   Platform improvement: lowers support friction and replaces terminal screenshots with a bounded, redacted evidence package.

2. Policy/Profile Replay Harness

   Intent: replay a historical item against current policy/profile logic and compare the new decision trace against the original.

   Platform improvement: gives us regression evidence before tuning scoring weights or changing policy anchor rules.

3. Preset Semantics Audit

   Intent: inspect preset labels and signal definitions for broad terms that over-influence specialized libraries, such as generic `Comedy` evidence boosting a stand-up destination too strongly.

   Platform improvement: improves classification quality by separating compatibility evidence from identity evidence at the policy design layer.
