# Policy Request-Time Learning Input Boundary

## Status

Implemented for request-time learning decisions.

## Problem

The request-time learning contract accepted a clarification plan but could also
derive upstream provenance from raw question, automation-decision, or supplied
fingerprint fields. It also normalized request events inside the learning
reducer. That made the upstream workflow handoff ambiguous and allowed raw
fields to influence learning provenance.

## Official Guidance Reviewed

- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends explicit server-side workflow state and rejection of skipped or
  reordered steps.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends early server-side allowlist validation with both syntactic and
  semantic checks.
- [OWASP Secure Code Review Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secure_Code_Review_Cheat_Sheet.html)
  identifies workflow bypass and trust-boundary review as critical work.
- [NIST SP 800-218, Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports verified, maintainable secure development.

## Recommendation

Use three focused contracts:

1. `buildPolicyRequestTimeEvent` normalizes allowlisted raw request, manual,
   and route-event fields into `policy.request_time_event.v1`.
2. `buildPolicyRequestTimeLearningDecisionFromRuntimeInput` owns raw runtime
   composition and creates both the clarification plan and normalized event.
3. `buildPolicyRequestTimeLearningDecisionFromQuestionReductionPlan` accepts
   only a valid clarification plan and a valid normalized request event.

The decision reducer derives its upstream fingerprint and question state only
from the validated clarification plan. It rejects raw event fields, raw
questions, automation decisions, and supplied fingerprint values. The event
normalizer excludes upstream contracts from the event payload and retains only
bounded context that can block learning through the existing guard.

## Pros And Cons

Pros:

- Prevents raw request data from replacing clarification provenance.
- Keeps raw event normalization outside learning eligibility logic.
- Preserves one fingerprint chain from clarification through learning guard and
  request-time trace.
- Keeps request events side-effect-free and does not grant them direct learning
  authority.

Cons:

- Callers must explicitly choose raw runtime composition or the validated-plan
  reducer.
- Invalid upstream clarification plans and malformed events now fail at the
  boundary rather than producing a later-invalid request-time decision.

## Final Recommendation Stack

- Request event normalizer:
  `server/src/services/policyRequestTimeEvent.mjs`
- Request-time learning reducer:
  `server/src/services/policyRequestTimeLearning.mjs`
- Clarification dependency:
  `server/src/services/policyRuntimeQuestionReduction.mjs`
- Focused tests:
  `server/src/__tests__/services/policyRequestTimeEvent.test.mjs` and
  `server/src/__tests__/services/policyRequestTimeLearning.test.mjs`

## Outcome

```text
raw runtime input
  -> normalized request event + valid clarification plan
  -> request-time learning decision

existing normalized request event + valid clarification plan
  -> request-time learning decision
```

Request-time learning cannot use raw question, automation, or fingerprint
fields as an alternate upstream authority.
