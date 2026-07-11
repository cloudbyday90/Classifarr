# Policy Evidence Input Cardinality

## Status

Implemented as the bounded collection guard for policy evidence input.

## Problem

The evidence input gate previously bounded recursive depth and issue count, but
could still iterate every item in an arbitrarily large array before projection.
That risked excess CPU and memory work and encouraged silent truncation as a
workaround. A destination should instead receive a clear blocked result when
its evidence snapshot exceeds the accepted contract size.

## Guidance Reviewed

- [OWASP Denial of Service Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html)
  recommends limiting request size and preventing input-controlled resource
  allocation.
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
  recommends server-side type, range, and length validation and rejecting
  excessive input without returning unnecessary internal detail.
- [OpenTelemetry semantic-convention guidance](https://opentelemetry.io/docs/specs/semconv/how-to-write-conventions/)
  advises against unbounded arrays and values because they increase processing
  and observability cost.

## Recommendation

Use a fixed server-owned maximum of 100 items for every evidence input array.
The gate may scan only the bounded prefix to find independent unsafe markers,
but it rejects the complete envelope when the collection exceeds the limit.
The evidence boundary returns `blocked_by_input_cardinality`, builds no
projection, and exposes only stable section/path/count fields.

## Pros And Cons

Pros:

- Prevents collection size from driving unbounded input-gate work.
- Does not silently discard evidence and claim a safe automation handoff.
- Keeps diagnostics useful without copying evidence values into errors.
- Adds no live lookup, provider quota read, storage write, learning, or route
  attempt.

Cons:

- Large historical evidence sources must aggregate or page upstream before
  entering this contract.
- The maximum is intentionally conservative; changing it requires a tested
  server-side contract change, not a client-provided override.

## Final Recommendation Stack

- Cardinality primitive:
  `server/src/services/policyEvidenceInputCardinality.mjs`
- Input enforcement:
  `server/src/services/policyEvidenceInputGate.mjs`
- Fail-closed handoff status:
  `server/src/services/policyEvidenceBoundary.mjs`
- Focused tests:
  `server/src/__tests__/services/policyEvidenceInputCardinality.test.mjs`,
  `policyEvidenceInputGate.test.mjs`, and `policyEvidenceBoundary.test.mjs`

## Implemented Contract

`buildPolicyEvidenceBoundedCollection` returns at most 100 entries for input
inspection and reports the actual count separately. It never copies excluded
items into diagnostics.

The input gate returns `collection_limit_exceeded` with:

```text
sectionId
path
itemCount
maximumItemCount
```

When this risk is present, `buildBoundedPolicyEvidenceProjection` returns:

```text
ok = false
statusId = blocked_by_input_cardinality
projection = null
nextStep = null
```

This is a truthful review-needed boundary result, not an instruction to retry
providers or to treat a partial collection as complete evidence.
