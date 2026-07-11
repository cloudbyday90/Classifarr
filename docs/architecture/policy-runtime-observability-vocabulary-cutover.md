# Policy Runtime Observability Vocabulary Cutover

## Status

Implemented as a focused runtime observability naming cutover.

## Problem

The runtime metrics trace had durable service, payload, and attribute names,
but its current operator summary and validation diagnostics still described the
delivery phase that introduced them. Those strings can appear in normal
operator-facing output and future logs, making the product vocabulary depend on
an obsolete roadmap.

## Official Guidance Reviewed

- [OpenTelemetry Naming](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  recommends stable, lowercase, namespaced telemetry names and durable system
  identifiers.
- [OpenTelemetry Semantic Conventions for Events](https://opentelemetry.io/docs/specs/semconv/general/events/)
  requires event names to identify a stable structure and prohibits dynamic
  values in the name itself.
- [NIST SP 800-218 Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports integrating verification into the development lifecycle.

## Recommendation

Use `runtime metrics` as the operator and validation domain term. Keep the
existing `policy.runtime_metrics_trace.v1` contract and stable
`classifarr.policy.runtime_metrics_trace.*` attributes unchanged. Do not add a
compatibility alias because these are current diagnostic strings, not persisted
or public compatibility fields.

## Pros And Cons

Pros:

- Removes roadmap terminology from current operator summaries and diagnostics.
- Preserves existing trace schema, bounded payload rules, and reason codes.
- Makes later OpenTelemetry export easier to understand and correlate.

Cons:

- Log consumers that match the old human-readable text must update their own
  display expectations; stable IDs and attributes remain unchanged.
- This is one narrow vocabulary cutover, not a substitute for remaining
  storage and lifecycle naming work.

## Final Recommendation Stack

- Keep stable contract and attribute identifiers.
- Use durable runtime-domain text in operator summaries and validation errors.
- Verify both clean and malformed metrics paths with focused tests.
- Continue other naming cutovers in isolated component batches.

## Outcome

Normal runtime metrics output no longer mentions a roadmap phase. The behavior,
counter set, trace structure, source-fingerprint rules, and sensitive-data
suppression remain unchanged. The verified production naming inventory is
ratcheted to 143 production references and 144 rename candidates.
