# Candidate-Bound Verification Observability And Operator Explanation

## Status

11R.3 is complete on 2026-08-12. It makes the status of a candidate-bound AI
verification legible in the existing pending-decision review. It does not grant
AI route, policy, learning, retry, notification, provider, or domain-write
authority.

## Problem

11R.2 correctly persists only a version and status identifier for
candidate-bound verification. Without a dedicated read-model projection, the
operator either sees a generic AI advisory or no explanation of whether the
provider confirmed, abstained, returned an invalid strict response, or was
ineligible before invocation. Showing raw model text to close that gap would
weaken the persistence and prompt-injection boundaries established by 11R.2.

## Official Research Basis

This implementation was reviewed against official guidance available in August
2026:

- NIST AI RMF calls for documented oversight, monitoring, accountability, and
  human-AI interaction controls. [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
- OWASP recommends least privilege, separation of untrusted content, output
  filtering, and human approval for consequential operations. [OWASP LLM01:
  Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)
- OWASP recommends minimizing and restricting sensitive data that can reach a
  model or external system. [OWASP LLM02: Sensitive Information
  Disclosure](https://genai.owasp.org/llmrisk/llm022025-sensitive-information-disclosure/)
- WAI-ARIA defines `status` as a polite live region for non-interruptive status
  messages. [WAI-ARIA 1.2](https://www.w3.org/TR/wai-aria/) and [ARIA22:
  Using role=status](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22)

## Decision

The server maps only the validated 11R.2 persistence projection to
`classification.candidate_bound_verification_presentation.v1`:

```json
{
  "version": "classification.candidate_bound_verification_presentation.v1",
  "status_id": "confirmed",
  "label": "Candidate verification confirmed",
  "message": "An admitted AI provider confirmed the policy-selected destination. It did not select the destination or determine whether this item can route."
}
```

The presentation is a fixed lookup keyed by the contract's known statuses. It
contains no provider name, model name, candidate identifier, prompt, raw model
response, provider reason, or item metadata. Unknown status/version pairs are
not presented.

The existing `decision_summary` read model carries the projection. The client
requires the expected version, an allow-listed status, and bounded label and
message before rendering it in a `role="status"` panel. A candidate-bound
presentation replaces the generic legacy AI advisory for that record; legacy
records with no candidate-bound presentation continue to use the existing
advisory panel.

### Status Map

| Persisted status | Operator result |
| --- | --- |
| `admitted` | Provider admission succeeded; no outcome was retained. |
| `confirmed` | Provider confirmed the deterministic candidate, but did not select or route it. |
| `abstained` | Provider did not confirm; operator reviews deterministic evidence. |
| `contract_violation` | Strict response was rejected and not used. |
| `candidate_unavailable` | No verification request was sent because the candidate was unavailable. |
| `candidate_mismatch` | No request was sent because policy and deterministic candidate did not agree. |
| `provider_capability_unavailable` | No request was sent because the configured provider was not admitted. |

## Alternatives

### Render Provider Or Model Text

Pros: provides more detail without a separate diagnostics screen.

Cons: can expose untrusted content, leak operational/provider information, and
make a probabilistic explanation appear authoritative.

Decision: rejected.

### Keep Only The Generic AI Advisory

Pros: no new contract field or UI surface.

Cons: cannot distinguish confirmation from abstention, rejected output, or
pre-invocation non-admission. Operators cannot understand the safety boundary.

Decision: rejected.

### Derive Operator Copy In The Browser

Pros: fewer server changes.

Cons: duplicates the trust boundary, lets copy drift across clients, and makes
the UI responsible for interpreting runtime authority state.

Decision: rejected.

## Final Recommendation Stack

1. Retain only the candidate-bound contract version and status identifier in
   runtime history.
2. Project status through one server-owned fixed map at the decision-summary
   boundary.
3. Validate the version and status allow-list again in every client before
   rendering a bounded, non-interruptive operator explanation.
4. Keep deterministic policy evidence, actions, thresholds, and routing as the
   decision authority; verification status is explanatory only.
5. Treat unknown or malformed presentation data as unavailable rather than
   rendering provider-controlled content.

## Implementation Evidence

- Server presentation map:
  `server/src/services/classificationCandidateBoundVerificationPresentation.mjs`.
- Existing decision-summary integration:
  `server/src/services/policyRuntimeQuestionDecisionPresentation.mjs`.
- Client boundary validation:
  `client/src/utils/policyQuestionDecisionPresentation.js`.
- Accessible review panel:
  `client/src/components/command-center/PendingQuestionRecommendationActions.vue`.
- Focused coverage:
  `server/src/__tests__/classificationCandidateBoundVerificationPresentation.test.mjs`,
  `server/src/__tests__/services/policyRuntimeQuestionDecisionPresentation.test.mjs`,
  `client/src/__tests__/policyQuestionDecisionPresentation.test.js`, and
  `client/src/__tests__/pendingQuestionRecommendationActions.test.js`.

## Next Task

Proceed with **11R.4 Candidate-Bound Verification Aggregate Outcome Metrics And
Drift Guard**: add privacy-bounded aggregate status counts and change-rate
monitoring for verification outcomes without retaining item, candidate,
provider, prompt, or model-response content.
