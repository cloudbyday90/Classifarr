# Policy Request-Time Learning Intake Adoption

## Status

Implemented as Phase 6R.3.2b. Request-time learning now validates a canonical
learning intake before it invokes the policy learning guard.

## Problem

Request-time learning already normalized request events and carried a validated
question-reduction fingerprint, but it still shaped guard input directly. That
left the source-event correlation optional and allowed final outcome shaping to
drift from the canonical intake boundary.

## Research Inputs

Official sources reviewed July 2026 against the requested June 2026 baseline:

- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-derived workflow state, explicit state transitions, and
  idempotency protection. Request-time learning now requires a server-provided
  source event before it can evaluate the guard.
- [OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
  requires server-side authorization and final execution gates. This pure
  reducer neither authorizes nor writes an outcome or learning record.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends interaction identifiers and bounded/sanitized event data. The
  existing source-event ID now becomes the required intake correlation key.
- [NIST SP 800-218 Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports testable secure development practices. Focused tests preserve the
  fingerprint proof, route semantics, and no-write behavior.

## Design

```text
validated request-time event + question-reduction plan
  -> derive source and final destination
  -> policy.learning_intake.v1 with sourceEventId
  -> intake audit
  -> policy.learning_guard.v1
  -> request-time decision with original fingerprint proof and trace
```

The intake receives the event source, server-provided source-event ID, actor,
item, answer outcome, normalized question, selected destination, candidate,
guard-blocking context, and final outcome. The decision exposes the canonical
intake outcome itself, so audit detects a later attempt to replace it with an
unrelated outcome.

The original `learningGuardContext` continues to carry the bounded upstream
evidence fingerprint for request-time audit and trace verification. The intake
only carries the guard-relevant context fields; it does not retain raw AI text
or provider payloads.

## Recommendations

1. Every request-time producer must derive `sourceEventId` from a trusted
   request, pending-question, or routing record before calling this reducer.
2. Keep question-reduction proof and evidence fingerprint outside the intake
   but verify them in the existing request-time audit.
3. Use the canonical intake final outcome as the only final outcome exposed by
   request-time learning.
4. Enforce uniqueness and current-state checks in Phase 6R.3.3 persistence;
   the source event ID is correlation, not standalone replay protection.

## Pros And Cons

### Pros

- Request, confirmation, manual-destination, and route event types now share
  the same pre-guard source/outcome boundary.
- Missing source correlation fails before guard evaluation.
- Existing evidence-fingerprint and question-reduction validations remain
  intact and are tested with the new intake.
- Canonical outcome identity prevents post-build drift.

### Cons

- Producers that previously omitted a source event must supply one.
- This remains a pure decision component; it cannot guarantee transactional
  idempotency until Phase 6R.3.3.

## Final Recommendation Stack

1. `policyRequestTimeEvent.mjs` normalizes bounded request-time data.
2. `policyRuntimeQuestionReduction.mjs` supplies the validated evidence proof.
3. `policyLearningIntakeContract.mjs` validates the guarded handoff.
4. `policyLearningGuard.mjs` evaluates learning eligibility.
5. `policyRequestTimeLearning.mjs` retains selection, trace, and no-write
   decision semantics.

## Security Outcome

- A request-time decision cannot call the guard without a valid canonical
  intake and server event correlation.
- The canonical final outcome must remain the decision's final outcome.
- Raw AI explanation text is reduced to a guard-blocking presence signal before
  intake, while question-reduction fingerprint checks remain intact.
- The reducer performs no outcome, learning, profile-refresh, provider,
  routing, or policy write.

## Verification

Focused tests cover all request-time event types, stale and rejected questions,
route success/failure, profile-refresh eligibility, missing source-event
rejection, intake validation, native-pending consumers, and request-import
admission.

## Next Step

Proceed to **Phase 6R.3.2c: Native Pending And Routing Intake Adoption**.
Consolidate the remaining direct guard calls in native-pending resolution and
routing outcome adapters through the same contract before adding Discord.
