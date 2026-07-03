# Policy Builder Phase 7R Request-Time Learning And Destination Selection

## Status

Implemented as the fifth Phase 7R runtime contract.

This slice normalizes request-time destination choices, operator manual
destination changes, successful routing outcomes, and routing failures into a
side-effect-free server decision. It records the event shape, final outcome, and
learning-guard result without directly mutating policy, profile evidence, or
routing state.

## Problem

Request-time behavior can easily blur four different facts:

```text
the requester wanted this destination
the operator changed the destination
the item successfully routed there
the item failed to route because configuration was missing
```

Those are all useful signals, but they are not equivalent. A request preference
is not a final outcome. A routed item is not a policy-learning event by itself.
A missing Arr mapping is operational configuration debt, not positive evidence
that the destination was wrong or right.

Phase 7R.5 makes those distinctions explicit before request/manual outcomes are
allowed to influence future automation.

## Official Guidance Reviewed

- [NIST AI Risk Management Framework 1.0](https://www.nist.gov/itl/ai-risk-management-framework)
  emphasizes governed, measured, and managed AI system behavior. This contract
  separates event recording, final outcome, learning, and side effects so each
  can be governed independently.
- [NIST Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
  emphasizes risk controls, measurement, and provenance for generative AI
  systems. Phase 7R.5 keeps request/manual decisions traceable and prevents raw
  runtime events from directly becoming durable learning.
- [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
  calls out excessive agency, insecure output handling, and overreliance risks.
  This slice does not let request-time or AI-adjacent runtime outputs perform
  profile or policy writes directly.
- [Microsoft Human-AI Experience Guidelines](https://www.microsoft.com/en-us/haxtoolkit/ai-guidelines/)
  emphasize clear user control and graceful recovery. Manual destination
  changes are explicitly auditable and reversible, and failed routing becomes a
  configuration outcome instead of hidden learning.

## Recommendation

Use a deterministic request-time learning contract between runtime events and
durable learning.

The contract should answer:

```text
Which event happened?
Which destination was selected?
What final outcome was recorded?
Can this event become guarded learning?
Should profile evidence be refreshed?
Were any side effects performed?
Can the operator audit or reverse the change?
```

The contract must also preserve the upstream sanitized evidence fingerprint
from the automation decision or question-reduction plan. Request-time learning
is only useful when it can prove which evidence-bound decision caused the
request/manual/routing event, without carrying raw labels, provider payloads, or
question text into durable learning.

## Pros And Cons

Pros:

- Keeps request destination choice separate from final outcome.
- Prevents failed routes from becoming positive destination evidence.
- Routes all durable learning through the Phase 6R learning guard.
- Allows operator manual changes to improve future decisions only when the
  learning guard approves the evidence.
- Keeps the slice side-effect-free until runtime persistence is intentionally
  wired.
- Carries upstream evidence fingerprints into the request decision, bounded
  learning-guard context, and trace so learning candidates remain auditable.

Cons:

- Adds one more contract before live request/import flows can write learning.
- Existing request/manual resolution code still needs a later integration slice
  to call this service.
- Conservative handling means successful routing is recorded as outcome only;
  a separate learning signal is required before it can mutate policy evidence.
- Runtime integration must supply the upstream fingerprint from the automation
  decision or question-reduction plan before this contract can validate.

## Final Recommendation Stack

1. Normalize request/import/manual/routing events into bounded event ids:
   - `user_requested_destination`,
   - `operator_manual_destination_change`,
   - `route_succeeded`,
   - `route_failed_missing_mapping`.
2. Map each event to a Phase 6R learning source.
3. Record destination selection separately from final outcome.
4. Run every request-time learning candidate through the Phase 6R learning
   guard.
5. Treat successful Arr routing as final outcome only, not direct durable
   learning.
6. Treat missing route mapping as route failure only, not positive destination
   evidence.
7. Queue profile refresh only when the learning guard says guarded evidence can
   change destination profile state.
8. Keep all writes disabled in this contract. Persistence belongs to later
   integration slices.
9. Carry the upstream evidence fingerprint into the request-time decision,
   learning-guard context, and bounded trace attributes.
10. Reject missing or mismatched fingerprint handoffs before request-time
    learning can pass validation.

## Implemented Files

- Request-time learning contract:
  `server/src/services/policyBuilderPhase7RequestTimeLearning.mjs`
- Focused tests:
  `server/src/__tests__/services/policyBuilderPhase7RequestTimeLearning.test.mjs`
- Learning guard dependency:
  `server/src/services/policyBuilderPhase6LearningGuard.mjs`
- Question vocabulary dependency:
  `server/src/services/policyQuestionLearningVocabulary.mjs`
- Roadmap owner:
  Phase 7R.5 Request-Time Learning And Destination Selection in
  `docs/architecture/policy-builder-intent-model-roadmap.md`

## Implemented Contract

The service exports:

- `PHASE7R_REQUEST_EVENT_TYPE_IDS`
- `PHASE7R_REQUEST_LEARNING_AUDIT_RISK_IDS`
- `PHASE7R_REQUEST_LEARNING_DISPOSITION_IDS`
- `PHASE7R_REQUEST_LEARNING_REASON_IDS`
- `buildPolicyBuilderPhase7RequestTimeLearningDecision`
- `buildPolicyBuilderPhase7RequestTimeLearningAudit`
- `validatePolicyBuilderPhase7RequestTimeLearningDecision`

## Event Semantics

`user_requested_destination`
: A requester or import flow selected a destination. The choice is recorded as
  a request-time signal and final outcome, but it is outcome-only unless the
  learning guard later approves a durable candidate.

`operator_manual_destination_change`
: An operator changed the destination. The change is auditable, reversible, and
  may become a learning candidate only through the Phase 6R learning guard.

`route_succeeded`
: Arr routing succeeded. This records a routed final outcome, but it cannot
  write durable learning directly.

`route_failed_missing_mapping`
: Arr routing could not proceed because mapping/configuration was missing. This
  records an operational route failure and explicitly cannot become positive
  destination evidence.

## Security And Data Handling

- The contract does not call providers.
- The contract does not persist outcomes.
- The contract does not write policy or profile learning.
- The contract does not queue profile refresh directly.
- Trace output uses bounded reason codes and stable attributes.
- Manual destination changes require reversibility metadata.
- Route failures are blocked from writing durable learning or profile refresh
  requests.
- The contract carries only sanitized upstream evidence fingerprint provenance
  and rejects missing or mismatched fingerprint handoffs.

## Test Coverage

The focused test suite verifies:

- user-requested destinations remain separate from final outcomes,
- operator manual changes pass through the learning guard and are reversible,
- approved manual learning can request profile refresh through the guard,
- successful Arr routing records outcome only,
- missing route mapping is route failure only,
- stale or rejected upstream questions block learning,
- route outcomes and route failures cannot claim direct learning writes,
- direct side effects and non-reversible manual changes fail validation,
- request-time decisions carry upstream evidence fingerprints into the
  learning-guard context and trace,
- missing or mismatched fingerprint handoffs fail validation,
- the component audit points to Phase 7R.6.

## Outcome

Phase 7R.5 gives request/import/manual/routing events this runtime shape:

```text
request or routing event
  -> normalized destination selection
  -> final outcome record
  -> Phase 6R learning guard
  -> optional guarded profile-refresh recommendation
  -> no direct side effects
```

This lets later runtime integration learn from meaningful operator decisions
without treating every request, route, or failure as policy evidence.

## Next Step

Phase 7R.6 Library-Derived Policy Rebuild should consume guarded outcomes,
library profile evidence, routing configuration, and explicit constraints to
produce reviewable policy rebuild proposals without destructive replacement.
