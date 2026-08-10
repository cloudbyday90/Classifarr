# Historic Route-Safety Explanation

Status: implemented. This document records the compatibility outcome for
historic pending decisions that have a high policy score but predate the
persisted route-safety projection.

## Problem

Current records retain the exact server-owned condition that stopped automatic
routing. Older records can retain a policy score and thresholds without the
route-safety state that led to review. Reconstructing that condition from a
score, a model method, or incomplete metadata would be speculation. Treating
the score as an authority grant would be unsafe.

## Research And Recommendations

NIST's AI RMF Core says human-AI roles and oversight processes should be
defined, assessed, and documented. Its Playbook also treats risk management as
an iterative Govern, Map, Measure, and Manage activity, not a universal
checklist. These principles support stating the boundary of retained evidence
rather than recreating an unrecorded historical decision.

- [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
- [NIST AI RMF Map guidance](https://airc.nist.gov/airmf-resources/playbook/map/)
- [NIST AI RMF Playbook](https://airc.nist.gov/airmf-resources/playbook/)

Options considered:

1. Reconstruct the historic route gate from current policy data.
   - Pros: appears specific without user action.
   - Cons: today’s policy is not the historical decision, and the result could
     misstate the actual route block. Rejected.
2. Let the high score authorize the existing pending decision.
   - Pros: reduces operator work.
   - Cons: bypasses deterministic route authority and can turn incomplete
     historic data into an Arr side effect. Rejected.
3. Report bounded explanation unavailability and require a retry.
   - Pros: honest, actionable, and preserves the current authority boundary.
   - Cons: requires a new classification pass before a decision. Selected.

## Implemented Outcome

`policyRuntimeQuestionDecisionPresentation.mjs` emits the additive
`historical_route_safety_details_unavailable` status and safe explanation only
when a pending high-score record has no persisted or derivable route-safety
gate. The message asks the operator to retry classification so the current
policy evaluation can produce the normal versioned route-safety projection.

`policyRuntimeQuestionAnswerContract.mjs` maps that state through its existing
freshness boundary. Destination-changing actions are unavailable, server-side
validation rejects a submitted confirmation as stale, and retry remains the
only available recovery action. This prevents a browser or a recorded answer
from treating the explanation as an authority grant.

This is a presentation compatibility state, not a routing rule. It cannot:

- authorize an automatic route,
- recreate model output, policy settings, or old provider state,
- change pending-decision identity or audit history, or
- bypass answer-contract validation.

Administrators can identify active records in this compatibility state through
the separate, bounded [Historic Route-Safety Refresh
Inventory](historic-route-safety-refresh-inventory.md). That inventory only
plans existing retry commands; it does not mutate the historical record or run
a retry from its GET endpoint.

The message is fixed server text and contains no title, prompt, provider
response, credentials, endpoint, or free-form rationale. Current records still
show their actual persisted gate, such as AI advisory authority or provider
recovery review.

## Verification

Server tests cover the retained AI-authority gate and the historic high-score
fallback. The latter asserts that the UI contract names the unavailable history,
requires retry, and never emits the former unnamed “another safety gate” text.
The existing client projection accepts the bounded additive status and renders
the supplied safe label and message without interpreting it as authority.
