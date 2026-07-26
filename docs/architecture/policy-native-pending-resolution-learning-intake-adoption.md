# Policy Native Pending-Resolution Learning Intake Adoption

## Status

Implemented as Phase 6R.3.2c. Native pending-resolution provenance now uses
the canonical learning intake for both its validated request-time path and its
malformed-plan outcome-only fallback.

## Problem

Native pending-resolution provenance records a server-validated operator
selection while deferring all routing and durable learning. Its fallback path
previously built a learning-guard payload directly when the persisted
question-reduction plan was missing or invalid. That made the fallback a
second normalization boundary and did not require a canonical source event.

## Research Inputs

Official sources reviewed July 2026 against the requested June 2026 baseline:

- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-derived security-relevant values and explicit workflow
  states. The adapter derives source, answer outcome, destination, and event
  correlation only from server-validated native pending state.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends server-side allowlist validation at syntactic and semantic
  boundaries. The shared intake validates its version, source, answer,
  question frame, source-event identifier, and final outcome before the guard
  can run.
- [OWASP Logging Vocabulary Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Vocabulary_Cheat_Sheet.html)
  identifies invalid server-side validation against a discrete value list as a
  high-signal event. The provenance audit now records a bounded invalid-intake
  risk without retaining raw question or media content.
- [NIST SP 800-218 Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  recommends testable secure-development practices. Focused tests cover the
  normal request-time reuse, malformed-plan fallback, and fail-closed unknown
  frame behavior.

## Design

```text
persisted native pending question + server-validated selection
  -> valid reduction plan: request-time intake and decision
  -> missing or invalid plan: native pending fallback intake
  -> policy.learning_intake.v1 validation
  -> policy.learning_guard.v1
  -> compact outcome-only provenance
```

The adapter derives `classification:<classification id>` only from the current
server classification record. It is a bounded correlation identifier, not a
claim that a final outcome, learning record, or route action was persisted.
Phase 6R.3.3 must still enforce a unique persistence key, current-state check,
authorization, and transaction boundary before any durable write.

The public provenance record exposes only a compact intake summary: version,
source, source-event ID, and answer outcome. It excludes question wording,
media title, actor identity, raw provider data, and AI output. The complete
canonical intake remains internal to the reducer audit.

## Recommendations

1. Require the canonical intake contract before every native-pending fallback
   guard call; do not reintroduce a direct payload builder.
2. Continue deriving source and source-event IDs from server state, never from
   a selected option label or browser/Discord payload.
3. Treat a malformed question frame or intake as fail closed: keep the
   operational outcome unexecuted and surface the bounded audit risk.
4. Retain the normal request-time decision path and its evidence-fingerprint
   proof; the fallback must not manufacture equivalent evidence.
5. Add idempotency, authorization, and legal state-transition checks only in
   the future persistence transaction, not in this pure provenance reducer.

## Pros And Cons

### Pros

- Removes the remaining direct guard-input shaping from native pending
  resolution.
- Gives normal and fallback resolution paths the same source/outcome contract.
- Preserves existing no-write, no-route, no-provider, and no-profile-refresh
  behavior.
- Produces a compact auditable correlation without disclosing media or prompt
  data.

### Cons

- The native route-outcome and request-import fallback adapters still have
  their own direct guard calls and require separate adoption work.
- `classification:<id>` correlates this pure reduction only; it is not enough
  to protect a later durable transaction against replay by itself.
- An invalid fallback intake is deliberately blocked rather than repaired from
  untrusted or stale question data.

## Final Recommendation Stack

1. `policyNativePendingQuestionPresentation.mjs` validates the persisted
   server-owned question and allowed selection.
2. `policyRequestTimeLearning.mjs` remains the preferred path when the
   persisted reduction plan is valid.
3. `policyLearningIntakeContract.mjs` normalizes and validates fallback input.
4. `policyLearningGuard.mjs` evaluates outcome-only learning eligibility.
5. `policyNativePendingResolutionProvenance.mjs` records bounded provenance
   without any external side effect.
6. Phase 6R.3.3 later authorizes and persists an outcome or learning decision
   transactionally.

## Security Outcome

- A native pending-resolution fallback cannot invoke the guard without a
  valid allowlisted intake and server-derived correlation.
- Unknown question frames fail closed and add a bounded audit risk.
- The final outcome remains bound to the intake source and answer outcome.
- No adapter result can claim a route, provider, quota, profile-refresh,
  outcome-persistence, or learning-write side effect.

## Verification

Focused tests verify valid confirmation provenance, manual destination
changes, a fingerprint-drifted reduction plan using canonical fallback intake,
an unknown fallback frame failing closed, transport-label exclusion, and
side-effect audit rejection.

## Next Step

Proceed to **Phase 6R.3.2d: Native Pending Route-Outcome Intake Adoption**.
Replace that adapter's remaining direct guard-input construction with the same
canonical intake contract before handling request-import fallback or Discord.
