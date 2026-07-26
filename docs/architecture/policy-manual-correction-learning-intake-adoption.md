# Policy Manual Correction Learning Intake Adoption

## Status

Implemented as the first component of Phase 6R.3.2. The live manual
classification-correction route now constructs a canonical learning intake from
the persisted correction record before it evaluates exact-item-memory learning.

## Problem

Manual correction is a consequential path: it changes the classification
destination, records an outcome, and may admit exact-item memory. Before this
change, its learning adapter shaped guard input directly. Although the source
and answer were constants in code, it had no shared source-event correlation
with the canonical intake contract.

## Research Inputs

Official sources reviewed July 2026 against the requested June 2026 baseline:

- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-derived state, explicit workflow transitions, atomic
  critical sections, and idempotency protection. This adapter derives its
  event key from the newly persisted correction row rather than request input.
- [OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
  requires server-side authorization and legal state-transition checks. The
  intake adoption does not broaden route authority; existing correction
  authorization and later persistence controls remain required.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends interaction identifiers and sanitization. The bounded correction
  identifier carries correlation without raw request, media, provider, or AI
  payloads.
- [NIST SP 800-218 Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports versioned, testable secure-delivery controls. Focused tests verify
  that the guard cannot be called through this adapter without valid intake.

## Design

```text
authenticated correction request
  -> server validates classification and target library
  -> persisted classification_corrections row
  -> classification_correction:<row id> intake correlation
  -> policy.learning_intake.v1 audit
  -> policy.learning_guard.v1
  -> existing exact-item-memory persistence decision
```

The route derives `sourceEventId` from `classification_corrections.id` after
the correction row exists. The caller cannot submit or override this value.
`policyManualCorrectionLearning.mjs` builds the canonical intake, validates it,
and only then projects it into the learning guard. Missing or invalid intake
causes a fail-closed error instead of a direct guard call.

The service retains the existing behavior:

- an unrecorded final outcome blocks learning;
- incomplete item or destination references remain outcome-only;
- a complete correction can become exact-item memory only;
- no profile refresh, provider call, routing action, or learning write occurs
  in the intake or admission service itself.

## Recommendations

1. Keep correction event correlation server-derived from the persisted row.
2. Preserve the intake audit beside the guard audit in internal result data.
3. Do not treat this correlation ID as completed idempotency protection yet;
   Phase 6R.3.3 must enforce a unique transactional persistence key.
4. Preserve existing route authorization and revalidate final state in the
   later transaction boundary.

## Pros And Cons

### Pros

- The first live adapter now uses the shared intake contract end to end.
- Exact-item learning keeps its current conservative admission criteria.
- Source-event provenance is server-derived and bounded.
- Tests cover missing correlation and post-build intake tampering.

### Cons

- The route’s current correction, outcome, and evidence writes are still not
  the future unified transactional persistence boundary.
- Request, native pending, routing, and Discord adapters remain to be adopted
  independently.

## Final Recommendation Stack

1. `classificationRouteCorrections.mjs` derives the correction event ID after
   the server persists the correction row.
2. `policyManualCorrectionLearning.mjs` builds and audits canonical intake.
3. `policyLearningIntakeContract.mjs` bounds the handoff.
4. `policyLearningGuard.mjs` decides exact-item eligibility.
5. Phase 6R.3.3 introduces authorized, idempotent persistence.

## Security Outcome

- Request-body data cannot claim a learning source-event ID.
- Missing intake correlation fails closed before guard evaluation.
- Intake and guard audits are separate, preventing a valid decision from
  concealing a tampered intake envelope.
- The adoption adds no new Discord, provider, routing, profile-refresh, or
  policy-write capability.

## Verification

Focused tests cover valid manual correction intake, exact-item admission,
outcome-only and unrecorded outcomes, missing source-event rejection, and a
tampered intake audit. Existing route integration tests continue to exercise
the correction lifecycle.

## Next Step

Proceed to **Phase 6R.3.2b: Request-Time Learning Intake Adoption**. That
component should adapt the existing request-time event builder without changing
its question-reduction or bounded-intent invariants.
