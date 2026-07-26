# Policy Discord Pending-Answer Intake Adoption

## Status

Implemented as Phase 6R.3.2f. Discord verification and correction actions now
pass through one server-owned, outcome-only intake adapter after their final
outcome is persisted.

## Problem

The legacy Discord verification and correction handlers directly invoked two
independent learning mechanisms after updating `classification_history`:

- preference learning from genres, keywords, and studio metadata;
- exact-match extraction from the classification payload.

Those writes had no canonical source-event correlation, could learn from a
generic Discord interaction instead of a persisted pending state, and made a
resolved item appear to change future policy behavior automatically. That does
not fit the policy-intent model: a Discord answer resolves one item; it is not
permission to create broad preference evidence.

## Official Guidance Reviewed

Official sources reviewed July 2026 against the requested June 2026 baseline:

- [OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
  requires server-side enforcement, server-generated verification data, and
  ordered state transitions. The adapter accepts only a server-read pending
  classification and library destination after the outcome write confirms.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends server-side allowlists and semantic validation. Action IDs,
  pending states, question frames, source IDs, answer outcomes, and destination
  references are bounded and allowlisted before the guard runs.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends minimizing event data. Handler logs contain only compact status,
  source-event correlation, guard decision, and reason codes; they omit the
  Discord payload, answer text, metadata, and actor identity.
- [NIST SP 800-218 Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports verifiable secure development. The pure adapter, audit, handler
  parity tests, and removal of duplicate write paths make the cutover
  independently testable.

## Design

```text
persisted pending classification + server-read destination
  -> persisted final outcome
  -> policy.discord_pending_answer_intake.v1
  -> policy.learning_intake.v1
  -> policy.learning_guard.v1
  -> outcome-only decision and compact audit
```

`policyDiscordPendingAnswerIntake.mjs` accepts two fixed server actions:
`verify_destination` and `correct_destination`. It allows only persisted
`pending` or `awaiting_decision` states. A native persisted question contributes
its bounded frame and evidence fingerprint; legacy pending state derives a
stable classification-scoped correlation without deserializing or exposing a
legacy question payload.

Both action types intentionally use `do_not_learn`. The guard must therefore
return `outcome_only`, no durable write permission, and no profile-refresh
command. A missing final-outcome write blocks the adapter. The adapter does not
change the already established Discord status, outcome, routing, or reply flow.

The obsolete Discord preference and exact-match write paths were removed. The
remaining routing concern moved to `discordClarificationRouting.mjs`, so it is
not bundled with learning behavior.

## Recommendations

1. Use server-read classification status and destination records, never a
   Discord component label or interaction payload, to establish the intake.
2. Require a confirmed final-outcome record before evaluating the guard.
3. Treat every current Discord verification and correction answer as
   outcome-only. Exact-item or profile evidence needs its own later authorized
   persistence transaction under Phase 6R.3.3.
4. Keep native and legacy pending provenance bounded. Use a stored evidence
   fingerprint when available and a classification-scoped fallback otherwise.
5. Log only source-event ID, action class, status, decision ID, audit result,
   and reason codes.

## Pros And Cons

### Pros

- Discord is now the final live learning source adapter to use the canonical
  intake contract.
- Direct preference and exact-match writes no longer bypass guard semantics.
- Existing Discord outcome, routing, idempotency, and reply behavior remains
  covered by parity tests.
- Native and legacy pending states have explicit bounded correlation.
- The routing module has one responsibility and no learning write behavior.

### Cons

- Discord answers no longer create immediate preference or exact-match writes.
- Legacy pending records lack native evidence fingerprints, so their
  correlation is classification-scoped rather than question-plan-scoped.
- Future durable learning requires the authorized transactional persistence
  boundary; the adapter deliberately stops before it.

## Final Recommendation Stack

1. `policyDiscordPendingAnswerIntake.mjs` normalizes the server-owned Discord
   action and persisted pending state.
2. `policyLearningIntakeContract.mjs` validates the canonical event.
3. `policyLearningGuard.mjs` enforces outcome-only semantics.
4. `classificationOutcomeService.mjs` remains the existing final-outcome
   recorder, before intake evaluation.
5. `discordClarificationRouting.mjs` owns post-resolution routing only.
6. Phase 6R.3.3 will add separate authorization, idempotency, and transaction
   enforcement before any durable learning or refresh command can be written.

## Security Outcome

- Discord input cannot nominate a source, answer outcome, question frame,
  learning tier, profile refresh, or durable write.
- Non-pending or malformed actions never admit a learning intake.
- A failed final-outcome record prevents an outcome-only admission.
- Every valid intake is bound to `discord_pending_answer`, its final outcome,
  and a bounded server-derived source event.
- The adapter has no database, provider, quota, media-server, routing,
  profile-refresh, or learning mutation side effect.
- Legacy direct learning writes are removed from the active Discord handlers.

## Verification

Focused adapter tests cover legacy and native persisted pending state,
non-pending rejection, missing final-outcome persistence, canonical
outcome-only guard behavior, and tamper detection. Discord handler tests cover
the verification and correction paths, preserve interaction safety, and assert
that each invokes the canonical adapter after final-outcome recording.

## Next Step

Proceed to **Phase 6R.3.3: Authorized Outcome And Learning Persistence**.
Define one transaction boundary that revalidates current state and source-event
idempotency before it writes an approved learning candidate or profile-refresh
command. Do not grant the existing intake adapters write authority.
