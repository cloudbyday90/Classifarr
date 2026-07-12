# Policy Request-Time Learning And Destination Selection

## Status

Implemented as the durable request-time learning runtime contract with
product-domain module, export, and contract names.

This contract normalizes request-time destination choices, operator manual
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

Request-time learning makes those distinctions explicit before request/manual
outcomes are allowed to influence future automation.

This checkpoint tightens that boundary further: request-time learning can no
longer rely on a loose upstream fingerprint alone. It must carry a bounded
runtime question-reduction proof showing that the previous question-reduction
contract validated successfully, and that the same sanitized evidence
fingerprint was preserved into the request-time decision and trace.

Request-time construction now separates raw runtime adaptation from the
validated-plan reducer. The reducer consumes a valid clarification plan and a
normalized request event; it no longer derives provenance from raw questions,
automation decisions, or supplied fingerprint values.

## Official Guidance Reviewed

- [NIST AI Risk Management Framework 1.0](https://www.nist.gov/itl/ai-risk-management-framework)
  emphasizes governed, measured, and managed AI system behavior. This contract
  separates event recording, final outcome, learning, and side effects so each
  can be governed independently.
- [NIST Generative AI Profile](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence)
  emphasizes risk controls, measurement, and provenance for generative AI
  systems. Request-time learning keeps request/manual decisions traceable and
  prevents raw runtime events from directly becoming durable learning.
- [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
  calls out excessive agency, insecure output handling, and overreliance risks.
  This contract does not let request-time or AI-adjacent runtime outputs perform
  profile or policy writes directly.
- [OpenTelemetry Semantic Convention Naming](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  recommends lower-case namespacing, snake_case for multi-word name components,
  and precise unambiguous terms. The contract uses
  `policy.request_time_learning.v1` and product-domain step names instead of
  roadmap phase identifiers.
- [OpenTelemetry Traces](https://opentelemetry.io/docs/concepts/signals/traces/)
  describes traces as correlated spans and attributes. This contract keeps
  traceable request-learning attributes bounded, stable, and aligned with the
  carried validation proof so later runtime wiring can correlate decisions
  without storing raw evidence payloads.
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

The contract should carry only bounded question-reduction proof:

```text
question-reduction version
question-reduction disposition
question-reduction validation ok/issue count
question-reduction evidence fingerprint
question-reduction trace evidence fingerprint
request-time trace question-reduction-valid attribute
```

It should not embed full question plans, raw question text, raw labels, provider
payloads, prompts, embeddings, or diagnostics.

## Pros And Cons

Pros:

- Keeps request destination choice separate from final outcome.
- Prevents failed routes from becoming positive destination evidence.
- Routes all durable learning through the policy learning guard.
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
- Runtime integration must supply a validated runtime question-reduction plan or
  equivalent bounded validation proof before request-time learning can pass.

## Final Recommendation Stack

1. Normalize request/import/manual/routing events into bounded event ids:
   - `user_requested_destination`,
   - `operator_manual_destination_change`,
   - `route_succeeded`,
   - `route_failed_missing_mapping`.
2. Map each event to a policy learning source.
3. Record destination selection separately from final outcome.
4. Run every request-time learning candidate through the policy learning
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
11. Carry bounded question-reduction validation proof into the request-time
    decision.
12. Mirror the question-reduction validation result into bounded trace
    attributes.
13. Reject missing, invalid, mismatched, or trace-drifted question-reduction
    proof before request-time learning can pass validation.
14. Use a normalized request event and a valid clarification plan as the only
    decision inputs. Raw runtime input must use the explicit runtime adapter.

## Implemented Files

- Request-time learning contract:
  `server/src/services/policyRequestTimeLearning.mjs`
- Request-event normalizer:
  `server/src/services/policyRequestTimeEvent.mjs`
- Request-time input-boundary outcome:
  `docs/architecture/policy-request-time-learning-input-boundary.md`
- Focused tests:
  `server/src/__tests__/services/policyRequestTimeLearning.test.mjs`
- Learning guard dependency:
  `server/src/services/policyLearningGuard.mjs`
- Question vocabulary dependency:
  `server/src/services/policyQuestionLearningVocabulary.mjs`
- Roadmap owner:
  Request-Time Learning And Destination Selection in
  `docs/architecture/policy-builder-intent-model-roadmap.md`

## Implemented Contract

The service exports:

- `POLICY_REQUEST_EVENT_TYPE_IDS`
- `POLICY_REQUEST_LEARNING_AUDIT_RISK_IDS`
- `POLICY_REQUEST_LEARNING_DISPOSITION_IDS`
- `POLICY_REQUEST_LEARNING_REASON_IDS`
- `buildPolicyRequestTimeLearningDecisionFromQuestionReductionPlan`
- `buildPolicyRequestTimeLearningDecisionFromRuntimeInput`
- `buildPolicyRequestTimeLearningAudit`
- `validatePolicyRequestTimeLearningDecision`

## Event Semantics

`user_requested_destination`
: A requester or import flow selected a destination. The choice is recorded as
  a request-time signal and final outcome, but it is outcome-only unless the
  learning guard later approves a durable candidate.

`operator_manual_destination_change`
: An operator changed the destination. The change is auditable, reversible, and
  may become a learning candidate only through the policy learning guard.

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
- The contract carries only bounded question-reduction proof and rejects missing
  or failed upstream validation before request-time choices can be treated as
  learning candidates.
- The request-time trace must mirror the upstream question-reduction validation
  status and sanitized evidence fingerprint.
- The validated-plan reducer rejects raw event, question, automation, and
  fingerprint fields; upstream provenance comes only from the clarification
  plan.

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
- request-time decisions carry bounded question-reduction validation proof,
- missing, invalid, or fingerprint-drifted question-reduction proof fails
  validation,
- request-time trace attributes must match the carried question-reduction proof,
- request-time traces are recomputed from normalized event, route, guard, and
  question-reduction fields so altered reasons, counts, or attributes fail,
- request events are normalized separately and cannot carry upstream contracts,
- raw runtime input must use the explicit adapter while the reducer requires a
  valid clarification plan and normalized request event,
- the component audit points to
  `nextStep.stepId = library_policy_rebuild`.

## Outcome

Request-time learning gives request/import/manual/routing events this runtime
shape:

```text
request or routing event
  -> normalized destination selection
  -> final outcome record
  -> policy learning guard
  -> optional guarded profile-refresh recommendation
  -> no direct side effects
```

This lets later runtime integration learn from meaningful operator decisions
without treating every request, route, or failure as policy evidence.

## Next Step

Library-Derived Policy Rebuild should consume guarded outcomes, library profile
evidence, routing configuration, and explicit constraints to produce reviewable
policy rebuild proposals without destructive replacement.
