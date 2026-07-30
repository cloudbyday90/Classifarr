# Policy Request-Time Queue Question-Reduction Admission

## Status

Implemented as the Phase 7R.5 queue-to-request-time admission boundary.

This component admits a queue-produced question-reduction plan only when it
can prove that the plan belongs to the current classification task and attempt.
It then delegates to the existing request-time learning reducer for a terminal
routing outcome. It is side-effect-free and never exposes raw queue or provider
data.

## Problem

The queue question-reduction contract already creates a bounded plan from a
fresh, evidence-bound automation decision. A later terminal routing outcome
must not accept that plan merely because it is structurally valid. Without a
same-task binding, an old plan could be replayed for another task or attempt.

The request/import destination admission already supports a direct validated
question-reduction plan. Queue execution needs an equivalent, narrower proof
source that preserves the existing learning guard rather than creating a second
learning path.

## Official Guidance Reviewed

- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends explicit server-side workflow state and validation of sequencing
  and replay-sensitive operations. The admission boundary recomputes the task
  and execution binding before it uses a queued plan.
- [OWASP API3: Broken Object Property Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/)
  recommends allowlisting returned properties and avoiding automatic binding.
  The result exposes only opaque fingerprints, a validated request-time
  decision, and explicit false side-effect flags.
- [CWE-345: Insufficient Verification of Data Authenticity](https://cwe.mitre.org/data/definitions/345.html)
  describes the need to verify data authenticity before relying on it. The
  adapter validates the upstream queue envelope and recomputes its task-bound
  execution fingerprint locally.
- [NIST SP 800-218, Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  calls for repeatable practices that reduce recurring vulnerabilities. The
  focused tests cover cross-task replay, stale-attempt replay, invalid event
  type, raw input, raw result exposure, and altered proof fields.

## Options Considered

### Pass Queue Plans Directly To Request-Time Learning

Pros:

- Smallest code change.
- Reuses the existing generic reducer.

Cons:

- Cannot prove the plan belongs to the task that produced the terminal route
  outcome.
- Lets queue-envelope handling spread across request-time callers.
- Makes cross-task and stale-attempt replay easier to miss.

### Expand The Generic Request-Time Reducer With Queue Semantics

Pros:

- One public reducer.

Cons:

- Mixes queue transport binding with generic request-time decision logic.
- Increases the chance that raw queue context becomes a permitted generic
  input.
- Makes the existing direct-plan path harder to reason about and test.

### Use A Dedicated Queue Admission Adapter

Pros:

- Revalidates the queue plan, task fingerprint, task type, attempt, evidence
  fingerprint, and execution fingerprint at one boundary.
- Limits accepted request events to `route_succeeded` and
  `route_failed_missing_mapping`.
- Reuses the existing request-time reducer and policy learning guard.
- Keeps raw task identifiers, queue payloads, and provider data out of the
  result.
- Allows the request/import admission to preserve direct-plan compatibility.

Cons:

- Adds a small explicit adapter and focused test suite.
- A queue caller must provide its task id, classification task type, and
  attempt through the bounded context.

## Final Recommendation Stack

1. Accept only a queue question-reduction envelope, a three-field queue task
   context, and a canonical request-time event.
2. Re-audit the upstream queue question-reduction envelope and its embedded
   generic question-reduction plan.
3. Recompute the SHA-256 task fingerprint and queue-evidence execution
   fingerprint from the current task id, task type, attempt, and evidence
   fingerprint.
4. Reject any plan that does not match the current classification task and
   attempt exactly.
5. Accept only terminal routing outcomes; destination requests and manual
   changes retain their existing request-time paths.
6. Delegate the admitted generic plan to
   `policyRequestTimeLearning.mjs`, which remains the only request-time route
   to the learning guard.
7. On invalid, missing, stale, or competing proof, retain only the existing
   outcome-only learning decision.
8. Never persist, route, create a question, send a notification, call a
   provider, queue a profile refresh, or write learning in this boundary.

## Implemented Design

`server/src/services/policyRequestTimeQueueQuestionReduction.mjs` exports:

- `buildPolicyRequestTimeQueueQuestionReduction`
- `buildPolicyRequestTimeQueueQuestionReductionAudit`
- `POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_STATUS_IDS`
- `POLICY_REQUEST_TIME_QUEUE_QUESTION_REDUCTION_RISK_IDS`

The allowed input is exactly:

```js
{
  queueQuestionReduction,
  queueTaskContext: {
    id,
    taskType: 'classification',
    attempts,
  },
  requestEvent,
}
```

The adapter returns an opaque `queueEvidence` proof and a validated
`policy.request_time_learning.v1` decision. It excludes the queue task id,
payload, provider payloads, raw evidence, and raw labels.

`policyRequestImportDestinationAdmission.mjs` accepts the queue envelope as an
optional alternative to its existing direct plan. Passing both proof types is
explicitly ambiguous and falls back to the outcome-only decision. A malformed
or mismatched queue proof also falls back to outcome-only behavior. No existing
direct-plan caller changes behavior.

## Security And Outcome

- Cross-task and stale-attempt replay is rejected by recomputed opaque
  fingerprints.
- A successful route is still outcome-only and cannot directly write policy or
  profile evidence.
- Missing routing configuration remains a failed-route outcome and cannot
  become positive destination evidence.
- The learning guard remains the authority for any later durable learning.
- The adapter has no database, queue, provider, routing, or notification
  dependency.

## Test Coverage

Focused tests verify:

- matching queue evidence admits only a terminal outcome,
- missing mapping stays an outcome-only failure,
- task and attempt mismatch is rejected,
- non-terminal events and raw input are rejected,
- raw result fields, altered fingerprints, and claimed side effects fail audit,
- request/import admission accepts only one valid proof source and falls back
  when proof sources compete.

## Next Item

Complete the Phase 7R.5 request-time integration audit: identify every
request/import terminal routing caller and either supply a validated direct or
queue-bound proof, or assert the existing outcome-only fallback. This should
be completed before any caller is allowed to request durable learning or profile
refresh work.
