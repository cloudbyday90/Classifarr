# Policy Discord Pending-Answer Learning Admission

## Status

Implemented as a bounded Discord resolution adapter for the Policy Learning
Guard.

When an operator answers a pending item through Discord, Classifarr now records
the item resolution through the authoritative policy resolver, then evaluates a
side-effect-free admission result. A Discord button can resolve the current
item, but it cannot turn its displayed label, Discord user data, message data,
or interaction metadata into durable policy evidence.

Legacy questions remain resolvable. They are outcome-only because they do not
carry the normalized runtime-question contract and fingerprint chain required
for guarded learning.

## Problem

The legacy Discord clarification path combined several unrelated authorities:

```text
Discord option label and interaction metadata
  -> direct classification update fallback
  -> exact-item pattern write
  -> durable metadata payload containing the chosen label
```

That bypassed the policy resolver and the learning guard if the authoritative
resolver failed. It also made historical question shape, a Discord option, and
future learning indistinguishable.

The new boundary separates these concerns:

```text
Discord option index
  -> server-persisted question option
  -> authoritative item resolution and recorded final outcome
  -> normalized-question fingerprint-chain validation
  -> Policy Learning Guard decision
  -> outcome-only unless a future valid question contract explicitly permits a tier
```

The current `policy.runtime_question_reduction.v1` contract intentionally
offers only `resolve_current_item` and `do_not_learn`. Both are outcome-only.
The admission component enforces that invariant rather than inventing learning
from a library label or selected Discord button.

## Official Guidance Reviewed

- [Discord interaction receiving and responding documentation](https://docs.discord.com/developers/interactions/receiving-and-responding)
  describes message-component interactions as carrying both user-submitted data
  and trigger metadata. The adapter treats the interaction as an untrusted
  transport input and uses only the selected index after server-side option
  validation.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends syntactic and semantic validation with allowlists. The adapter
  requires a known question contract, a valid selected server option, and a
  matching evidence-fingerprint chain; anything else is outcome-only.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends minimizing, masking, or excluding sensitive user and session data.
  The runtime log contains stable classification and decision ids plus reason
  codes, never interaction payloads, raw answer text, or Discord identifiers.
- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
  calls for managing trustworthiness throughout the system lifecycle. Final
  outcome recording and durable-learning eligibility are distinct, auditable
  decisions instead of one implicit side effect.

## Design

`server/src/services/policyDiscordPendingAnswerLearning.mjs` is a pure service.
It accepts only:

- server-persisted classification and destination identifiers;
- the server-persisted question envelope;
- the selected option index; and
- confirmation that the final outcome was recorded.

For a question to be considered normalized, the envelope must contain a valid
`policy.runtime_question_reduction.v1` plan and question. The service verifies
that the plan, embedded question, trace, and persisted question all carry the
same sanitized decision-evidence fingerprint.

The service then checks the selected persisted option against the question's
allowlisted outcomes. It does not accept an outcome id, candidate, label,
actor, user id, provider state, or free-form answer from Discord.

The Discord handler calls the authoritative resolver with `generateRule` set to
`false`. If that resolver fails, the handler reports a retry-safe error and
does not run the former direct SQL or pattern-extraction fallback. After a
successful resolution it evaluates the admission service and emits only bounded
decision telemetry. The component itself performs no policy, profile, provider,
quota, routing, or learning write.

## Recommendations

1. Keep Discord component identifiers and selected option indexes as transport
   inputs only; resolve them against the current server-persisted question.
2. Require the normalized runtime-question plan and its complete fingerprint
   chain before any pending-answer learning can be considered.
3. Record final outcome before evaluating the learning guard. A failed outcome
   write must block learning consideration.
4. Keep legacy question handling compatible but outcome-only. Do not backfill
   learning from labels or interaction data.
5. Remove all direct fallback mutations and pattern extraction from the Discord
   resolution path. Resolver failure must be retryable and non-mutating.
6. Introduce a future learning-enabled question version only with explicit
   server-owned answer outcomes, a bounded candidate contract, a policy-edit
   gate for hard limits, and dedicated persistence adapters for each tier.

## Pros And Cons

Pros:

- Closes the direct Discord fallback that bypassed server validation and the
  learning guard.
- Stops selected library labels and Discord metadata from becoming broad policy
  evidence.
- Preserves successful item resolution and existing legacy question behavior.
- Makes the fingerprint chain a prerequisite for future learning rather than a
  diagnostic-only field.
- Keeps the service deterministic, ES-module based, and independently testable.

Cons:

- Discord answers to legacy questions no longer write exact-item memories.
- The present normalized runtime-question contract deliberately produces
  outcome-only decisions, so no Discord answer changes a policy automatically.
- A later question-contract version and separate persistence adapter are needed
  before an explicitly approved learning tier can be written.

## Final Recommendation Stack

1. `discordClarificationHandler.mjs` validates the selected option through the
   authoritative resolver and disables legacy rule generation.
2. `policyDiscordPendingAnswerLearning.mjs` checks persisted-question
   provenance, the selected allowlisted outcome, and final-outcome persistence.
3. `policyRuntimeQuestionReduction.mjs` validates the normalized question plan
   and fingerprint chain.
4. `policyLearningGuard.mjs` owns learning tier, reason-code, and write-permission
   semantics.
5. Future tier-specific persistence adapters may perform a write only after a
   valid admission result. They must not reuse Discord payload data or the
   correction-specific shortcut.

## Verification

Focused tests cover a valid normalized question, legacy questions, fingerprint
drift, failed final-outcome persistence, and tampered side-effect claims. The
Discord interaction tests confirm that the handler disables legacy rule
generation and performs no direct fallback mutation after an unexpected resolver
failure.

## Next Step

Proceed with **Phase 7R.5 request/import destination-choice runtime admission**:
wire one request-origin source through the existing request-time learning
contract, preserve the bounded question-reduction proof, and record the final
destination separately from route outcome without allowing any direct policy or
profile write.
