# Policy Request-Import Fallback Learning Intake Adoption

## Status

Implemented as Phase 6R.3.2e. Request/import terminal-routing admission now
uses canonical learning intake for both the valid native-plan path and the
missing or invalid-plan fallback.

## Problem

Request/import classification already uses request-time learning when it has a
valid native question-reduction plan. When the plan was missing or invalid, its
outcome-only fallback constructed a learning-guard input directly. That left
legacy imports on a separate source, answer, and final-outcome normalization
path before the guard.

## Research Inputs

Official sources reviewed July 2026 against the requested June 2026 baseline:

- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-derived workflow state and explicit transitions. The
  admission derives classification, final destination, terminal route state,
  and correlation from the completed server classification rather than the
  queue payload.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends server-side allowlist and semantic validation. The shared intake
  validates the known route source, source-event ID, answer outcome, question
  frame, and final outcome before the fallback calls the guard.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends protecting and minimizing collected event data. The completed
  task receives only compact intake provenance and no request title, requester,
  raw route error, provider payload, or AI output.
- [NIST SP 800-218 Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports repeatable secure development and verification. Focused tests cover
  valid proof reuse, missing/invalid-proof fallback, intake auditing, and data
  redaction.

## Design

```text
server-owned request/import classification and terminal route result
  -> policy.request_time_event.v1
  -> valid plan: request-time intake and decision
  -> missing or invalid plan: request/import fallback intake and decision
  -> policy.learning_guard.v1
  -> bounded completed-task admission result
```

The valid-plan path preserves the existing request-time intake, including its
canonical answer outcome. The fallback intentionally uses `do_not_learn` and
does not reconstruct evidence from an incomplete, legacy, or invalid plan.
Both paths expose only compact intake provenance and use the intake's final
outcome as the admission final outcome.

The source-event ID remains `classification:<classification id>`, derived from
the server classification record. It correlates this pure decision and does not
by itself authorize a durable transaction or provide replay protection.

## Recommendations

1. Require the canonical intake contract for every request/import fallback
   guard call; do not add another legacy guard-payload builder.
2. Keep the terminal request-time event as the sole source of route, final
   destination, and source-event normalization.
3. Preserve valid native-plan request-time semantics; a fallback must remain
   outcome-only and must not infer identity or requester intent.
4. Keep request payloads, requester identity, raw route errors, provider
   payloads, and AI text out of the admission result and intake.
5. Treat an invalid intake as an audit failure with no learning decision;
   Phase 6R.3.3 must enforce authorization, current state, and idempotency at
   any future durable write boundary.

## Pros And Cons

### Pros

- Removes the final direct adapter guard-input construction outside the future
  Discord work.
- Makes valid-native and legacy fallback paths share one source/final-outcome
  contract.
- Preserves the distinction between a request, a routed destination, and a
  requester-selected destination.
- Retains current queue completion behavior without adding provider, quota,
  route, learning, or profile-refresh activity.

### Cons

- Valid native proof can retain a different canonical answer outcome than the
  fallback; consumers must use the guarded decision instead of treating every
  outcome-only route as `do_not_learn`.
- The completed queue-task result is operational history, not an authorized
  long-term policy-evidence store.
- Source-event correlation still needs a transactional uniqueness check before
  future durable persistence.

## Final Recommendation Stack

1. `classificationResultOutcomeSummary.mjs` derives bounded classification and
   routing summaries.
2. `policyRequestTimeEvent.mjs` normalizes terminal route state and source
   correlation.
3. `policyRuntimeQuestionReduction.mjs` verifies a native plan when present.
4. `policyLearningIntakeContract.mjs` validates both request/import paths.
5. `policyRequestTimeLearning.mjs` handles valid native proof; the admission
   fallback remains outcome-only.
6. `policyLearningGuard.mjs` evaluates eligibility without a write.
7. `queueTaskProcessorService.mjs` stores only the bounded admission result.

## Security Outcome

- Queue payloads cannot choose the learning source, destination, route state,
  question frame, answer outcome, or source-event identifier.
- Missing and invalid native proof cannot be transformed into inferred policy
  evidence.
- Invalid intake is surfaced in the admission audit and cannot authorize a
  learning decision.
- The adapter performs no durable learning, profile refresh, provider, quota,
  or routing side effect.

## Verification

Focused tests cover a valid native plan, missing mapping, legacy no-proof
fallback, a tampered plan, invalid fallback-intake audit, non-request inputs,
and data redaction. The queue processor continues to own completed-task
persistence independently from this pure admission reducer.

## Next Step

Proceed to **Phase 6R.3.2f: Discord Pending-Answer Intake Adapter**. Build one
server-owned adapter for Discord verification and correction answers, derive
source-event correlation from persisted pending-question state, and remove the
older Discord learning entry points only after parity tests pass.
