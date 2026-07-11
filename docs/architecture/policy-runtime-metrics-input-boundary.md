# Policy Runtime Metrics Input Boundary

## Status

Implemented for runtime metrics and decision traces.

## Problem

The metrics service previously accepted runtime decision objects directly,
mixing raw input inspection, sensitive-data suppression, and counter/trace
aggregation. Arbitrary nested payload fields could reach the aggregation path,
which made the telemetry trust boundary unclear even though output suppression
existed.

## Official Guidance Reviewed

- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends validating event data from other trust zones and sanitizing event
  data before logging.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-side derivation of security-relevant state and consistent
  workflow enforcement.
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)
  supports common, stable names for telemetry data across a codebase.
- [NIST SP 800-218 Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports repeatable verification and secure development practices.

## Recommendation

Use two focused contracts:

1. `buildPolicyRuntimeMetricsInputFromRuntimeInput` reduces runtime source
   objects to `policy.runtime_metrics_input.v1` allowlisted records. Sensitive
   input is represented by a boolean suppression marker, never retained.
2. `buildPolicyRuntimeMetricsTraceFromMetricsInput` requires a valid normalized
   input contract. `buildPolicyRuntimeMetricsTraceFromRuntimeInput` is the
   explicit raw adapter.

The normalized contract keeps only outcome state, bounded reason identifiers,
supported fingerprint attributes, acceptance state, and guarded-outcome summary
counts. It rejects unexpected fields before counter aggregation or trace
creation.

## Pros And Cons

Pros:

- Prevents raw provider, prompt, embedding, replay, and diagnostic payloads
  from reaching the metrics reducer.
- Preserves bounded suppression telemetry without exposing sensitive content.
- Makes trace and counter calculations deterministic over a stable schema.
- Keeps source fingerprint handling explicit and allowlisted.

Cons:

- New source types require an intentional normalized-record extension.
- The adapter reports sensitive input as suppression metadata rather than
  retaining details for diagnostics.

## Final Recommendation Stack

- Metrics input normalizer:
  `server/src/services/policyRuntimeMetricsInput.mjs`
- Metrics and trace reducer:
  `server/src/services/policyRuntimeMetricsTrace.mjs`
- Focused tests:
  `server/src/__tests__/services/policyRuntimeMetricsInput.test.mjs` and
  `server/src/__tests__/services/policyRuntimeMetricsTrace.test.mjs`

## Outcome

```text
raw runtime source records
  -> normalized metrics input
  -> counters, bounded traces, operator actions

existing valid normalized metrics input
  -> counters, bounded traces, operator actions
```

Metrics aggregation cannot inspect or retain arbitrary raw source payloads.
