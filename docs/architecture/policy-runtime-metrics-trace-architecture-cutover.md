# Policy Runtime Metrics And Decision Trace Architecture Cutover

## Status

Implemented on July 4, 2026 as the durable architecture-name cutover for the
runtime metrics and decision trace contract.

This cutover does not change runtime behavior. It renames the active
architecture record, updates roadmap references, and preserves the existing
side-effect-free metrics/trace projection implemented by
`policyRuntimeMetricsTrace.mjs`.

## Goal

Remove temporary roadmap naming from the active runtime metrics design record
while keeping the contract focused on bounded observability:

```text
policy runtime contract outputs
  -> bounded counters
  -> sanitized trace records
  -> supported source-fingerprint correlation
  -> action-oriented operator summaries
```

## Official Guidance Reviewed

- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)
  recommend common telemetry structures and stable conventions. Classifarr keeps
  the local metrics/trace projection aligned with a stable product namespace
  before any future telemetry export.
- [OpenTelemetry Naming](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  recommends lowercase, precise, unambiguous names and namespace separation.
  The durable trace attributes remain under
  `classifarr.policy.runtime_metrics_trace.*`.
- [OpenTelemetry Traces](https://opentelemetry.io/docs/concepts/signals/traces/)
  frames traces as the path a request takes through an application. Classifarr
  keeps only bounded local trace records and source fingerprints until a full
  telemetry backend is intentionally adopted.
- [W3C Trace Context](https://www.w3.org/TR/trace-context/)
  defines portable trace correlation behavior. Classifarr mirrors the
  correlation principle with validated SHA-256 source fingerprints rather than
  raw payloads or prompts.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends event usefulness, validation, sanitization, and excluding sensitive
  data from logs. The runtime trace rejects raw provider payloads, replay
  payloads, prompts, embeddings, and diagnostic internals.
- [NIST Privacy Framework](https://www.nist.gov/privacy-framework)
  treats privacy risk management as an enterprise practice. The projection
  minimizes retained data by recording counts, reason codes, and safe
  fingerprints instead of user prompts or provider bodies.

## Recommendations

1. Keep the active architecture document named by the product contract:
   `policy-runtime-metrics-trace.md`.
2. Keep metrics and trace records side-effect-free until storage, retention, or
   OpenTelemetry export is explicitly designed.
3. Keep trace names stable and bounded under
   `classifarr.policy.runtime_metrics_trace.*`.
4. Carry only validated source fingerprints for correlation.
5. Reject raw payloads, prompts, embeddings, provider bodies, replay bodies,
   impact-preview bodies, and diagnostic internals.
6. Surface summaries only when they tell an operator what to do next.

## Pros And Cons

Pros:

- Removes temporary phase-coded naming from the active architecture record.
- Keeps the durable `policy.runtime_metrics_trace.v1` payload version visible.
- Preserves bounded counters, supported source fingerprints, and sensitive-data
  suppression.
- Gives future telemetry work a clean handoff without prematurely exporting
  spans or metrics.

Cons:

- Does not add persistence, retention, dashboards, or OpenTelemetry transport.
- Leaves runtime completion audit as a later active architecture cutover.
- Requires roadmap and module-cutover references to be kept in sync with the
  renamed active document.

## Final Recommendation Stack

- Active architecture:
  `docs/architecture/policy-runtime-metrics-trace.md`
- Architecture cutover record:
  `docs/architecture/policy-runtime-metrics-trace-architecture-cutover.md`
- Module cutover record:
  `docs/architecture/policy-runtime-metrics-trace-module-cutover.md`
- Runtime contract:
  `server/src/services/policyRuntimeMetricsTrace.mjs`
- Focused validation:
  `server/src/__tests__/services/policyRuntimeMetricsTrace.test.mjs`
- Production naming guard:
  `scripts/generate-policy-builder-production-name-inventory.mjs`

## Implementation Outcome

- Renamed the active design record from
  `policy-builder-phase-7r-runtime-metrics-trace.md` to
  `policy-runtime-metrics-trace.md`.
- Updated the roadmap implementation status to point at the durable active
  architecture document.
- Updated the module-cutover note to point at this architecture cutover record.
- Preserved the existing runtime metrics/trace service, tests, payload version,
  trace attributes, and validation behavior.

## Security Outcome

- No provider calls were added.
- No telemetry persistence or export was added.
- No routing, learning, rebuild, rollback, or policy writes were added.
- Raw payloads, prompts, embeddings, provider payloads, replay payloads, impact
  preview payloads, and diagnostic internals remain validation failures.
- Source correlation remains limited to supported SHA-256 fingerprints and
  derived fingerprint-set digests.

## Next Step

Runtime And Rebuild Test Reset now has a durable active architecture record.
Runtime Completion Audit should receive the next architecture cutover so its
active design record uses the durable completion-audit contract name.
