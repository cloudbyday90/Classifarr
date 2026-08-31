# Classification Routing Metadata Preservation Design

Status: Implemented (unreleased)

Date: 2026-08-31

## Problem

The classification record is first persisted with bounded policy, RAG,
candidate-evidence, and AI-advisory projections. The later routing phase used
the pre-persistence in-memory metadata object to write its routing result.
That full replacement removed the freshly persisted `classification_details`
object and left only `routing` behind.

This makes a current retry appear less informative than the decision that
produced it: the review UI can still derive a policy score from retained policy
data, but cannot display the record's candidate-bound retrieval, cross-library
identity, RAG, or advisory outcomes.

## Decision

Replace full metadata writes from the routing phase with a dedicated ESM
`classificationRoutingMetadataPersistence` service. It performs one
parameterized PostgreSQL JSONB patch that owns only these fields:

- `classification_details.routing`
- `classification_details.routing_error`
- the terminal `routed` status when a route completes

All other existing `classification_details` keys are preserved. The service
normalizes the positive classification ID, bounds the routing state and error,
and rejects invalid input before it can reach the database.

```text
classification result
  -> initial persistence (policy/RAG/evidence/AI projections)
  -> route attempt
  -> routing metadata persistence service
  -> JSONB patch of routing fields only
  -> preserved evidence visible to pending-review presentation
```

## Security and Authority Boundaries

- The update is parameterized and addresses one positive server-owned history
  ID; it accepts no browser-supplied metadata object.
- Only the fixed terminal status `routed` is accepted. Other status changes
  remain outside this service.
- The service preserves existing bounded projections rather than reconstructing
  or exposing them, and does not add an endpoint, response shape, query
  parameter, provider call, AI action, RAG action, policy change, learning
  action, retry, or route authority.
- Missing or non-object historical `classification_details` is replaced by an
  empty object before the two routing fields are written. A stale
  `routing_error` is removed when the current result has no error.

The object-level update follows OWASP's guidance to authorize and constrain
each object operation rather than accepting an arbitrary client object, while
the partial JSONB update also avoids accidental property exposure from stale
callers. [OWASP API1:2023](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/)
[OWASP API3:2023](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/)

## Accessibility and AI Considerations

This change deliberately does not add a new live region, prompt, or model
decision. It restores the already-designed, fixed-copy pending-review evidence
to its normal document position. That keeps non-urgent status communication
from unexpectedly moving focus, consistent with W3C's status-message guidance.
[W3C WCAG 2.2 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)

The restored evidence remains advisory. NIST's AI RMF calls for documented,
measurable, human-governed AI risk management; preserving the deterministic
record makes model use and non-use reviewable without granting it routing
authority. [NIST AI RMF FAQ](https://www.nist.gov/itl/ai-risk-management-framework/ai-risk-management-framework-faqs)

## Options Considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep writing the caller's full metadata object | Small existing code path | Erases data persisted earlier in the same workflow | Reject |
| Re-read the row, merge in JavaScript, then replace it | Preserves data in uncomplicated cases | Adds a read, races concurrent writers, and still risks unrelated overwrite | Reject |
| Parameterized JSONB patch in a focused service | Preserves unrelated data atomically, has a narrow authority boundary, and is testable | PostgreSQL-specific SQL needs focused regression coverage | Adopt |
| Recompute all evidence after routing | Could restore missing fields | Performs redundant work and may call retrieval/AI differently from the original decision | Reject |

## Validation Plan

1. Unit-test input validation and the static parameterized patch contract.
2. Regression-test routed, skipped, and failed-routing writes from the
   classification service.
3. Execute the JSONB expression against the local Compose PostgreSQL using a
   synthetic value containing RAG and contrastive evidence, verifying that only
   routing fields change.
4. Run the full test and quality gates, security diff review, and a no-cache
   local Compose rebuild.

## Recommendation Stack

1. Ship the narrow routing JSONB patch before extending semantic retrieval or
   AI behavior; it fixes the evidence-loss defect blocking evaluation today.
2. Retry a representative pending item after deployment and verify that its
   retained evidence card and cross-library state now come from the current
   run, not a historic reconstruction.
3. Collect aggregate candidate-retrieval outcomes after retention is verified.
   Improve declared policy scope first when the data identifies a repeatable
   gap; only then consider a bounded semantic-retrieval experiment.
