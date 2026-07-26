# Policy Learning Intake Contract

## Status

Implemented as Phase 6R.3.1. This is a pure, server-owned intake boundary for
the five sources that may lead to a policy learning decision. It does not
authenticate an actor, persist an outcome, write learning, refresh a profile,
or route media.

## Problem

`policyLearningGuard.mjs` correctly separates final outcome from learning, but
its source vocabulary was previously consumed by independent manual,
request-time, native pending, and future Discord adapters. That makes it too
easy for an adapter to omit a source correlation ID, carry raw model text, or
shape a final outcome differently before it reaches the guard.

The Discord source was defined in the guard vocabulary but did not yet have a
canonical runtime producer. The former roadmap wording overstated that all
five sources were already routed through one live intake path.

## Research Inputs

Official sources reviewed July 2026 against the requested June 2026 baseline:

- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends early server-side syntactic and semantic validation, allowlists,
  canonicalization, and bounded fields. The intake permits only fixed source,
  answer, question, and final-outcome vocabularies.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-derived security-relevant values and explicit server-side
  workflow state. The intake requires a server-owned source and bounded source
  event identifier; a browser, Discord payload, or provider payload cannot
  nominate a new source or transition on its own.
- [OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
  recommends server-side authorization, state-transition validation, and a
  final gate before execution. Intake validation is not authorization or
  persistence; later adapters must independently authorize and atomically
  enforce outcome and learning writes.
- [NIST SP 800-218 Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  recommends integrating secure development practices into normal delivery.
  The versioned contract, focused audit, and adversarial tests make this
  boundary reviewable before persistence adoption.

## Design

```text
trusted source adapter
  -> policy.learning_intake.v1
  -> intake audit
  -> guard input projection
  -> policy.learning_guard.v1
  -> separately authorized outcome / learning persistence
```

The intake accepts only:

- known learning source ID,
- bounded `sourceEventId` for audit correlation and later idempotency,
- bounded actor and item identifiers,
- known answer outcome,
- known accepted or rejected question frame plus stale state,
- bounded destination answer and candidate fields,
- boolean/state flags the guard must block,
- a `policy.final_outcome.v1` record constructed by the shared normalizer.

It deliberately excludes raw AI explanation text, provider payloads, titles,
paths, arbitrary metadata, persistence instructions, routing commands, and
client-selected authority. It retains only `aiExplanationText: 'present'` when
text existed, which is sufficient for the learning guard to block durable
learning without retaining prompt or model output.

Known rejected frames are valid intake values because the final outcome may
still be recorded; the guard, not the intake, blocks them from learning. An
unknown frame, source, answer outcome, missing source event identifier, or
tampered final-outcome source/answer fails closed and cannot be projected into
guard input.

## Recommendations

1. Build every future manual, Discord, request, and routing learning attempt
   through `policyLearningIntakeContract.mjs` before calling the guard.
2. Derive `sourceId`, actor authorization, and current workflow state from
   server-side context. Do not trust an incoming source or actor claim.
3. Require a stable source event ID. The later persistence transaction must
   use it as part of its idempotency and replay protection strategy.
4. Treat the intake audit as an admission check only. Persistence must perform
   its own authorization, state, concurrency, and transaction checks.
5. Preserve final outcome and learning as separate records throughout the
   adoption work.

## Pros And Cons

### Pros

- Gives all five source classes one bounded shape before the learning guard.
- Removes raw model explanations and arbitrary payloads from the intake path.
- Makes final-outcome/source/answer consistency testable in one location.
- Provides a correlation handle for future audit and idempotent storage.
- Does not add a new policy authority or storage side effect.

### Cons

- Existing adapters still need a focused adoption pass.
- A correlation ID alone does not prevent duplicate writes; the later storage
  transaction must enforce uniqueness and legal state transitions.
- The contract intentionally rejects arbitrary source extensions until their
  authority and semantics have been reviewed.

## Final Recommendation Stack

1. `policyLearningIntakeContract.mjs` normalizes and audits source events.
2. `policyFinalOutcomeNormalizer.mjs` owns final-outcome shaping.
3. `policyLearningGuard.mjs` evaluates durable-learning eligibility.
4. A later adapter authorizes and persists final outcome, approved learning,
   and any refresh command in the correct transaction.

## Security Outcome

- Only known server-owned source IDs and answer outcomes can enter the guard.
- Missing correlation, unknown fields, and source/outcome drift fail closed.
- Raw AI and provider payloads are excluded before they can enter learning
  context or future event persistence.
- The component has no database, provider, Discord, media-server, routing,
  profile-refresh, or learning-write side effect.
- The final outcome cannot be silently disconnected from the event source or
  chosen answer outcome.

## Verification

Focused tests cover all five source IDs, normalization, exclusion of raw AI and
provider payloads, recognized rejected question frames, unknown source/answer
rejection, missing source-event correlation, and tampered final-outcome
consistency.

## Adoption Record

The first live adoption is documented in
[Policy Manual Correction Learning Intake Adoption](policy-manual-correction-learning-intake-adoption.md).
The manual correction route derives a bounded source-event ID from the
persisted correction row and the exact-item-memory adapter now validates this
contract before it calls the learning guard.

Request-time adoption is documented in
[Policy Request-Time Learning Intake Adoption](policy-request-time-learning-intake-adoption.md).
It requires a server-provided source event, retains the independent
question-reduction fingerprint proof, and exposes the intake's canonical final
outcome in the resulting no-write decision.

Native pending-resolution adoption is documented in
[Policy Native Pending-Resolution Learning Intake Adoption](policy-native-pending-resolution-learning-intake-adoption.md).
It removes the malformed-plan fallback's direct guard input, retains the
validated request-time intake when available, and exposes only compact intake
provenance while preserving its no-write behavior.

## Next Step

Proceed to **Phase 6R.3.2: Learning Intake Adapter Adoption**. Migrate the
manual correction, request-time, native pending, routing outcome, and Discord
answer adapters one at a time, then remove their duplicate pre-guard shaping.
